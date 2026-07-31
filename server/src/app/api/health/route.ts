// GET /api/health — per docs/backend/features/19-health.md
// Public uptime/load-balancer probe. 3 parallel checks: db, storage, lastBackupAge.
// No auth (gotcha #1). Force-dynamic (gotcha #5). < 500ms (gotcha #7).

import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

import { db } from '@/lib/db'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

// Per spec gotcha #4: "never" if no backup, "unknown" if dir unreadable.
// We use JobRun.lastSuccessfulBackup per our spec decision (deviates from spec
// §1.2's BACKUP_DIR readdir since F14's backup cron is still a stub).
const STALE_BACKUP_MS = 48 * 60 * 60 * 1000 // 48 hours

export async function OPTIONS() {
  return preflight()
}

export async function GET() {
  // Parallel per spec gotcha #7 (< 500ms)
  const [dbStatus, storageStatus, lastBackupAge] = await Promise.all([
    checkDb(),
    checkStorage(),
    checkLastBackupAge(),
  ])

  const checks = { db: dbStatus, storage: storageStatus, lastBackupAge }
  const errorCount = [dbStatus, storageStatus, lastBackupAge].filter((v) => v === 'error').length
  const status: 'healthy' | 'degraded' | 'unhealthy' =
    errorCount === 0 ? 'healthy' : errorCount >= 2 ? 'unhealthy' : 'degraded'

  return withCors(
    NextResponse.json(
      { status, checks, timestamp: new Date().toISOString() },
      { status: status === 'healthy' ? 200 : 503 },
    ),
  )
}

async function checkDb(): Promise<'ok' | 'error'> {
  try {
    // Per spec gotcha #2 — SELECT 1 is the cheapest possible ping.
    await db.$queryRaw`SELECT 1`
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkStorage(): Promise<'ok' | 'error'> {
  try {
    // Per spec gotcha #3 — write+delete a tiny dotfile in public/uploads/.
    const testFile = path.join(process.cwd(), 'public', 'uploads', '.health-check')
    await fs.writeFile(testFile, 'ok')
    await fs.unlink(testFile)
    return 'ok'
  } catch {
    return 'error'
  }
}

async function checkLastBackupAge(): Promise<string> {
  try {
    const lastBackup = await db.jobRun.findFirst({
      where: { jobName: 'backup', status: 'SUCCESS' },
      orderBy: { startedAt: 'desc' },
    })
    if (!lastBackup) return 'never'
    const ageMs = Date.now() - lastBackup.startedAt.getTime()
    if (ageMs > STALE_BACKUP_MS) return 'error'
    return formatAge(ageMs)
  } catch {
    return 'unknown'
  }
}

/** Per spec § 1.2 — hours < 24 use "hour(s)", otherwise "day(s)". */
export function formatAge(ms: number): string {
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}
