// Budget evaluation helper. Per docs/backend/features/15-budgets.md § 1.5.
// Also writes recipient-scoped Alert rows per F18 notifications spec.
//
// Called by F05 transactions route with: { categoryId, amount, occurredAt, postedById }
// (we compute periodKey internally from occurredAt).

import { Prisma, PrismaClient } from '@prisma/client'
import { periodKeyFor } from '@/lib/period'
import { db } from '@/lib/db'

export type BudgetClient = Prisma.TransactionClient | PrismaClient

export type WarningLevel = 'none' | 'warn' | 'exceeded'

export interface EvaluateBudgetResult {
  percentUsed: number
  warningLevel: WarningLevel
  budgetId: string | null
}

const WARN_PERCENT = 80
const BLOCK_PERCENT = 100

/**
 * Compute spend for a (categoryId, periodKey) combo + new amount.
 * Emits alerts to category owners if a threshold is crossed.
 * Idempotent — alerts are deduplicated per recipient per gotcha #4.
 *
 * Returns `{ percentUsed, warningLevel, budgetId }`.
 *
 * Accepts either the legacy 4-arg form (tx, categoryId, periodKey, amount)
 * or the F05 form: ({ categoryId, amount, occurredAt }) — for backward compat
 * with F05's pre-existing call site.
 */
export async function evaluateBudget(
  txOrArg: BudgetClient | { categoryId: string; amount: string | number; occurredAt: Date | string },
  maybeCategoryId?: string,
  maybePeriodKey?: string,
  maybeAmount?: number,
): Promise<EvaluateBudgetResult> {
  // Detect signature: if first arg is a plain object, use F05's form.
  const isObj = typeof txOrArg === 'object' && !('budget' in (txOrArg as Record<string, unknown>)) && 'categoryId' in (txOrArg as Record<string, unknown>)

  let tx: BudgetClient
  let categoryId: string
  let periodKey: string
  // When called via F05 form, `amount` is the NEW tx (already in DB by the
  // time this runs because F05 doesn't wrap in $transaction). When called via
  // the legacy 4-arg form inside a tx, the new tx isn't visible yet, so we
  // must add the new amount. `existing` already includes the new tx in the F05
  // path — no double-counting.
  let newAmountForTotal: number | null = null

  if (isObj) {
    const arg = txOrArg as { categoryId: string; amount: string | number; occurredAt: Date | string }
    tx = db as unknown as BudgetClient
    categoryId = arg.categoryId
    periodKey = periodKeyFor(new Date(arg.occurredAt))
    newAmountForTotal = null // already in DB
  } else {
    tx = txOrArg as BudgetClient
    categoryId = maybeCategoryId!
    periodKey = maybePeriodKey!
    newAmountForTotal = maybeAmount! // not yet in DB
  }

  const budget = await tx.budget.findUnique({
    where: { categoryId_periodKey: { categoryId, periodKey } },
  })
  if (!budget || !budget.isActive) {
    return { percentUsed: 0, warningLevel: 'none', budgetId: null }
  }

  // Lookup Category.name once (avoids N+1 — single query for all needed info).
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { id: true, name: true },
  })
  const categoryName = category?.name ?? '(unknown)'

  const agg = await tx.transaction.aggregate({
    where: {
      categoryId,
      periodKey,
      status: 'POSTED',
      type: 'EXPENSE',
      isDeleted: false,
    },
    _sum: { amount: true },
  })
  const existing = Number(agg._sum.amount ?? 0)
  const total = newAmountForTotal === null ? existing : existing + newAmountForTotal
  const limit = Number(budget.amount)
  const percent = limit > 0 ? Math.round((total / limit) * 100) : 0
  const warningLevel: WarningLevel =
    percent >= BLOCK_PERCENT ? 'exceeded' : percent >= WARN_PERCENT ? 'warn' : 'none'

  if (warningLevel !== 'none') {
    // Find category owners — users who have this category in UserCategory.
    const owners = await tx.userCategory.findMany({
      where: { categoryId },
      select: { userId: true },
    })
    const recipientIds = owners.map((o) => o.userId)

    for (const recipientId of recipientIds) {
      await maybeWriteAlert(tx, {
        type: warningLevel === 'exceeded' ? 'BUDGET_EXCEEDED_100' : 'BUDGET_THRESHOLD_80',
        recipientId,
        categoryId,
        periodKey,
        payload: {
          categoryId,
          categoryName,
          periodKey,
          percentUsed: percent,
          amount: total.toFixed(2),
          limit: limit.toFixed(2),
          currency: budget.currency,
        },
      })
    }
  }

  return { percentUsed: percent, warningLevel, budgetId: budget.id }
}

// Reference to db for the F05-call form (which doesn't pass a tx).
// Imported at top to avoid forward-reference issues.

/**
 * Insert an Alert only if no UNREAD alert exists for the same
 * (type, recipientId, categoryId, periodKey). Idempotent per gotcha #4 — each
 * recipient gets at most one unread alert per threshold crossing.
 */
async function maybeWriteAlert(
  tx: BudgetClient,
  data: {
    type: string
    recipientId: string
    categoryId: string
    periodKey: string
    payload: Record<string, unknown>
  },
): Promise<void> {
  const existing = await tx.alert.findFirst({
    where: {
      type: data.type,
      recipientId: data.recipientId,
      categoryId: data.categoryId,
      periodKey: data.periodKey,
      isRead: false,
    },
  })
  if (existing) return

  await tx.alert.create({
    data: {
      type: data.type,
      recipientId: data.recipientId,
      categoryId: data.categoryId,
      periodKey: data.periodKey,
      payload: JSON.stringify(data.payload),
      isRead: false,
    },
  })
}
