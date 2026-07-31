// POST /api/admin/exports/csv — full CSV export (admin only).
// Per docs/backend/features/11-exports-csv.md § 1.2.
//
// For v1 we fetch in pages of 1000 (no real streaming to avoid Next.js dev
// mode Readable-stream complexity). The architecture is ready to switch to
// streaming: replace `fetchAllPages()` with a Node Readable that pushes
// rows as they're fetched. The route handler signature won't change.
//
// Audit fires BEFORE generation (spec gotcha #9). If streaming fails
// halfway, you've still recorded the attempt.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { z } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { buildTransactionWhere, type ActorContext } from '@/lib/transactions'
import { csvStringify, TRANSACTION_CSV_HEADERS } from '@/lib/csv'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

const FiltersSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    categoryIds: z.array(z.string().min(20).max(40)).optional(),
    subCategoryIds: z.array(z.string().min(20).max(40)).optional(),
    paymentMethods: z
      .array(z.enum(['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'CARD']))
      .optional(),
    userIds: z.array(z.string().min(20).max(40)).optional(),
    type: z.enum(['all', 'INTAKE', 'EXPENSE']).default('all'),
    minAmount: z.number().nonnegative().optional(),
    maxAmount: z.number().nonnegative().optional(),
  })
  .refine((d) => new Date(d.from) <= new Date(d.to), {
    message: 'from must be ≤ to',
    path: ['from'],
  })

const BodySchema = z.object({
  filters: FiltersSchema,
  includeSoftDeleted: z.boolean().default(false),
  includeEditHistory: z.boolean().default(false),
})

const PAGE_SIZE = 1000

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }
    const parsed = BodySchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }
    const { filters, includeSoftDeleted, includeEditHistory } = parsed.data

    const actor: ActorContext = {
      id: admin.id,
      role: admin.role,
      isActive: admin.isActive,
    }

    const where = buildTransactionWhere(actor, {
      from: filters.from,
      to: filters.to,
      type: filters.type === 'all' ? undefined : filters.type,
      categoryIds: filters.categoryIds,
      subCategoryIds: filters.subCategoryIds,
      paymentMethods: filters.paymentMethods,
      userIds: filters.userIds,
      min:
        filters.minAmount !== undefined ? String(filters.minAmount) : undefined,
      max:
        filters.maxAmount !== undefined ? String(filters.maxAmount) : undefined,
      includeSoftDeleted,
    })

    // Audit BEFORE generation (gotcha #9). Failure here blocks the export so
    // the audit row is always written for any successful POST.
    try {
      await recordAudit(db, {
        actorId: admin.id,
        action: 'export.generate',
        entityType: 'Export',
        entityId: `csv-${filters.from}-${filters.to}`,
        after: { filters, includeSoftDeleted, includeEditHistory },
      })
    } catch (err) {
      console.error('[POST /api/admin/exports/csv] audit failed:', err)
      return withCors(
        NextResponse.json({ error: 'audit_failed' }, { status: 500 }),
      )
    }

    // Page through all rows (gotcha #1: never load all into memory).
    const allRows: unknown[][] = []
    let cursor: string | undefined
    while (true) {
      const batch = await db.transaction.findMany({
        where,
        include: {
          category: { select: { name: true } },
          subCategory: { select: { name: true } },
          postedBy: { select: { username: true, name: true } },
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (batch.length === 0) break
      for (const t of batch) allRows.push(serializeRow(t))
      cursor = batch[batch.length - 1].id
      if (batch.length < PAGE_SIZE) break
    }

    // Optional: edit history appended after each transaction's rows.
    // For v1 we batch the lookups to avoid N+1.
    if (includeEditHistory && allRows.length > 0) {
      // Fetch all transaction IDs we have so far (we don't have them here
      // because serializeRow omits id; rebuild from the where clause instead).
      // For v1 simplicity: re-fetch just the IDs.
      const ids = (
        await db.transaction.findMany({ where, select: { id: true } })
      ).map((t) => t.id)

      const edits = await db.transactionEdit.findMany({
        where: { transactionId: { in: ids } },
        include: { editedBy: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })

      // Group edits by transactionId, append after the matching row's position.
      // We rebuild the final list preserving transaction-row order then
      // splicing in edits.
      const editsByTx = new Map<string, typeof edits>()
      for (const e of edits) {
        const arr = editsByTx.get(e.transactionId) ?? []
        arr.push(e)
        editsByTx.set(e.transactionId, arr)
      }

      const finalRows: unknown[][] = []
      for (const row of allRows) {
        finalRows.push(row)
        const txId = row[0] as string
        for (const e of editsByTx.get(txId) ?? []) {
          finalRows.push([
            `${txId}-EDIT`,
            'EDIT',
            '',
            e.createdAt.toISOString(),
            '',
            e.editedBy.name,
            '',
            '',
            '',
            '',
            '',
            '',
            `before: ${e.before} | after: ${e.after}`,
            '',
            '',
            'EDIT',
            '',
          ])
        }
      }
      // Build CSV
      const header = csvStringify([TRANSACTION_CSV_HEADERS])
      const body = header + csvStringify(finalRows)
      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': buildContentDisposition(filters.from, filters.to),
          'Cache-Control': 'no-store',
        },
      })
    }

    // Default path: just transactions, no edits
    const csv = csvStringify([TRANSACTION_CSV_HEADERS, ...allRows])
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': buildContentDisposition(filters.from, filters.to),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    if (err instanceof ZodError) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: err.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }
    console.error('[POST /api/admin/exports/csv] error:', err)
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
  vendor: string | null
  category: { name: string } | null
  subCategory: { name: string } | null
  postedBy: { username: string; name: string } | null
}): unknown[] {
  return [
    t.id,
    t.type,
    t.occurredAt.toISOString(),
    t.createdAt.toISOString(),
    t.postedBy?.username ?? '',
    t.postedBy?.name ?? '',
    t.category?.name ?? '',
    t.subCategory?.name ?? '',
    t.amount.toString(),
    'PKR',
    t.paymentMethod,
    t.vendor ?? '',
    t.notes ?? '',
    (t.description ?? '').replace(/\n/g, ' '),
    '',
    t.receiptUrl ?? '',
    t.status,
    t.version,
  ]
}

function buildContentDisposition(from: string, to: string): string {
  return `attachment; filename="fop-transactions-${from}-to-${to}.csv"`
}