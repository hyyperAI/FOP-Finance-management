// M5 stub: checkAnomaly. Returns null (no anomaly detected).
// Per docs/backend/features/05-transactions.md § 1.5 (M5 — not yet built).
// When M5 lands, this file will be replaced with the real implementation
// (compare new amount to user's 30-day median; flag if >3x).

export interface AnomalyInput {
  type: 'INTAKE' | 'EXPENSE'
  amount: string
  categoryId: string
  occurredAt: Date
  postedById: string
}

export interface AnomalyResult {
  reason: string
  zScore: number
}

export async function checkAnomaly(_input: AnomalyInput): Promise<AnomalyResult | null> {
  return null
}
