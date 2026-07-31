// Cron scheduler. Per docs/backend/features/14-cron.md § 1.5.
//
// Uses `node-cron` for in-process scheduling. Timezone is Asia/Karachi
// (per gotcha #5). All enabled jobs in JOB_REGISTRY are registered on boot.
//
// On server boot, also marks stale RUNNING JobRun rows (>1 hour old) as
// FAILED to prevent them from blocking future runs (per gotcha #2).
//
// Distributed-safe: only one process schedules. Per gotcha #3, check
// process.env.NODE_APP_INSTANCE === '0' in PM2 cluster mode.

import cron from 'node-cron'
import { db } from '@/lib/db'
import { JOB_REGISTRY } from './registry'

const SCHEDULER_TZ = 'Asia/Karachi'
const STALE_RUNNING_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour

/** Track which jobs are scheduled so we can avoid double-schedule in tests. */
let started = false

/**
 * Sweep stale RUNNING JobRun rows that never finished (crashed process).
 * Per gotcha #2.
 */
async function sweepStaleRunning(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_THRESHOLD_MS)
  const result = await db.jobRun.updateMany({
    where: { status: 'RUNNING', startedAt: { lt: cutoff } },
    data: {
      status: 'FAILED',
      finishedAt: new Date(),
      errorMessage: 'Marked FAILED on boot — previous run never finished (stale > 1h)',
    },
  })
  if (result.count > 0) {
    console.warn(`[cron] marked ${result.count} stale RUNNING JobRun(s) as FAILED`)
  }
  return result.count
}

/**
 * Execute one scheduled job invocation. Writes a JobRun row + updates it
 * when done. Mirrors the route handler's logic so manual + scheduled runs
 * produce identical records (per gotcha #6).
 */
export async function executeScheduled(jobName: string): Promise<void> {
  const job = JOB_REGISTRY.find((j) => j.name === jobName)
  if (!job || !job.enabled) return

  const jobRun = await db.jobRun.create({
    data: {
      jobName: job.name,
      startedAt: new Date(),
      status: 'RUNNING',
      triggeredBy: 'scheduler',
    },
  })
  try {
    const result = await job.run()
    await db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        finishedAt: new Date(),
        status: 'SUCCESS',
        itemsProcessed: result.itemsProcessed ?? 0,
      },
    })
  } catch (err) {
    await db.jobRun.update({
      where: { id: jobRun.id },
      data: {
        finishedAt: new Date(),
        status: 'FAILED',
        errorMessage: (err as Error).message.slice(0, 500),
      },
    })
    console.error(`[cron:${job.name}] failed:`, err)
  }
}

/**
 * Register all enabled jobs with node-cron. Idempotent (safe to call twice —
 * second call is a no-op). Per gotcha #5, timezone is Asia/Karachi.
 *
 * Call once at server boot. Wire from src/lib/server-init.ts or similar.
 */
export async function startScheduler(): Promise<void> {
  if (started) return
  started = true

  await sweepStaleRunning()

  let scheduledCount = 0
  for (const job of JOB_REGISTRY) {
    if (!job.enabled) continue
    if (!job.schedule) continue // empty schedule = handler-triggered, not cron
    if (!cron.validate(job.schedule)) {
      console.error(`[cron] invalid schedule for ${job.name}: "${job.schedule}"`)
      continue
    }
    cron.schedule(
      job.schedule,
      () => {
        executeScheduled(job.name).catch((err) =>
          console.error(`[cron:${job.name}] unexpected error:`, err),
        )
      },
      { timezone: SCHEDULER_TZ },
    )
    scheduledCount += 1
  }

  console.log(`[cron] scheduler started (${scheduledCount} jobs, tz=${SCHEDULER_TZ})`)
}

/**
 * Stop the scheduler. Primarily for tests — production rarely calls this.
 */
export function stopScheduler(): void {
  if (!started) return
  // node-cron's default export has a getTasks() helper for cleanup.
  for (const task of cron.getTasks()) {
    task.stop()
  }
  started = false
}
