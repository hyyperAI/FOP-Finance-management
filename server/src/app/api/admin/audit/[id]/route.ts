// GET /api/admin/audit/[id] — single audit entry with full before/after JSON.
// Per docs/backend/features/12-audit.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const entry = await db.auditLog.findUnique({
      where: { id: params.id },
      include: { actor: { select: { id: true, name: true, username: true } } },
    })

    if (!entry) {
      return withCors(NextResponse.json({ error: 'not_found' }, { status: 404 }))
    }

    return withCors(
      NextResponse.json({
        id: entry.id,
        occurredAt: entry.occurredAt.toISOString(),
        actor: entry.actor
          ? { id: entry.actor.id, name: entry.actor.name, username: entry.actor.username }
          : null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        reason: entry.reason,
        ip: entry.ip,
        userAgent: entry.userAgent,
        before: parseJson(entry.before),
        after: parseJson(entry.after),
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/audit/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function parseJson(s: string | null): unknown {
  if (s === null || s === undefined) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}