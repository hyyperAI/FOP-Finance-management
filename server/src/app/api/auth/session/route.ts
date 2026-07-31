// GET /api/auth/session
// Convenience endpoint for the Vite frontend to check the current session
// (NextAuth's own /api/auth/session is a catch-all POST; this thin wrapper
// returns the same JSON via GET for ease of use from fetch()).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return withCors(NextResponse.json({}))
  }
  return withCors(NextResponse.json(session))
}
