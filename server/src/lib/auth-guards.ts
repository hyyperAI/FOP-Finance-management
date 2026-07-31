// Auth guards. Used by all /api/admin/* routes (requireAdmin) and
// /api/sub-categories/* routes (requireSession).
//
// Pattern (per spec § 1.2 GET /api/admin/users example):
//   const admin = await requireAdmin()
//   if (admin instanceof NextResponse) return admin
//   // ... admin is the authenticated user record
//
// `requireAdmin` and `requireSession` return either:
//   - a `User` object (the authenticated user) — success
//   - a `NextResponse` with the appropriate 401/403 JSON — caller returns it
//
// Defense in depth: even though the session is a JWT, we re-read role +
// isActive from the DB so a stale cookie can't grant elevated access after
// deactivation.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { db } from '@/lib/db'

export type GuardResult = Awaited<ReturnType<typeof requireAdmin>>

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // The session is JWT-only — we need to re-read role + isActive from the DB
  // so a stale cookie can't grant admin after deactivation.
  const userId = (session.user as { id?: string }).id
  if (!userId) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'user_inactive' }, { status: 403 })
  }
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return user
}

/**
 * Get the authenticated user (any role: ADMIN or USER) or a 401 response.
 * Used by endpoints that aren't admin-only — e.g. sub-categories where USERs
 * own their own rows.
 */
export async function requireSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }
  const userId = (session.user as { id?: string }).id
  if (!userId) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 })
  }
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.isActive) {
    return NextResponse.json({ error: 'user_inactive' }, { status: 403 })
  }
  return user
}
