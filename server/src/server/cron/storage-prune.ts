// Storage prune cron entry. Per docs/backend/features/13-storage.md § 1.5.
//
// Runs the same logic as POST /api/admin/storage/prune with dryRun:false.
// The system actor is recorded as actorId:null in the audit row.
//
// F14 (cron) wires this into the scheduler at `0 3 * * 0` (Sun 03:00 local).
// For now the function is callable directly from tests / one-off runs.

import { db } from '@/lib/db'
import { getStorage } from '@/lib/storage'
import { findOrphans } from '@/app/api/admin/storage/prune/route'
import { recordAudit } from '@/lib/audit'

export interface StoragePruneResult {
  filesDeleted: number
  bytesFreed: number
  ranAt: string
}

export async function runStoragePrune(): Promise<StoragePruneResult> {
  const storage = getStorage()
  const { orphans } = await findOrphans()

  let bytesFreed = 0
  let filesDeleted = 0
  for (const f of orphans) {
    try {
      await storage.delete(f.key)
      bytesFreed += f.sizeBytes
      filesDeleted += 1
    } catch (err) {
      // Same resilience as the manual endpoint — one bad file shouldn't abort.
      console.error('[cron storage-prune] failed to delete', f.key, err)
    }
  }

  // Audit row even when filesDeleted === 0 (per gotcha #7).
  try {
    await recordAudit(db, {
      actorId: null, // system actor for cron-fired actions
      action: 'storage.prune',
      entityType: 'Storage',
      entityId: 'global',
      after: { filesDeleted, bytesFreed, source: 'cron' },
    })
  } catch (err) {
    console.error('[cron storage-prune] audit failed:', err)
  }

  return {
    filesDeleted,
    bytesFreed,
    ranAt: new Date().toISOString(),
  }
}
