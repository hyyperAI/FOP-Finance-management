// Zod validators for the notifications endpoints (Feature 18).
// Per docs/backend/features/18-notifications.md § 1.4.

import { z } from 'zod'

// Per spec — list of supported Alert.type values.
// New types require schema + validator + serialize updates.
export const AlertTypes = [
  'BUDGET_THRESHOLD_80',
  'BUDGET_EXCEEDED_100',
  'ANOMALY_AMOUNT',
  'MISSING_DAILY_CLOSE',
  'PERIOD_NOT_CLOSED',
] as const

export const ListNotificationsQuerySchema = z
  .object({
    isRead: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'boolean' ? v : v === 'true'))
      .optional(),
    type: z.enum(AlertTypes).optional(),
    limit: z.coerce
      .number()
      .int()
      .refine((n) => [10, 25, 50].includes(n), {
        message: 'limit must be one of 10, 25, 50',
      })
      .default(25),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()

export const PatchNotificationBodySchema = z
  .object({
    isRead: z.boolean(),
  })
  .strict()

export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>
export type PatchNotificationBody = z.infer<typeof PatchNotificationBodySchema>
