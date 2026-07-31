// Zod validators for the dashboard endpoints (Feature 09).
// Per docs/backend/features/09-dashboard.md § 1.4.

import { z } from 'zod'

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')

export const DashboardQuerySchema = z
  .object({
    period: z
      .enum(['day', 'week', 'month', 'quarter', 'year', 'custom'])
      .default('month'),
    startDate: dateOnly.optional(),
    endDate: dateOnly.optional(),
  })
  .refine((data) => data.period !== 'custom' || (data.startDate && data.endDate), {
    message: 'Custom period requires both startDate and endDate',
    path: ['period'],
  })

export type DashboardQuery = z.infer<typeof DashboardQuerySchema>