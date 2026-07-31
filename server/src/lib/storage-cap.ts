// Storage cap + banner helper. Per docs/backend/features/13-storage.md § 1.2.
//
// STORAGE_CAP_BYTES env var with default 10 GB (per user direction).
// Banner thresholds: yellow at 80%, red at 95%.

const DEFAULT_CAP_BYTES = 10 * 1024 * 1024 * 1024 // 10 GB
const YELLOW_PERCENT = 80
const RED_PERCENT = 95

export function getStorageCapBytes(): number {
  const raw = process.env.STORAGE_CAP_BYTES
  if (!raw) return DEFAULT_CAP_BYTES
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP_BYTES
}

export type Banner = 'green' | 'yellow' | 'red'

export function bannerFor(totalBytes: number): Banner {
  const pct = Math.round((totalBytes / getStorageCapBytes()) * 100)
  if (pct >= RED_PERCENT) return 'red'
  if (pct >= YELLOW_PERCENT) return 'yellow'
  return 'green'
}

export function usagePercentFor(totalBytes: number): number {
  return Math.round((totalBytes / getStorageCapBytes()) * 100)
}
