// Zod validators for the admin user endpoints.
// Per docs/backend/features/02-users-admin.md § 1.4.

import { z } from 'zod'

// Prisma's `cuid()` is CUID2; we use a permissive cuid-shaped regex that
// accepts the cuid() default. CUIDs start with a lowercase letter.
const cuid = z.string().min(20).max(40)

const passwordSchema = z
  .string()
  .min(8, 'Must be at least 8 characters')
  .max(100)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number')

const phoneSchema = z
  .union([z.string(), z.null()])
  .transform((v) => (v === null || v === '' ? undefined : v))
  .pipe(
    z
      .string()
      .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone format')
      .optional()
  )
  .optional()

export const CreateUserSchema = z
  .object({
    email: z.string().email(),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscore only'),
    name: z.string().min(1).max(100),
    phone: phoneSchema,
    role: z.enum(['ADMIN', 'USER']),
    categoryIds: z.array(cuid).default([]),
    password: passwordSchema,
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.role === 'ADMIN' || data.categoryIds.length >= 1, {
    message: 'At least one category required for USER role',
    path: ['categoryIds'],
  })

export const UpdateUserSchema = z
  .object({
    email: z.string().email().optional(),
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/)
      .optional(),
    name: z.string().min(1).max(100).optional(),
    phone: phoneSchema,
    role: z.enum(['ADMIN', 'USER']).optional(),
    categoryIds: z.array(cuid).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
