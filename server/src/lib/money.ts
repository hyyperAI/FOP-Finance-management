// Money helpers. Per docs/backend/features/15-budgets.md § 1.5.
// Strict 2-decimal enforcement so amounts never drift (same gotcha as F11).

import { Prisma } from '@prisma/client'

/**
 * Parse a decimal string with up to 2 decimals into a Prisma.Decimal.
 * Throws on: non-string input, non-numeric, negative, more than 2 decimals.
 */
export function parseDecimal(input: string): Prisma.Decimal {
  if (typeof input !== 'string') {
    throw new Error('amount must be a string')
  }
  if (!/^\d+(\.\d{1,2})?$/.test(input)) {
    throw new Error('amount must be a positive number with up to 2 decimals')
  }
  return new Prisma.Decimal(input)
}
