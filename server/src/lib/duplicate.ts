// M5 stub: checkFuzzyDuplicate. Returns null (no duplicate detected).
// Per docs/backend/features/05-transactions.md § 1.5 (M5 — not yet built).
// When M5 lands, this file will be replaced with the real implementation
// (compare to last-7-days transactions with same vendor + similar amount).

export interface FuzzyDuplicateInput {
  type: 'INTAKE' | 'EXPENSE'
  amount: string
  vendor: string | null
  occurredAt: Date
  postedById: string
}

export interface FuzzyDuplicateResult {
  reason: string
  matchedTransactionId: string
}

export async function checkFuzzyDuplicate(
  _input: FuzzyDuplicateInput,
): Promise<FuzzyDuplicateResult | null> {
  return null
}
