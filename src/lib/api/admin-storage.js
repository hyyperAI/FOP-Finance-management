/**
 * Admin — storage management helpers.
 * API contract: docs/backend/api.md §16 Admin — Storage.
 */

import { get, post } from '../api.js'

/**
 * GET /api/admin/storage/stats
 *
 * @returns {Promise<StorageStats>}
 *
 * Shape:
 *   { totalBytes, maxBytes, usagePercent, fileCount, activeFileCount,
 *     orphanCount, oldestFile, newestFile, banner }
 */
export function storageStats() {
  return get('/api/admin/storage/stats')
}

/**
 * POST /api/admin/storage/prune
 *
 * @param {{ dryRun?: boolean }} [opts]
 * @param {boolean} [opts.dryRun]   omit to perform real deletion
 *
 * Returns either:
 *   { wouldDelete: number, wouldFreeBytes: number, sampleOrphans: string[] }
 * or:
 *   { filesDeleted: number, bytesFreed: number, ranAt: string }
 *
 * Throws ApiError with code 'prune_already_running' (HTTP 409) if a prune is in flight.
 */
export function pruneStorage(opts = {}) {
  return post('/api/admin/storage/prune', opts)
}
