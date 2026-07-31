// Zod validators for transaction endpoints.
// Per docs/backend/features/05-transactions.md § 1.4.

import { z } from 'zod'

const cuidLike = z.string().min(20).max(40)
const hexColor = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color (e.g. #RRGGBB)')

// Money: decimal string with up to 2 fractional digits, max 15 total digits.
const moneyString = z
  .string()
  .regex(/^\d{1,13}(\.\d{1,2})?$/, 'Amount must be a decimal string with up to 2 fractional digits')
  .refine((s) => parseFloat(s) >= 0, 'Amount must be non-negative')

export const CreateTransactionSchema = z.object({
  type: z.enum(['INTAKE', 'EXPENSE']),
  amount: moneyString,
  vendor: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  paymentMethod: z.enum(['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'CARD']).default('CASH'),
  occurredAt: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/))
    .transform((s) => new Date(s)),
  categoryId: cuidLike,
  subCategoryId: cuidLike.optional(),
  departmentId: cuidLike.optional(),
  receiptUrl: z.string().min(1).optional(), // accepts URL or storage key path
  notes: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  idempotencyKey: z.string().min(8).max(100).optional(),
})

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>

// List query — most fields are optional; Prisma is forgiving with strings.
export const ListTransactionsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(['INTAKE', 'EXPENSE']).optional(),
  categoryId: cuidLike.optional(),
  subCategoryId: cuidLike.optional(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  periodKey: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  postedById: cuidLike.optional(),
  min: z.string().optional(),
  max: z.string().optional(),
  q: z.string().optional(),
  page: z
    .union([z.number(), z.string()])
    .transform((v) => Math.max(1, parseInt(String(v), 10) || 1))
    .optional(),
  pageSize: z
    .union([z.number(), z.string()])
    .transform((v) => Math.min(100, Math.max(1, parseInt(String(v), 10) || 25)))
    .optional(),
  scope: z.enum(['all', 'mine']).optional(),
})

export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>
