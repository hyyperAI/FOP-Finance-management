// Zod validators for the budgets endpoints (Feature 15).
// Per docs/backend/features/15-budgets.md § 1.4.

import { z } from 'zod'

const periodKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'periodKey must be YYYY-MM')

export const CreateBudgetSchema = z
  .object({
    categoryId: z.string().min(20).max(40),
    periodKey: periodKeySchema,
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'amount must be positive with up to 2 decimals'),
    currency: z.string().length(3).optional().default('PKR'),
  })
  .strict()

export const UpdateBudgetSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'amount must be positive with up to 2 decimals')
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, { message: 'at least one field required' })

export const ListBudgetsQuerySchema = z
  .object({
    period: periodKeySchema.optional(),
    includeInactive: z
      .union([z.boolean(), z.string()])
      .transform((v) => v === true || v === 'true')
      .optional()
      .default(false),
  })
  .strict()

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>
export type ListBudgetsQuery = z.infer<typeof ListBudgetsQuerySchema>
