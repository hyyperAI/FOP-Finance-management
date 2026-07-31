// POST /api/admin/users/[id]/reset-password
// Per docs/backend/features/02-users-admin.md § 1.2. The admin-initiated
// reset reuses the same token + email flow as /api/auth/forgot-password,
// but with actor = the requesting admin (not the user themselves).

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { sendEmail, passwordResetEmailBody } from '@/lib/email'
import { requireAdmin } from '@/lib/auth-guards'
import { getRequestMeta } from '@/lib/http'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin
    const { ip, userAgent } = getRequestMeta(req)

    const user = await db.user.findUnique({ where: { id: params.id } })
    if (!user) {
      return withCors(NextResponse.json({ error: 'user_not_found' }, { status: 404 }))
    }

    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.$transaction(async (tx) => {
      // Invalidate existing unused tokens
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })

      await tx.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      })

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'auth.password_reset_request',
        entityType: 'User',
        entityId: user.id,
        ip,
        userAgent: userAgent ?? undefined,
      })
    })

    const resetUrl = `${process.env.NEXTAUTH_URL ?? 'http://localhost:3000'}/reset-password/${token}`
    const { subject, text } = passwordResetEmailBody(user.name, resetUrl)
    await sendEmail({ to: user.email, subject, text })

    return withCors(NextResponse.json({ ok: true }))
  } catch (err) {
    console.error('[POST /api/admin/users/[id]/reset-password] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
