// GET /api/admin/audit — list audit entries (admin only).
// Per docs/backend/features/12-audit.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { parseListAuditQuery } from '@/lib/validators/audit'
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
    let q
    try {
      q = parseListAuditQuery(url.searchParams)
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

    const [entries, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, username: true } } },
        orderBy: { occurredAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      db.auditLog.count({ where }),
    ])

    return withCors(
      NextResponse.json({
        entries: entries.map((e) => ({
          id: e.id,
          occurredAt: e.occurredAt.toISOString(),
          actor: e.actor
            ? { id: e.actor.id, name: e.actor.name, username: e.actor.username }
            : null,
          action: e.action,
          entityType: e.entityType,
          entityId: e.entityId,
          reason: e.reason,
          ip: e.ip,
        })),
        total,
        page: q.page,
        pageSize: q.pageSize,
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/audit] error:', err)
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