// Zod validators for close-day endpoints.
// Per docs/backend/features/06-close-day.md § 1.4.

import { z } from 'zod'
import { PAYMENT_METHODS } from '@/lib/reconciliation'

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD required')

// countedByMethod: exactly 5 keys, all non-negative. .strict() rejects extras.
const countedByMethodSchema = z
  .object({
    CASH: z.number().nonnegative(),
    BANK: z.number().nonnegative(),
    JAZZCASH: z.number().nonnegative(),
    EASYPAISA: z.number().nonnegative(),
    CARD: z.number().nonnegative(),
  })
  .strict()

export const CreateDayCloseSchema = z.object({
  closeDate: dateSchema,
  countedByMethod: countedByMethodSchema,
  notes: z.string().max(500).optional(),
})

// Admin override — reason is REQUIRED, min 20 chars (spec gotcha #6).
export const AdminCreateDayCloseSchema = z
  .object({
    closeDate: dateSchema,
    countedByMethod: countedByMethodSchema,
    notes: z.string().max(500).optional(),
    reason: z.string(),
  })
  .refine((data) => data.reason.trim().length >= 20, {
    message: 'Reason is required and must be at least 20 characters',
    path: ['reason'],
  })

export const CloseDayQuerySchema = z.object({
  date: dateSchema,
  userId: z.string().min(20).max(40).optional(),
})

export const PAYMENT_METHOD_KEYS = PAYMENT_METHODS
