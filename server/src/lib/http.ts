// Helper to extract client IP + user agent from a Next.js Request.
// Used by audit logging. Single source of truth (per docs/flows/data-flow.md §16
// "common patterns" — audit fields are written identically across features).

import type { NextRequest } from 'next/server'

export interface RequestMeta {
  ip: string
  userAgent: string | null
}

export function getRequestMeta(req: NextRequest | Request): RequestMeta {
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0]!.trim() : 'unknown'
  const userAgent = req.headers.get('user-agent')
  return { ip, userAgent }
}
