/**
 * Receipt upload helpers.
 * API contract: docs/backend/api.md §7 Receipts.
 */

import { uploadReceipt } from '../api.js'

/**
 * Upload a receipt image and return the storage key.
 *
 * Validates client-side before calling the API:
 *   - File must be image/jpeg or image/png
 *   - Max size 10 MB pre-compression
 *
 * On success returns { key: "uploads/receipts/..." }
 * On 507 storage_cap_exceeded, throw ApiError so callers can
 * surface a storage-full message.
 *
 * @param {File} file
 * @returns {Promise<{ key: string }>}
 */
export { uploadReceipt }
