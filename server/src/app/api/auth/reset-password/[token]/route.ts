// GET /api/auth/reset-password/[token]
// Per docs/backend/features/01-auth.md § 1.2.
// Returns 200 { valid: true } if token exists, not used, not expired.
// 404 if token doesn't exist. 410 if used or expired.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const token = await db.passwordResetToken.findUnique({
    where: { token: params.token },
  })

  if (!token) {
    return withCors(NextResponse.json({ error: 'token_invalid' }, { status: 404 }))
  }
  if (token.usedAt) {
    return withCors(NextResponse.json({ error: 'token_used' }, { status: 410 }))
  }
  if (token.expiresAt < new Date()) {
    return withCors(NextResponse.json({ error: 'token_expired' }, { status: 410 }))
  }

  return withCors(NextResponse.json({ valid: true }))
}
