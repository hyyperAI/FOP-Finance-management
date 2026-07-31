// POST /api/admin/storage/prune — delete orphan files (admin only).
// Per docs/backend/features/13-storage.md § 1.2.
//
// Supports `dryRun: true` to preview without deleting (spec § 1.2). Writes
// a `storage.prune` audit row on actual delete (NOT on dry-run, per gotcha #10).
//
// In-process mutex (pruneInProgress) blocks concurrent manual prunes within the
// same Node process. Per spec gotcha #4, multi-process deployments should use
// the JobRun table as a distributed lock — out of scope here.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { getStorage } from '@/lib/storage'
import { PruneBodySchema } from '@/lib/validators/storage'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// In-process mutex. Resets on process restart (acceptable per spec gotcha #4).
let pruneInProgress = false

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    if (pruneInProgress) {
      return withCors(
        NextResponse.json({ error: 'prune_already_running' }, { status: 409 }),
      )
    }

    // Parse body (default empty {} so no-body POST works).
    let body: unknown = {}
    if (req.headers.get('content-length') && req.headers.get('content-length') !== '0') {
      try {
        body = await req.json()
      } catch {
        return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
      }
    }
    let parsed
    try {
      parsed = PruneBodySchema.parse(body)
    } catch (err) {
      if (err instanceof ZodError) {
        return withCors(
          NextResponse.json(
            { error: 'validation_error', fields: err.flatten().fieldErrors },
            { status: 400 },
          ),
        )
      }
      throw err
    }
    const { dryRun } = parsed

    pruneInProgress = true
    try {
      const { orphans } = await findOrphans()

      if (dryRun) {
        return withCors(
          NextResponse.json({
            wouldDelete: orphans.length,
            wouldFreeBytes: orphans.reduce((s, f) => s + f.sizeBytes, 0),
            sampleOrphans: orphans.slice(0, 10).map((f) => f.key),
          }),
        )
      }

      // Actually delete. Per spec gotcha #3, one bad file shouldn't abort.
      const storage = getStorage()
      let bytesFreed = 0
      let filesDeleted = 0
      for (const f of orphans) {
        try {
          await storage.delete(f.key)
          bytesFreed += f.sizeBytes
          filesDeleted += 1
        } catch (err) {
          console.error('[storage.prune] failed to delete', f.key, err)
        }
      }

      // Audit row on actual delete (per gotcha #10, no audit on dry-run).
      try {
        await recordAudit(db, {
          actorId: admin.id,
          action: 'storage.prune',
          entityType: 'Storage',
          entityId: 'global',
          after: { filesDeleted, bytesFreed },
        })
      } catch (err) {
        // Audit failure shouldn't block — log and continue.
        console.error('[POST /api/admin/storage/prune] audit failed:', err)
      }

      return withCors(
        NextResponse.json({
          filesDeleted,
          bytesFreed,
          ranAt: new Date().toISOString(),
        }),
      )
    } finally {
      pruneInProgress = false
    }
  } catch (err) {
    console.error('[POST /api/admin/storage/prune] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

/**
 * Find files on disk that aren't referenced by any live Transaction.receiptUrl.
 * Shared between the manual POST and the cron stub (F14).
 *
 * Exported so `runStoragePrune()` in src/server/cron/storage-prune.ts can reuse
 * it. Internal callers in this file use it via the wrapper above.
 */
export async function findOrphans(): Promise<{ orphans: Awaited<ReturnType<ReturnType<typeof getStorage>['listAll']>>; liveBasenames: Set<string> }> {
  const storage = getStorage()
  const liveRows = await db.transaction.findMany({
    where: {
      receiptUrl: { not: null },
      status: { not: 'SOFT_DELETED' },
    },
    select: { receiptUrl: true },
  })
  const liveBasenames = new Set(
    liveRows.map((r) => basenameOf(r.receiptUrl)).filter((b): b is string => !!b),
  )
  const files = await storage.listAll()
  const orphans = files.filter((f) => {
    const fileBasename = basenameOf(f.key)
    return fileBasename ? !liveBasenames.has(fileBasename) : true
  })
  return { orphans, liveBasenames }
}

function basenameOf(input: string | null | undefined): string | null {
  if (!input) return null
  let path = input
  try {
    path = new URL(input).pathname
  } catch {
    // not a URL — use as-is
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    decoded = path
  }
  const parts = decoded.split('/').filter(Boolean)
  return parts.length > 0 ? parts[parts.length - 1] : null
}
