// Zod validators for the audit endpoints (Feature 12).
// Per docs/backend/features/12-audit.md § 1.4.

import { z } from 'zod'

/**
 * pageSize must be one of these exact values to prevent accidental
 * `?pageSize=10000` memory blowups (spec gotcha #8).
 */
const PAGE_SIZE_VALUES = [10, 25, 50, 100] as const

/**
 * Repeated keys: `?actions=a&actions=b` → ['a', 'b'].
 * Comma-separated: `?actions=a,b`             → ['a', 'b'].
 */
function splitMulti(sp: URLSearchParams, key: string): string[] {
  const out: string[] = []
  for (const v of sp.getAll(key)) {
    for (const piece of v.split(',')) {
      const trimmed = piece.trim()
      if (trimmed) out.push(trimmed)
    }
  }
  return out
}

export const ALLOWED_PAGE_SIZES = PAGE_SIZE_VALUES

export const ListAuditQuerySchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    actorId: z.string().min(20).max(40).optional(),
    actions: z.array(z.string().min(1)).optional(),
    entityTypes: z.array(z.string().min(1)).optional(),
    entityId: z.string().min(20).max(40).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z
      .number()
      .int()
      .refine((n) => PAGE_SIZE_VALUES.includes(n as 10 | 25 | 50 | 100), {
        message: 'pageSize must be one of 10, 25, 50, 100',
      })
      .default(25),
  })
  .refine(
    (d) => !(d.from && d.to) || new Date(d.from) <= new Date(d.to),
    { message: 'from must be ≤ to', path: ['from'] },
  )

export const ExportAuditBodySchema = z
  .object({
    format: z.literal('csv'),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    actorId: z.string().min(20).max(40).optional(),
    actions: z.array(z.string().min(1)).optional(),
    entityTypes: z.array(z.string().min(1)).optional(),
    entityId: z.string().min(20).max(40).optional(),
  })
  .refine(
    (d) => !(d.from && d.to) || new Date(d.from) <= new Date(d.to),
    { message: 'from must be ≤ to', path: ['from'] },
  )

/** Parse URLSearchParams into the list shape. */
export function parseListAuditQuery(sp: URLSearchParams): z.infer<typeof ListAuditQuerySchema> {
  const obj: Record<string, unknown> = {}
  for (const [key, raw] of sp) {
    if (key === 'actions' || key === 'entityTypes') {
      obj[key] = splitMulti(sp, key)
    } else if (key === 'page' || key === 'pageSize') {
      const n = Number(raw)
      if (Number.isFinite(n)) obj[key] = n
    } else {
      obj[key] = raw
    }
  }
  return ListAuditQuerySchema.parse(obj)
}