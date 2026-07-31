// GET /api/admin/exports/preview — first 10 rows of the export, as JSON.
// Per docs/backend/features/11-exports-csv.md § 1.2.
//
// Query params mirror the POST body's filters (URL-encoded). Reuses
// buildTransactionWhere from F05/F08 (with includeSoftDeleted opt-in).

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { buildTransactionWhere, type ActorContext } from '@/lib/transactions'
import { TRANSACTION_CSV_HEADERS } from '@/lib/csv'
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
    const sp = url.searchParams
    try {
      // Validate: from/to are required, others optional
      const from = sp.get('from')
      const to = sp.get('to')
      if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        return withCors(
          NextResponse.json({ error: 'missing_or_invalid_from' }, { status: 400 }),
        )
      }
      if (!to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return withCors(
          NextResponse.json({ error: 'missing_or_invalid_to' }, { status: 400 }),
        )
      }
      if (new Date(from) > new Date(to)) {
        return withCors(NextResponse.json({ error: 'from_after_to' }, { status: 400 }))
      }

      const actor: ActorContext = {
        id: admin.id,
        role: admin.role,
        isActive: admin.isActive,
      }

      const where = buildTransactionWhere(actor, {
        from,
        to,
        type: (sp.get('type') as 'INTAKE' | 'EXPENSE') ?? undefined,
        categoryIds: sp.getAll('categoryIds'),
        subCategoryIds: sp.getAll('subCategoryIds'),
        paymentMethods: sp.getAll('paymentMethods') as Array<
          'CASH' | 'BANK' | 'JAZZCASH' | 'EASYPAISA' | 'CARD'
        >,
        userIds: sp.getAll('userIds'),
        includeSoftDeleted: sp.get('includeSoftDeleted') === 'true',
      })

      const [rows, total] = await Promise.all([
        db.transaction.findMany({
          where,
          include: {
            category: { select: { name: true } },
            subCategory: { select: { name: true } },
            postedBy: { select: { username: true, name: true } },
          },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          take: 10,
        }),
        db.transaction.count({ where }),
      ])

      return withCors(
        NextResponse.json({
          rows: rows.map(serializeRow),
          total,
          headers: TRANSACTION_CSV_HEADERS,
        }),
      )
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
  } catch (err) {
    console.error('[GET /api/admin/exports/preview] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function serializeRow(t: {
  id: string
  type: string
  occurredAt: Date
  createdAt: Date
  amount: { toString: () => string }
  status: string
  paymentMethod: string
  receiptUrl: string | null
  version: number
  notes: string | null
  description: string | null
  category: { name: string } | null
  subCategory: { name: string } | null
  postedBy: { username: string; name: string } | null
}) {
  return {
    id: t.id,
    type: t.type,
    occurredAt: t.occurredAt.toISOString(),
    postedAt: t.createdAt.toISOString(),
    postedByUsername: t.postedBy?.username ?? '',
    postedByName: t.postedBy?.name ?? '',
    categoryName: t.category?.name ?? '',
    subCategoryName: t.subCategory?.name ?? '',
    amount: t.amount.toString(),
    currency: 'PKR',
    paymentMethod: t.paymentMethod,
    vendor: t.vendor ?? '',
    title: t.notes ?? '', // spec column "title" → our "notes"
    description: (t.description ?? '').replace(/\n/g, ' '),
    personName: '', // no schema column for this
    receiptUrl: t.receiptUrl ?? '',
    status: t.status,
    version: t.version,
  }
}