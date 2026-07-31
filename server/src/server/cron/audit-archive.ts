// Audit archive cron. Per docs/backend/features/12-audit.md § 1.5 + § 3.
// Scheduled to run monthly — moves rows older than AUDIT_RETENTION_YEARS
// from AuditLog to AuditLogArchive.
//
// NOTE: F12 stubs the function. F14 (cron) wires it into the scheduler.
// The function is exported and callable directly for tests / one-off runs.

import { db } from '@/lib/db'

const DEFAULT_RETENTION_YEARS = 7
const BATCH_SIZE = 1000

export interface AuditArchiveResult {
  moved: number
  retentionYears: number
  cutoffDate: Date
}

/**
 * Move all AuditLog rows older than the retention cutoff to AuditLogArchive.
 * Per spec gotcha #5: uses `occurredAt` (not archivedAt) to decide retention.
 * Per gotcha #10: insert into archive first, then delete from AuditLog,
 * inside a single transaction so a crash never duplicates rows.
 */
export async function runAuditArchive(): Promise<AuditArchiveResult> {
  const retentionYears = parseInt(process.env.AUDIT_RETENTION_YEARS ?? String(DEFAULT_RETENTION_YEARS), 10)
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - retentionYears)

  let totalMoved = 0

  // Process in batches of BATCH_SIZE inside transactions so we don't lock
  // the AuditLog table for long periods.
  while (true) {
    const rows = await db.auditLog.findMany({
      where: { occurredAt: { lt: cutoff } },
      orderBy: { occurredAt: 'asc' },
      take: BATCH_SIZE,
    })

    if (rows.length === 0) break

    await db.$transaction(async (tx) => {
      await tx.auditLogArchive.createMany({
        data: rows.map((r) => ({
          id: r.id,
          actorId: r.actorId,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          before: r.before,
          after: r.after,
          reason: r.reason,
          ip: r.ip,
          userAgent: r.userAgent,
          occurredAt: r.occurredAt,
        })),
      })
      await tx.auditLog.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      })
    })

    totalMoved += rows.length
    if (rows.length < BATCH_SIZE) break
  }

  return { moved: totalMoved, retentionYears, cutoffDate: cutoff }
}