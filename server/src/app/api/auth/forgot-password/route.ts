// POST /api/auth/forgot-password
// Per docs/backend/features/01-auth.md § 1.2.
//
// Always returns 200 (anti-enumeration). If the email exists, generate a token,
// persist it, send the email, audit. Otherwise no-op.

import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { sendEmail, passwordResetEmailBody } from '@/lib/email'
import { isRateLimited, recordFailedAttempt, forgotPasswordKey } from '@/lib/rate-limit'
import { ForgotPasswordSchema } from '@/lib/validators/auth'
import { getRequestMeta } from '@/lib/http'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: Request) {
  const { ip, userAgent } = getRequestMeta(req)

  // Rate limit by IP — attackers don't have accounts
  if (isRateLimited(forgotPasswordKey(req))) {
    recordFailedAttempt(forgotPasswordKey(req))
    // Still return 200 (don't reveal rate-limit status)
    return withCors(NextResponse.json({ ok: true }))
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return withCors(NextResponse.json({ ok: true }))
  }

  const parsed = ForgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    // Don't reveal validation — still 200
    return withCors(NextResponse.json({ ok: true }))
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } })

  if (user && user.isActive) {
    const token = randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.$transaction(async (tx) => {
      // Invalidate any existing tokens for this user
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      })

      await tx.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt },
      })

      await recordAudit(tx, {
        actorId: user.id,
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
  }

  // Always 200 (anti-enumeration)
  return withCors(NextResponse.json({ ok: true }))
}
