// Reconciliation math. Per docs/backend/features/06-close-day.md § 1.2 algorithm.
//
// Payment methods (spec gotcha #3): INTAKE adds, EXPENSE subtracts.
//   5000 INTAKE cash + 200 EXPENSE cash → expected CASH = 4800.
//
// All values use round2() before storage (spec gotcha #13).

import { db } from '@/lib/db'

export const PAYMENT_METHODS = ['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'CARD'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type ByMethod = Record<PaymentMethod, number>

/** Round a number to 2 decimal places. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Sum a user's POSTED transactions for a day, signed (INTAKE +, EXPENSE −). */
export async function calculateExpected(
  userId: string,
  date: string, // YYYY-MM-DD
): Promise<ByMethod> {
  const startOfDay = new Date(`${date}T00:00:00.000Z`)
  const endOfDay = new Date(`${date}T23:59:59.999Z`)

  const transactions = await db.transaction.findMany({
    where: {
      postedById: userId,
      occurredAt: { gte: startOfDay, lte: endOfDay },
      status: 'POSTED',
      isDeleted: false,
    },
    select: { type: true, amount: true, paymentMethod: true },
  })

  const expected: ByMethod = {
    CASH: 0,
    BANK: 0,
    JAZZCASH: 0,
    EASYPAISA: 0,
    CARD: 0,
  }

  for (const t of transactions) {
    const amount = Number(t.amount)
    if (!Number.isFinite(amount)) continue
    const signed = t.type === 'INTAKE' ? amount : -amount
    if (t.paymentMethod in expected) {
      const method = t.paymentMethod as PaymentMethod
      expected[method] = round2(expected[method] + signed)
    }
  }

  return expected
}

/** counted - expected per method. hasVariance = any method variance !== 0. */
export function calculateVariance(
  counted: ByMethod,
  expected: ByMethod,
): { varianceByMethod: ByMethod; hasVariance: boolean } {
  const varianceByMethod: ByMethod = {
    CASH: 0,
    BANK: 0,
    JAZZCASH: 0,
    EASYPAISA: 0,
    CARD: 0,
  }
  let hasVariance = false
  for (const method of PAYMENT_METHODS) {
    varianceByMethod[method] = round2(counted[method] - expected[method])
    if (varianceByMethod[method] !== 0) hasVariance = true
  }
  return { varianceByMethod, hasVariance }
}

/** Sum a ByMethod object to a single number, rounded. */
export function totalOf(m: ByMethod): number {
  return round2(Object.values(m).reduce((a, b) => a + b, 0))
}
