// Audit log writer. Always called inside the mutation's DB transaction (per
// docs/backend/features/01-auth.md gotcha #5). The `tx` parameter is the
// Prisma transaction client — pass it from your `db.$transaction(async (tx) => ...)`.

import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = Prisma.TransactionClient | PrismaClient

/** Field names that must never appear in audit `before`/`after` JSON. */
const SECRET_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'tokens',
  'secret',
  'secrets',
  'apiKey',
  'api_key',
  'privateKey',
  'private_key',
  'accessToken',
  'refreshToken',
])

/**
 * Deep-clone + redact known secret fields from an object.
 * Replaces values for any key in SECRET_KEYS (case-sensitive) with the literal
 * "[REDACTED]" string. Recurses into nested objects and arrays.
 * Returns the original value unchanged for non-objects.
 */
export function redactSecrets(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item))
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.has(k)) {
        result[k] = '[REDACTED]'
      } else {
        result[k] = redactSecrets(v)
      }
    }
    return result
  }
  return value
}

export interface AuditInput {
  actorId: string
  action: string // e.g. "auth.login"
  entityType: string // e.g. "User"
  entityId: string
  before?: unknown
  after?: unknown
  reason?: string
  ip?: string
  userAgent?: string
}

export async function recordAudit(tx: Tx, input: AuditInput): Promise<void> {
  const before = redactSecrets(input.before)
  const after = redactSecrets(input.after)
  await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: before === undefined ? null : JSON.stringify(before),
      after: after === undefined ? null : JSON.stringify(after),
      reason: input.reason ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}
