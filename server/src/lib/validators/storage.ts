// Zod validator for the storage prune endpoint (Feature 13).
// Per docs/backend/features/13-storage.md § 1.4.

import { z } from 'zod'

export const PruneBodySchema = z
  .object({
    dryRun: z.boolean().optional().default(false),
  })
  .strict()

export type PruneBody = z.infer<typeof PruneBodySchema>
