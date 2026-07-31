// POST /api/notifications/read-all — bulk-mark all current user's unread alerts as read.
// Per docs/backend/features/18-notifications.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth-guards'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(_req: Request) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    const userId = (session as { id: string }).id
    const result = await db.alert.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })

    return withCors(NextResponse.json({ markedRead: result.count }))
  } catch (err) {
    console.error('[POST /api/notifications/read-all] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
