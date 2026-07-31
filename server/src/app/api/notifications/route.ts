// GET /api/notifications — list current user's alerts (paginated, filterable)
// Per docs/backend/features/18-notifications.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth-guards'
import { ListNotificationsQuerySchema } from '@/lib/validators/notification'
import { serializeAlert } from './_serialize'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(req: Request) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    const url = new URL(req.url)
    let q
    try {
      const obj: Record<string, unknown> = {}
      for (const [key, raw] of url.searchParams) {
        if (key === 'limit' || key === 'offset') {
          const n = Number(raw)
          if (Number.isFinite(n)) obj[key] = n
        } else if (key === 'isRead') {
          obj[key] = raw === 'true' || raw === 'false' ? raw === 'true' : raw
        } else {
          obj[key] = raw
        }
      }
      q = ListNotificationsQuerySchema.parse(obj)
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

    // Per spec gotcha #1: recipientId enforcement is critical.
    // session is a User object from requireSession().
    const userId = (session as { id: string }).id
    console.log('[GET /api/notifications] userId=', userId)
    const where: Record<string, unknown> = { recipientId: userId }
    if (q.isRead !== undefined) where.isRead = q.isRead
    if (q.type) where.type = q.type

    const [alerts, total, unreadCount] = await Promise.all([
      db.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.limit,
        skip: q.offset,
      }),
      db.alert.count({ where }),
      db.alert.count({ where: { recipientId: userId, isRead: false } }),
    ])

    return withCors(
      NextResponse.json({
        alerts: alerts.map(serializeAlert),
        total,
        unreadCount,
        limit: q.limit,
        offset: q.offset,
      }),
    )
  } catch (err) {
    console.error('[GET /api/notifications] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
