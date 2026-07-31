// GET /api/notifications/unread-count — bell badge count.
// Per docs/backend/features/18-notifications.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth-guards'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(_req: Request) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    const userId = (session as { id: string }).id
    const unreadCount = await db.alert.count({
      where: { recipientId: userId, isRead: false },
    })

    return withCors(NextResponse.json({ unreadCount }))
  } catch (err) {
    console.error('[GET /api/notifications/unread-count] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
