// POST /api/auth/reset-password
// Per docs/backend/features/01-auth.md § 1.2.
// In a single DB transaction: validate token, mark used, update password, audit.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { hashPassword } from '@/lib/password'
import { ResetPasswordSchema } from '@/lib/validators/auth'
import { getRequestMeta } from '@/lib/http'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: Request) {
  const { ip, userAgent } = getRequestMeta(req)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return withCors(
      NextResponse.json({ error: 'validation_error', fields: { body: ['Invalid JSON'] } }, { status: 400 }),
    )
  }

  const parsed = ResetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return withCors(
      NextResponse.json(
        { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      ),
    )
  }

  const result = await db.$transaction(async (tx) => {
    const token = await tx.passwordResetToken.findUnique({
      where: { token: parsed.data.token },
    })

    if (!token) return { error: 'token_invalid', status: 404 as const }
    if (token.usedAt) return { error: 'token_used', status: 410 as const }
    if (token.expiresAt < new Date()) return { error: 'token_expired', status: 410 as const }

    await tx.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    })

    const passwordHash = await hashPassword(parsed.data.newPassword)
    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    })

    await recordAudit(tx, {
      actorId: token.userId,
      action: 'auth.password_reset_complete',
      entityType: 'User',
      entityId: token.userId,
      ip,
      userAgent: userAgent ?? undefined,
    })

    return { ok: true as const }
  })

  if ('error' in result) {
    return withCors(NextResponse.json({ error: result.error }, { status: result.status }))
  }
  return withCors(NextResponse.json(result))
}
