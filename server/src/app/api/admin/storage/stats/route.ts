// GET /api/admin/storage/stats — disk usage + orphan count (admin only).
// Per docs/backend/features/13-storage.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { getStorage } from '@/lib/storage'
import { getStorageCapBytes, bannerFor, usagePercentFor } from '@/lib/storage-cap'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(_req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const storage = getStorage()

    // 1. Total bytes from the adapter (recursive walk).
    const totalBytes = await storage.getUsage()

    // 2. Live receipt references from Transaction. Per spec gotcha #1, a file
    //    is "live" if receiptUrl IS NOT NULL AND isDeleted = false.
    //    We don't constrain what receiptUrl looks like — it's a free-form URL
    //    (could be a local key, /api/receipt/<encoded>, or any external URL).
    //    F13 matches disk files ↔ DB references by **basename** so any URL form
    //    works (UUID filenames make collisions astronomically unlikely).
    const liveRows = await db.transaction.findMany({
      where: {
        receiptUrl: { not: null },
        isDeleted: false,
      },
      select: { receiptUrl: true },
    })
    const liveBasenames = new Set(
      liveRows.map((r) => basenameOf(r.receiptUrl)).filter((b): b is string => !!b),
    )

    // 3. Enumerate disk files via the adapter.
    const files = await storage.listAll()
    const activeFileCount = files.reduce((count, f) => {
      const base = basenameOf(f.key)
      return base && liveBasenames.has(base) ? count + 1 : count
    }, 0)
    const orphanCount = files.length - activeFileCount

    // 4. Oldest / newest by mtime.
    const oldest = files.length > 0 ? files.reduce((a, b) => (a.mtime < b.mtime ? a : b)) : null
    const newest = files.length > 0 ? files.reduce((a, b) => (a.mtime > b.mtime ? a : b)) : null

    return withCors(
      NextResponse.json({
        totalBytes,
        maxBytes: getStorageCapBytes(),
        usagePercent: usagePercentFor(totalBytes),
        fileCount: files.length,
        activeFileCount,
        orphanCount,
        oldestFile: oldest?.mtime.toISOString() ?? null,
        newestFile: newest?.mtime.toISOString() ?? null,
        banner: bannerFor(totalBytes),
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/storage/stats] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

/**
 * Take the last path segment of any URL or key. Works for:
 *   - "uploads/receipts/2026/07/uuid.jpg"  → "uuid.jpg"
 *   - "/api/receipt/uploads%2Freceipts%2F2026%2F07%2Fuuid.jpg" → "uuid.jpg"
 *   - "https://supabase.com/img/receipt/expense/uuid.jpg" → "uuid.jpg"
 *   - "uuid.jpg"  → "uuid.jpg"
 */
function basenameOf(input: string | null | undefined): string | null {
  if (!input) return null
  // Strip the URL prefix if present — keep only the pathname.
  let path = input
  try {
    path = new URL(input).pathname
  } catch {
    // not a URL — use as-is
  }
  // URL-decode (handles %2F, etc.) and take the last segment.
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    decoded = path
  }
  const parts = decoded.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : null
}
