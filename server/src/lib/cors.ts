// CORS helper. The Vite frontend runs on http://localhost:5173 and calls
// the Next.js server on http://localhost:3000. We allow only the configured
// VITE_ORIGIN to hit our API.

import { NextResponse } from 'next/server'

const ALLOWED_ORIGIN = process.env.VITE_ORIGIN ?? 'http://localhost:5173'

export function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Forwarded-For',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  }
}

export function withCors(response: NextResponse): NextResponse {
  const headers = corsHeaders()
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v)
  }
  return response
}

export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
