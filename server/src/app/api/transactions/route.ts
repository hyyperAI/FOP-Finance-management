// /api/transactions — GET (list with filters + pagination) + POST (create)
// Per docs/backend/features/05-transactions.md § 1.2.
//
// Scope (gotcha #4): enforced at multiple layers.
//   - canPostTransaction: at POST time
//   - buildTransactionWhere: at GET time
//   - All within a single transaction write
//
// Idempotency (gotcha #2): `idempotencyKey` is unique. POSTing with the same
// key returns the prior result with `idempotentReplay: true`.

import { NextResponse } from 'next/server'
import prisma, { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guards'
import {
  canPostTransaction,
  canUseSubCategory,
  buildTransactionWhere,
  type ListQuery,
} from '@/lib/transactions'
import { periodKey } from '@/lib/period'
import { evaluateBudget } from '@/lib/budgets'
import {
  CreateTransactionSchema,
  ListTransactionsQuerySchema,
} from '@/lib/validators/transaction'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/transactions ---
export async function GET(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    const url = new URL(req.url)
    const raw: Record<string, string> = {}
    url.searchParams.forEach((v, k) => {
      raw[k] = v
    })
    const parsed = ListTransactionsQuerySchema.safeParse(raw)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    const q: ListQuery = parsed.data
    const where = buildTransactionWhere(
      { id: user.id, role: user.role, isActive: user.isActive },
      q,
    )
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 25

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          subCategory: { select: { id: true, name: true, color: true, icon: true } },
          department: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: { occurredAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      db.transaction.count({ where }),
    ])

    return withCors(
      NextResponse.json({
        transactions: transactions.map(serializeTransaction),
        total,
        page,
        pageSize,
      }),
    )
  } catch (err) {
    console.error('[GET /api/transactions] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- POST /api/transactions ---
export async function POST(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }
    const parsed = CreateTransactionSchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    // 1. Idempotency replay
    if (parsed.data.idempotencyKey) {
      const existing = await db.transaction.findUnique({
        where: { idempotencyKey: parsed.data.idempotencyKey },
        include: {
          category: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true, username: true } },
        },
      })
      if (existing) {
        return withCors(
          NextResponse.json({
            ...serializeTransaction(existing),
            idempotentReplay: true,
          }),
        )
      }
    }

    // 2. Category must exist + be active + match type
    const category = await db.category.findUnique({ where: { id: parsed.data.categoryId } })
    if (!category || !category.isActive) {
      return withCors(NextResponse.json({ error: 'category_not_found' }, { status: 404 }))
    }
    if (category.type !== parsed.data.type) {
      return withCors(
        NextResponse.json(
          { error: 'category_type_mismatch', expected: category.type, got: parsed.data.type },
          { status: 400 },
        ),
      )
    }

    // 3. Scope check (canPostTransaction)
    const scope = await canPostTransaction(user.id, parsed.data.categoryId)
    if (!scope.ok) {
      return withCors(
        NextResponse.json(
          { error: scope.reason ?? 'forbidden' },
          { status: scope.reason === 'user_inactive' ? 403 : 403 },
        ),
      )
    }

    // 4. Sub-category ownership (gotcha: sub-cat is owner-private)
    if (parsed.data.subCategoryId) {
      const subOk = await canUseSubCategory(user.id, parsed.data.subCategoryId)
      // Admin can override (already covered by canPostTransaction = true for admin)
      if (!subOk && user.role !== 'ADMIN') {
        return withCors(
          NextResponse.json({ error: 'subcategory_not_owned' }, { status: 403 }),
        )
      }
      // Also require sub-cat's parent matches category
      const sub = await db.subCategory.findUnique({
        where: { id: parsed.data.subCategoryId },
        select: { parentId: true, isActive: true },
      })
      if (!sub || !sub.isActive || sub.parentId !== parsed.data.categoryId) {
        return withCors(
          NextResponse.json(
            { error: 'subcategory_parent_mismatch' },
            { status: 400 },
          ),
        )
      }
    }

    // 5. Department (optional) must exist
    if (parsed.data.departmentId) {
      const dept = await db.department.findUnique({
        where: { id: parsed.data.departmentId },
      })
      if (!dept) {
        return withCors(NextResponse.json({ error: 'department_not_found' }, { status: 404 }))
      }
    }

    // 6. Create + audit
    const tx = await db.$transaction(async (db) => {
      const created = await db.transaction.create({
        data: {
          type: parsed.data.type,
          amount: new Prisma.Decimal(parsed.data.amount),
          vendor: parsed.data.vendor,
          description: parsed.data.description,
          paymentMethod: parsed.data.paymentMethod,
          occurredAt: parsed.data.occurredAt,
          periodKey: periodKey(parsed.data.occurredAt),
          postedById: user.id,
          categoryId: parsed.data.categoryId,
          subCategoryId: parsed.data.subCategoryId ?? null,
          departmentId: parsed.data.departmentId ?? null,
          receiptUrl: parsed.data.receiptUrl,
          notes: parsed.data.notes,
          tags: parsed.data.tags ? JSON.stringify(parsed.data.tags) : null,
          idempotencyKey: parsed.data.idempotencyKey ?? null,
        },
      })

      await recordAudit(db, {
        actorId: user.id,
        action: 'transaction.create',
        entityType: 'Transaction',
        entityId: created.id,
        after: {
          ...created,
          // Decimal doesn't serialize cleanly through JSON.stringify; strip it
          amount: created.amount.toString(),
        },
      })

      return created
    })

    // 7. Budget evaluation (M2+ stub, returns empty array)
    let alerts: Awaited<ReturnType<typeof evaluateBudget>> = []
    try {
      alerts = await evaluateBudget({
        categoryId: parsed.data.categoryId,
        amount: parsed.data.amount,
        occurredAt: parsed.data.occurredAt,
        postedById: user.id,
      })
    } catch (e) {
      console.warn('[POST /api/transactions] evaluateBudget failed:', e)
    }

    // 8. M5 hooks: best-effort try/catch around imports
    let duplicateWarning: { reason: string; matchedTransactionId: string } | null = null
    let anomalyWarning: { reason: string; zScore: number } | null = null
    try {
      const mod = await import('@/lib/duplicate')
      const dup = await mod.checkFuzzyDuplicate({
        type: parsed.data.type,
        amount: parsed.data.amount,
        vendor: parsed.data.vendor ?? null,
        occurredAt: parsed.data.occurredAt,
        postedById: user.id,
      })
      if (dup) duplicateWarning = dup
    } catch {
      // lib not implemented yet (M5)
    }
    try {
      const mod = await import('@/lib/anomaly')
      const anom = await mod.checkAnomaly({
        type: parsed.data.type,
        amount: parsed.data.amount,
        categoryId: parsed.data.categoryId,
        occurredAt: parsed.data.occurredAt,
        postedById: user.id,
      })
      if (anom) anomalyWarning = anom
    } catch {
      // lib not implemented yet (M5)
    }

    // Reload with relations for the response
    const full = await db.transaction.findUnique({
      where: { id: tx.id },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        subCategory: { select: { id: true, name: true, color: true, icon: true } },
        department: { select: { id: true, name: true } },
        postedBy: { select: { id: true, name: true, username: true } },
      },
    })

    return withCors(
      NextResponse.json(
        {
          ...serializeTransaction(full!),
          alerts,
          warnings: {
            ...(duplicateWarning ? { duplicate: duplicateWarning } : {}),
            ...(anomalyWarning ? { anomaly: anomalyWarning } : {}),
          },
        },
        { status: 201 },
      ),
    )
  } catch (err) {
    console.error('[POST /api/transactions] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function serializeTransaction(t: {
  id: string
  type: string
  amount: { toString: () => string }
  vendor: string | null
  description: string | null
  paymentMethod: string
  status: string
  occurredAt: Date
  periodKey: string
  postedById: string
  categoryId: string
  subCategoryId: string | null
  departmentId: string | null
  receiptUrl: string | null
  notes: string | null
  tags: string | null
  version: number
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  category?: { id: string; name: string; color: string | null; icon: string | null }
  subCategory?: { id: string; name: string; color: string | null; icon: string | null } | null
  department?: { id: string; name: string } | null
  postedBy?: { id: string; name: string; username: string }
}) {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount.toString(),
    vendor: t.vendor,
    description: t.description,
    paymentMethod: t.paymentMethod,
    status: t.status,
    occurredAt: t.occurredAt.toISOString(),
    periodKey: t.periodKey,
    postedById: t.postedById,
    categoryId: t.categoryId,
    subCategoryId: t.subCategoryId,
    departmentId: t.departmentId,
    receiptUrl: t.receiptUrl,
    notes: t.notes,
    tags: t.tags ? JSON.parse(t.tags) : [],
    version: t.version,
    isDeleted: t.isDeleted,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    ...(t.category ? { category: t.category } : {}),
    ...(t.subCategory ? { subCategory: t.subCategory } : {}),
    ...(t.department ? { department: t.department } : {}),
    ...(t.postedBy ? { postedBy: t.postedBy } : {}),
  }
}
