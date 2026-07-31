// GET /api/admin/search — admin transaction search (Feature 08).
// Per docs/backend/features/08-search.md § 1.2.
//
// POST /api/admin/search/export is intentionally omitted — spec § 1.2
// recommends "have UI call /api/admin/exports/csv directly". When F11
// lands, the UI will reuse its endpoint; we avoid a thin redirect that
// would have to be kept in sync.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { buildTransactionWhere, type ActorContext } from '@/lib/transactions'
import { parseSearchFilters } from '@/lib/validators/search'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const url = new URL(req.url)
    let filters
    try {
      filters = parseSearchFilters(url.searchParams)
    } catch (err) {
      if (err instanceof ZodError) {
        return withCors(
          NextResponse.json(
            { error: 'validation_error', fields: err.flatten().fieldErrors },
            { status: 400 },
          ),
        )
      }
      throw err
    }

    // Admin is always treated as the actor; the scope check inside
    // buildTransactionWhere defaults to "all" for ADMIN. The optional
    // userIds[] filter lets admins narrow by poster.
    const actor: ActorContext = {
      id: admin.id,
      role: admin.role,
      isActive: admin.isActive,
    }

    const where = buildTransactionWhere(actor, {
      from: filters.from,
      to: filters.to,
      type: filters.type,
      status: filters.status,
      categoryIds: filters.categoryIds,
      subCategoryIds: filters.subCategoryIds,
      paymentMethods: filters.paymentMethods,
      userIds: filters.userIds,
      min: filters.minAmount !== undefined ? String(filters.minAmount) : undefined,
      max: filters.maxAmount !== undefined ? String(filters.maxAmount) : undefined,
      description: filters.description,
      page: filters.page,
      pageSize: filters.pageSize,
    })

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, color: true } },
          subCategory: { select: { id: true, name: true } },
          postedBy: { select: { id: true, name: true, username: true } },
        },
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
        take: filters.pageSize,
        skip: (filters.page - 1) * filters.pageSize,
      }),
      db.transaction.count({ where }),
    ])

    return withCors(
      NextResponse.json({
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          occurredAt: t.occurredAt.toISOString(),
          amount: t.amount.toString(),
          category: t.category,
          subCategory: t.subCategory,
          paymentMethod: t.paymentMethod,
          vendor: t.vendor,
          description: t.description,
          notes: t.notes,
          postedBy: t.postedBy,
          status: t.status,
        })),
        total,
        page: filters.page,
        pageSize: filters.pageSize,
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/search] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}