// Static UI enum for payment methods.
// Extracted from src/lib/mock-data.js during Phase J cleanup.
// NOTE: the backend's transaction endpoint enforces this exact set of values;
// if the backend grows new methods, add them here so the frontend UI keeps up.

export const PAYMENT_METHODS = [
  { value: 'CASH',      label: 'Cash',      ariaLabel: 'Cash' },
  { value: 'BANK',      label: 'Bank',      ariaLabel: 'Bank transfer' },
  { value: 'JAZZCASH',  label: 'JazzCash',  ariaLabel: 'JazzCash' },
  { value: 'EASYPAISA', label: 'EasyPaisa', ariaLabel: 'EasyPaisa' },
  { value: 'CARD',      label: 'Card',      ariaLabel: 'Card' },
]

/**
 * Look up a human-readable label for a payment-method value.
 * Falls back to the raw value if no match.
 */
export function paymentMethodLabel(value) {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value
}