// Cron job registry. Per docs/backend/features/14-cron.md § 1.3 + § 2.
//
// Single source of truth for the 9 jobs in the system. To add a new job:
//   1. Define the run() function (wherever it logically belongs).
//   2. Add a JobEntry to JOB_REGISTRY below.
//   3. If it's a scheduled job, schedule is honored by startScheduler().
//
// Per spec gotcha #9, this list is hardcoded on purpose — adding a job is a
// code change + deploy, which is the right gate for adding background work.

import type { PrismaClient } from '@prisma/client'
import { runAuditArchive } from '@/server/cron/audit-archive'
import { runStoragePrune } from '@/server/cron/storage-prune'

export interface JobResult {
  itemsProcessed?: number
}

export type JobFn = () => Promise<JobResult>

export interface JobEntry {
  /** Stable identifier used in /api/admin/cron/[jobName] and JobRun.jobName. */
  name: string
  /** Standard cron expression (5-field). Examples: "0 * * * *" hourly, "0 2 * * *" daily 02:00. */
  schedule: string
  /** Human-readable description for the admin UI. */
  scheduleHuman: string
  /** Feature doc reference (e.g. "12-audit"). */
  source: string
  /** Source file relative to server/. Used for "Open in editor" links in UI. */
  file: string
  /** When false, the job is skipped by the scheduler and manual runs return 409. */
  enabled: boolean
  /** Implementation. May throw — caller wraps in JobRun update. */
  run: JobFn
}

// Stub for jobs whose own feature has not shipped yet. Returns 0 items.
function stub(): Promise<JobResult> {
  return Promise.resolve({ itemsProcessed: 0 })
}

/**
 * The 9 registered jobs. Order matches docs/backend/features/14-cron.md § 2.
 *
 * Each entry's `run()` is either:
 *   - a real implementation (runAuditArchive, runStoragePrune)
 *   - a stub() until the feature ships
 */
export const JOB_REGISTRY: JobEntry[] = [
  {
    name: 'recurring-post',
    schedule: '0 * * * *',
    scheduleHuman: 'Hourly',
    source: '16-recurring',
    file: 'src/server/cron/recurring.ts',
    enabled: true,
    run: stub, // F16 ships next; run() wires to its cron entry.
  },
  {
    name: 'budget-check',
    schedule: '', // called from transaction handler, not scheduled
    scheduleHuman: 'On transaction create',
    source: '15-budgets',
    file: 'src/server/cron/budget-check.ts',
    enabled: true,
    run: stub,
  },
  {
    name: 'anomaly-detect',
    schedule: '', // called from transaction handler, not scheduled
    scheduleHuman: 'On transaction create',
    source: 'M5 task 5.7',
    file: 'src/server/cron/anomaly-detect.ts',
    enabled: true,
    run: stub,
  },
  {
    name: 'missing-close-check',
    schedule: '30 23 * * *',
    scheduleHuman: 'Daily 23:30',
    source: 'F10 (deferred)',
    file: 'src/server/cron/missing-close-check.ts',
    enabled: false, // disabled per F10 — no reminders
    run: stub,
  },
  {
    name: 'audit-archive',
    schedule: '0 3 1 * *',
    scheduleHuman: 'Monthly 1st 03:00',
    source: '12-audit',
    file: 'src/server/cron/audit-archive.ts',
    enabled: true,
    run: runAuditArchive, // real — from F12
  },
  {
    name: 'storage-prune',
    schedule: '0 3 * * 0',
    scheduleHuman: 'Weekly Sun 03:00',
    source: '13-storage',
    file: 'src/server/cron/storage-prune.ts',
    enabled: true,
    run: runStoragePrune, // real — from F13
  },
  {
    name: 'backup',
    schedule: '0 2 * * *',
    scheduleHuman: 'Daily 02:00',
    source: 'M4 task 4.3 (ops)',
    file: 'scripts/backup.sh',
    enabled: true,
    run: stub, // ops-script wrapper — placeholder until ops ships
  },
  {
    name: 'backup-verify',
    schedule: '0 4 * * 0',
    scheduleHuman: 'Weekly Sun 04:00',
    source: 'M4 task 4.4 (ops)',
    file: 'scripts/verify-backup.sh',
    enabled: true,
    run: stub,
  },
  {
    name: 'period-lock',
    schedule: '0 0 1 * *',
    scheduleHuman: 'Monthly 1st 00:00',
    source: '17-period-lock',
    file: 'src/server/cron/period-lock.ts',
    enabled: true,
    run: stub, // F17 ships next; run() wires to its cron entry.
  },
]

/**
 * Look up a job by name. Returns undefined if not registered.
 */
export function findJob(name: string): JobEntry | undefined {
  return JOB_REGISTRY.find((j) => j.name === name)
}

/**
 * Run a job by name. Throws if the job throws — the caller (route handler or
 * scheduler wrapper) records the failure in a JobRun row.
 */
export async function runJobByName(name: string): Promise<JobResult> {
  const job = findJob(name)
  if (!job) throw new Error(`job_not_registered: ${name}`)
  return job.run()
}
