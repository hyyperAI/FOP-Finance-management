// App-wide constants. Per docs/backend/features/07-receipts.md § 1.4.

export const RECEIPT_MAX_SIZE_MB = 5
export const RECEIPT_MAX_SIZE_BYTES = RECEIPT_MAX_SIZE_MB * 1024 * 1024
export const RECEIPT_ACCEPTED_MIME = ['image/jpeg', 'image/png'] as const

// Storage cap (read from env, default 10 GB). § 1.2 spec uses parseInt on
// process.env.MAX_STORAGE_GB || '10'.
export const MAX_STORAGE_BYTES = (parseInt(process.env.MAX_STORAGE_GB ?? '10', 10)) * 1024 * 1024 * 1024

export type ReceiptMime = (typeof RECEIPT_ACCEPTED_MIME)[number]
