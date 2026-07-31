// PATCH /api/notifications/[id] — mark one alert as read/unread.
// Per docs/backend/features/18-notifications.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth-guards'
import { PatchNotificationBodySchema } from '@/lib/validators/notification'
import { serializeAlert } from '../_serialize'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession()
    if (session instanceof NextResponse) return session

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }

    let parsed
    try {
      parsed = PatchNotificationBodySchema.parse(body)
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

    // Ownership check per spec gotcha #1
    const existing = await db.alert.findUnique({ where: { id: params.id } })
    if (!existing) {
      return withCors(NextResponse.json({ error: 'not_found' }, { status: 404 }))
    }
    if (existing.recipientId !== (session as { id: string }).id) {
      return withCors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
    }

    const updated = await db.alert.update({
      where: { id: params.id },
      data: {
        isRead: parsed.isRead,
        // Per spec gotcha #5: readAt set on first read, cleared on un-read.
        readAt: parsed.isRead ? new Date() : null,
      },
    })

    return withCors(NextResponse.json(serializeAlert(updated)))
  } catch (err) {
    console.error('[PATCH /api/notifications/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
