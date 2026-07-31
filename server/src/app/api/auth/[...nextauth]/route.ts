// NextAuth catch-all route. Named exports only (per Next.js App Router).
// See ./src/lib/auth-options.ts for the configuration.

import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'

import { authOptions } from '@/lib/auth-options'
import { corsHeaders, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

const handler = NextAuth(authOptions)

function wrap(original: (req: NextRequest, ctx: { params: unknown }) => Promise<Response>) {
  return async (req: NextRequest, ctx: { params: unknown }) => {
    if (req.method === 'OPTIONS') return preflight()
    const res = await original(req, ctx)
    const headers = corsHeaders()
    for (const [k, v] of Object.entries(headers)) {
      res.headers.set(k, v)
    }
    return res
  }
}

export { handler as GET, handler as POST }
