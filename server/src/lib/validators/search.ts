// Zod validators for the admin search endpoint (Feature 08).
// Per docs/backend/features/08-search.md § 1.4.

import { z } from 'zod'

const cuidLike = z.string().min(20).max(40)
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')

export const SearchFiltersSchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    categoryIds: z.array(cuidLike).optional(),
    subCategoryIds: z.array(cuidLike).optional(),
    description: z.string().max(200).optional(),
    paymentMethods: z
      .array(z.enum(['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'CARD']))
      .optional(),
    userIds: z.array(cuidLike).optional(),
    type: z.enum(['INTAKE', 'EXPENSE']).optional(),
    minAmount: z.number().nonnegative().optional(),
    maxAmount: z.number().nonnegative().optional(),
    status: z.enum(['POSTED', 'REVERSED', 'SOFT_DELETED']).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
  })
  .strict()

/**
 * Parse URLSearchParams from a Next.js request URL into the SearchFilters shape.
 *   - Repeated keys: `?categoryIds=a&categoryIds=b` → ['a', 'b']
 *   - Comma-separated: `?categoryIds=a,b`             → ['a', 'b']
 *   - Numeric strings: `minAmount`, `maxAmount`, `page`, `pageSize`
 *   - Other: passed through as string
 */
export function parseSearchFilters(searchParams: URLSearchParams): z.infer<typeof SearchFiltersSchema> {
  const obj: Record<string, unknown> = {}

  for (const [key, raw] of searchParams) {
    if (key === 'categoryIds' || key === 'subCategoryIds' || key === 'userIds') {
      // Repeated keys: searchParams.getAll returns the array; we also accept CSV.
      const repeated = searchParams.getAll(key)
      const all: string[] = []
      for (const v of repeated) {
        for (const piece of v.split(',')) {
          const trimmed = piece.trim()
          if (trimmed) all.push(trimmed)
        }
      }
      obj[key] = all
    } else if (key === 'paymentMethods') {
      const repeated = searchParams.getAll(key)
      const all: string[] = []
      for (const v of repeated) {
        for (const piece of v.split(',')) {
          const trimmed = piece.trim()
          if (trimmed) all.push(trimmed)
        }
      }
      obj[key] = all
    } else if (key === 'minAmount' || key === 'maxAmount') {
      const n = Number(raw)
      if (Number.isFinite(n)) obj[key] = n
    } else if (key === 'page' || key === 'pageSize') {
      const n = Number(raw)
      if (Number.isFinite(n)) obj[key] = n
    } else {
      obj[key] = raw
    }
  }

  return SearchFiltersSchema.parse(obj)
}

export type SearchFilters = z.infer<typeof SearchFiltersSchema>