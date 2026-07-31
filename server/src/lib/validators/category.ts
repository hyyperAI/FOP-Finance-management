// Zod validators for the admin category endpoints.
// Per docs/backend/features/03-categories-admin.md § 1.4.

import { z } from 'zod'

// Accept both hex colors (#RRGGBB) and token names (Brand, Success, etc.)
const colorValue = z.union([
  z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color (e.g. #RRGGBB)'),
  z.enum(['Brand', 'Success', 'Danger', 'Warning', 'Info', 'Neutral']),
])
// Permissive cuid check (Prisma's cuid() can be cuid or cuid2)
const cuidLike = z.string().min(20).max(40)

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['INTAKE', 'EXPENSE']),
  color: colorValue.optional(),
  icon: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().default(false),
  departmentId: cuidLike.optional(),
})

export const UpdateCategorySchema = z
  .object({
    name: z.string().min(1).max(50).optional(),
    type: z.enum(['INTAKE', 'EXPENSE']).optional(),
    color: colorValue.optional(),
    icon: z.string().max(50).optional(),
    description: z.string().max(500).optional(),
    isActive: z.boolean().optional(),
    departmentId: cuidLike.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

// List query schema. Coerce booleans from query string ("true"/"false").
export const ListCategoriesQuerySchema = z.object({
  type: z.enum(['INTAKE', 'EXPENSE']).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional(),
  departmentId: cuidLike.optional(),
})

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>
