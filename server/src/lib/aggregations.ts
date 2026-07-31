// Aggregation helpers for the dashboard endpoints (Feature 09).
// Per docs/backend/features/09-dashboard.md § 1.5.
//
// All helpers filter to status='POSTED' and isDeleted=false (spec gotcha #1).
// We reuse the shared `buildTransactionWhere` so scoping (USER: own only;
// ADMIN: all) is consistent with F05 + F08.

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export interface AggFilters {
  postedById?: string
  fromDate?: Date
  toDate?: Date
}

/** Sum of INTAKE amounts in the filter. */
export async function sumIncome(filters: AggFilters): Promise<number> {
  const r = await db.transaction.aggregate({
    where: buildAggWhere(filters, 'INTAKE'),
    _sum: { amount: true },
  })
  return numberFromDecimal(r._sum.amount)
}

/** Sum of EXPENSE amounts in the filter. */
export async function sumExpense(filters: AggFilters): Promise<number> {
  const r = await db.transaction.aggregate({
    where: buildAggWhere(filters, 'EXPENSE'),
    _sum: { amount: true },
  })
  return numberFromDecimal(r._sum.amount)
}

/** All-time net (no date filter). Used for admin running balance. */
export async function runningBalance(): Promise<number> {
  const [intake, expense] = await Promise.all([sumIncome({}), sumExpense({})])
  return round2(intake - expense)
}

/** Group by category (only EXPENSE per spec), top N by total desc. */
export async function sumByCategory(
  filters: AggFilters,
  limit = 5,
): Promise<Array<{ categoryId: string; categoryName: string; total: number }>> {
  return sumByCategoryType(filters, 'EXPENSE', limit)
}

/** Group by category for INTAKE type, top N by total desc. */
export async function sumByCategoryIntake(
  filters: AggFilters,
  limit = 5,
): Promise<Array<{ categoryId: string; categoryName: string; total: number }>> {
  return sumByCategoryType(filters, 'INTAKE', limit)
}

/** Internal: group by category for given type, top N by total desc. */
async function sumByCategoryType(
  filters: AggFilters,
  type: 'INTAKE' | 'EXPENSE',
  limit = 5,
): Promise<Array<{ categoryId: string; categoryName: string; total: number }>> {
  const grouped = await db.transaction.groupBy({
    by: ['categoryId'],
    where: buildAggWhere(filters, type),
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  })

  // Single batch query for the categories — avoids N+1.
  const ids = grouped.map((g) => g.categoryId)
  const cats =
    ids.length === 0 ? [] : await db.category.findMany({ where: { id: { in: ids } } })
  const byId = new Map(cats.map((c) => [c.id, c]))

  return grouped.map((g) => ({
    categoryId: g.categoryId,
    categoryName: byId.get(g.categoryId)?.name ?? 'Unknown',
    total: numberFromDecimal(g._sum.amount),
  }))
}

/**
 * Month-over-month change vs previous period of same length.
 * Per spec gotcha #2: same-length previous period (July 31 days → June 30 days),
 * not a normalized 30-day comparison.
 */
export async function momChange(
  filters: AggFilters,
): Promise<{ delta: number; deltaPct: number; direction: 'up' | 'down' }> {
  if (!filters.fromDate || !filters.toDate) {
    return { delta: 0, deltaPct: 0, direction: 'up' }
  }
  const periodMs = filters.toDate.getTime() - filters.fromDate.getTime()
  const prevStart = new Date(filters.fromDate.getTime() - periodMs)
  const prevEnd = new Date(filters.fromDate.getTime() - 1)
  const prevFilters: AggFilters = {
    ...filters,
    fromDate: prevStart,
    toDate: prevEnd,
  }

  const [curIntake, curExpense, prevIntake, prevExpense] = await Promise.all([
    sumIncome(filters),
    sumExpense(filters),
    sumIncome(prevFilters),
    sumExpense(prevFilters),
  ])
  const curNet = round2(curIntake - curExpense)
  const prevNet = round2(prevIntake - prevExpense)
  const delta = round2(curNet - prevNet)
  const deltaPct =
    prevNet !== 0 ? Math.round((delta / Math.abs(prevNet)) * 1000) / 10 : 0
  return { delta, deltaPct, direction: delta >= 0 ? 'up' : 'down' }
}

// --- internals ---

function buildAggWhere(
  f: AggFilters,
  type: 'INTAKE' | 'EXPENSE',
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {
    type,
    status: 'POSTED',
    isDeleted: false,
  }
  if (f.postedById) where.postedById = f.postedById
  if (f.fromDate || f.toDate) {
    where.occurredAt = {}
    if (f.fromDate) (where.occurredAt as Prisma.DateTimeFilter).gte = f.fromDate
    if (f.toDate) (where.occurredAt as Prisma.DateTimeFilter).lte = f.toDate
  }
  return where
}

function numberFromDecimal(d: Prisma.Decimal | null | undefined): number {
  if (!d) return 0
  return round2(Number(d.toString()))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}