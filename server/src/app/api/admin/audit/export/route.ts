// POST /api/admin/audit/export — CSV download of filtered audit entries.
// Per docs/backend/features/12-audit.md § 1.2 (POST so URL length isn't a
// limit when many filter params are passed).
//
// For v1 we paginate internally (batch of 500) and return the full CSV as a
// single response. Real streaming is straightforward to add (swap the
// `fetchAllBatches()` for a Node Readable that pushes chunks) — the route
// signature won't change.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { ExportAuditBodySchema } from '@/lib/validators/audit'
import { csvStringify } from '@/lib/csv'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

const PAGE_SIZE = 500
const HEADER_ROW = [
  'id',
  'occurredAt',
  'actorId',
  'actorName',
  'action',
  'entityType',
  'entityId',
  'reason',
  'ip',
]

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

    let q
    try {
      q = ExportAuditBodySchema.parse(body)
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

    const where = buildWhere(q)
    const allRows: unknown[][] = []
    let cursor: string | undefined
    while (true) {
      const batch = await db.auditLog.findMany({
        where,
        include: { actor: { select: { name: true } } },
        orderBy: { occurredAt: 'asc' },
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (batch.length === 0) break
      for (const e of batch) {
        allRows.push([
          e.id,
          e.occurredAt.toISOString(),
          e.actorId,
          e.actor?.name ?? '',
          e.action,
          e.entityType,
          e.entityId,
          e.reason ?? '',
          e.ip ?? '',
        ])
      }
      cursor = batch[batch.length - 1].id
      if (batch.length < PAGE_SIZE) break
    }

    const csv = csvStringify([HEADER_ROW, ...allRows])
    const today = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-${today}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[POST /api/admin/audit/export] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function buildWhere(q: {
  from?: string
  to?: string
  actorId?: string
  actions?: string[]
  entityTypes?: string[]
  entityId?: string
}): import('@prisma/client').Prisma.AuditLogWhereInput {
  const where: import('@prisma/client').Prisma.AuditLogWhereInput = {}
  if (q.from || q.to) {
    const occurredAt: import('@prisma/client').Prisma.DateTimeFilter = {}
    if (q.from) occurredAt.gte = new Date(`${q.from}T00:00:00.000Z`)
    if (q.to) occurredAt.lte = new Date(`${q.to}T23:59:59.999Z`)
    where.occurredAt = occurredAt
  }
  if (q.actorId) where.actorId = q.actorId
  if (q.actions?.length) where.action = { in: q.actions }
  if (q.entityTypes?.length) where.entityType = { in: q.entityTypes }
  if (q.entityId) where.entityId = q.entityId
  return where
}