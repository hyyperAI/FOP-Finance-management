// GET /api/receipt/[key] — authenticated serve. Per docs/backend/features/07-receipts.md § 1.2.
// v1: any authenticated user can view any receipt. M5 (deferred): restrict to
// transaction owner or admin via Transaction lookup.

import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

import { requireSession } from '@/lib/auth-guards'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    // Path-traversal protection (gotcha #8). The client sends URL-encoded
    // segments (e.g., "uploads/receipts/2026/07/x.jpg" arrives as
    // "uploads%2Freceipts%2F2026%2F07%2Fx.jpg"), so we decode first. Then
    // reject if the decoded form contains any traversal marker.
    let safeKey: string
    try {
      safeKey = decodeURIComponent(params.key)
    } catch {
      // Malformed percent-escape sequence (e.g., "%ZZ")
      return withCors(NextResponse.json({ error: 'invalid_key' }, { status: 400 }))
    }

    // Hard reject any traversal marker or absolute path.
    if (
      safeKey.includes('..') ||
      safeKey.includes('\\') ||
      safeKey.startsWith('/') ||
      safeKey.includes('\0')
    ) {
      return withCors(NextResponse.json({ error: 'invalid_key' }, { status: 400 }))
    }

    // Must start with the receipts root and look like a receipt path.
    if (!safeKey.startsWith('uploads/receipts/') || !safeKey.endsWith('.jpg')) {
      return withCors(NextResponse.json({ error: 'invalid_key' }, { status: 400 }))
    }

    const filePath = path.join(process.cwd(), 'public', safeKey)
    try {
      const buffer = await fs.readFile(filePath)
      // gotcha #13: Content-Type is always image/jpeg because we always compress to JPEG.
      // gotcha #14: private + 1-day cache (immutable).
      const headers: HeadersInit = {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=86400',
        'Content-Length': String(buffer.length),
      }
      return new NextResponse(buffer, { headers })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return withCors(NextResponse.json({ error: 'not_found' }, { status: 404 }))
      }
      throw err
    }
  } catch (err) {
    console.error('[GET /api/receipt/[key]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
