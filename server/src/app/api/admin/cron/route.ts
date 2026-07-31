// GET /api/admin/cron — list all registered jobs + their recent runs.
// Per docs/backend/features/14-cron.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { JOB_REGISTRY } from '@/server/cron/registry'
import { CronListQuerySchema } from '@/lib/validators/cron'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const url = new URL(req.url)
    let q
    try {
      // Coerce arrays like `actions=a&actions=b` — not used here but kept consistent.
      const obj: Record<string, unknown> = {}
      for (const [key, raw] of url.searchParams) {
        if (key === 'limit') {
          const n = Number(raw)
          if (Number.isFinite(n)) obj.limit = n
        } else {
          obj[key] = raw
        }
      }
      q = CronListQuerySchema.parse(obj)
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

    // Lower bound on startedAt. Default: last 7 days.
    const sinceDate = q.since
      ? new Date(q.since)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Pull `limit * jobCount` rows so we can slice per-job without a second query.
    // Slight over-fetch (multiplier) is acceptable for small job counts.
    const recentRuns = await db.jobRun.findMany({
      where: { startedAt: { gte: sinceDate } },
      orderBy: { startedAt: 'desc' },
      take: q.limit * JOB_REGISTRY.length,
    })

    // Group by jobName
    const runsByJob = new Map<string, typeof recentRuns>()
    for (const run of recentRuns) {
      const arr = runsByJob.get(run.jobName) ?? []
      arr.push(run)
      runsByJob.set(run.jobName, arr)
    }

    return withCors(
      NextResponse.json({
        jobs: JOB_REGISTRY.map((job) => {
          const runs = (runsByJob.get(job.name) ?? []).slice(0, q.limit)
          return {
            name: job.name,
            schedule: job.schedule,
            scheduleHuman: job.scheduleHuman,
            source: job.source,
            file: job.file,
            enabled: job.enabled,
            lastRun: runs[0]
              ? {
                  id: runs[0].id,
                  startedAt: runs[0].startedAt.toISOString(),
                  finishedAt: runs[0].finishedAt?.toISOString() ?? null,
                  status: runs[0].status,
                  itemsProcessed: runs[0].itemsProcessed,
                  errorMessage: runs[0].errorMessage,
                  triggeredBy: runs[0].triggeredBy,
                }
              : null,
          }
        }),
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/cron] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
