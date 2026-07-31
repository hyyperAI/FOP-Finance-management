// Zod validator for the cron endpoints (Feature 14).
// Per docs/backend/features/14-cron.md § 1.4. No body validators needed.

import { z } from 'zod'

export const CronListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    since: z.string().datetime().optional(),
  })
  .strict()

export type CronListQuery = z.infer<typeof CronListQuerySchema>
