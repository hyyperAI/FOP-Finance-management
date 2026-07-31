// POST /api/admin/cron/[jobName]/run — manually trigger a registered job.
// Per docs/backend/features/14-cron.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { findJob, runJobByName } from '@/server/cron/registry'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(_req: Request, { params }: { params: { jobName: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const job = findJob(params.jobName)
    if (!job) {
      return withCors(
        NextResponse.json(
          { error: 'job_not_found', jobName: params.jobName },
          { status: 404 },
        ),
      )
    }
    if (!job.enabled) {
      return withCors(
        NextResponse.json(
          { error: 'job_disabled', jobName: params.jobName },
          { status: 409 },
        ),
      )
    }

    // Concurrency guard: any RUNNING JobRun for this jobName blocks.
    const inProgress = await db.jobRun.findFirst({
      where: { jobName: params.jobName, finishedAt: null },
    })
    if (inProgress) {
      return withCors(
        NextResponse.json(
          { error: 'job_already_running', jobRunId: inProgress.id },
          { status: 409 },
        ),
      )
    }

    // Create JobRun row up-front so the registry view sees the run start.
    const jobRun = await db.jobRun.create({
      data: {
        jobName: params.jobName,
        startedAt: new Date(),
        status: 'RUNNING',
        triggeredBy: 'manual',
        triggeredById: admin.id,
      },
    })

    try {
      const result = await runJobByName(params.jobName)
      const finished = await db.jobRun.update({
        where: { id: jobRun.id },
        data: {
          finishedAt: new Date(),
          status: 'SUCCESS',
          itemsProcessed: result.itemsProcessed ?? 0,
        },
      })

      // Audit success (per gotcha — manual runs emit audit; scheduled don't).
      try {
        await recordAudit(db, {
          actorId: admin.id,
          action: 'cron.run_manual',
          entityType: 'JobRun',
          entityId: finished.id,
          after: {
            jobName: params.jobName,
            status: 'SUCCESS',
            itemsProcessed: finished.itemsProcessed,
          },
        })
      } catch (err) {
        console.error('[POST /api/admin/cron/[jobName]/run] audit failed:', err)
      }

      return withCors(NextResponse.json({ jobRun: serialize(finished) }))
    } catch (err) {
      const failed = await db.jobRun.update({
        where: { id: jobRun.id },
        data: {
          finishedAt: new Date(),
          status: 'FAILED',
          errorMessage: (err as Error).message.slice(0, 500),
        },
      })

      try {
        await recordAudit(db, {
          actorId: admin.id,
          action: 'cron.run_manual',
          entityType: 'JobRun',
          entityId: failed.id,
          after: {
            jobName: params.jobName,
            status: 'FAILED',
            error: failed.errorMessage,
          },
        })
      } catch (auditErr) {
        console.error('[POST /api/admin/cron/[jobName]/run] audit failed:', auditErr)
      }

      // 503 = job ran but failed (per gotcha #7). UI can tell apart from 200.
      return withCors(
        NextResponse.json({ jobRun: serialize(failed) }, { status: 503 }),
      )
    }
  } catch (err) {
    console.error('[POST /api/admin/cron/[jobName]/run] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function serialize(r: {
  id: string
  jobName: string
  startedAt: Date
  finishedAt: Date | null
  status: string
  itemsProcessed: number
  errorMessage: string | null
  triggeredBy: string
}) {
  return {
    id: r.id,
    jobName: r.jobName,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    status: r.status,
    itemsProcessed: r.itemsProcessed,
    errorMessage: r.errorMessage,
    triggeredBy: r.triggeredBy,
  }
}
