// Zod validators for the sub-category endpoints.
// Per docs/backend/features/04-sub-categories.md § 1.4.
//
// ⚠️ Critical: RenameSubCategorySchema uses .strict() so that PATCH with
// any non-name field is rejected with 400. Without it, sending
// {name: "X", color: "red"} would silently update only `name` and ignore
// `color` — a spec gotcha (#1) that we explicitly avoid.

import { z } from 'zod'

const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color (e.g. #RRGGBB)')
  .optional()

// Permissive cuid check (Prisma's cuid() can be cuid or cuid2)
const cuidLike = z.string().min(20).max(40)

export const CreateSubCategorySchema = z.object({
  name: z.string().min(1).max(50),
  parentId: cuidLike,
  color: hexColor,
  icon: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
})

// `.strict()` rejects unknown keys. Sending {name, color} → 400.
export const RenameSubCategorySchema = z
  .object({
    name: z.string().min(1).max(50),
  })
  .strict()

// List query schema. Coerce booleans from query string.
export const ListSubCategoriesQuerySchema = z.object({
  mine: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  parentId: cuidLike.optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
})

export type CreateSubCategoryInput = z.infer<typeof CreateSubCategorySchema>
export type RenameSubCategoryInput = z.infer<typeof RenameSubCategorySchema>
