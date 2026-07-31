/**
 * Transaction query helpers.
 * API contract: docs/backend/api.md §3 Transactions.
 */

import { get, post } from '../api.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/transactions
 *
 * @param {Object} [filters]
 * @param {string}  [filters.from]         YYYY-MM-DD
 * @param {string}  [filters.to]           YYYY-MM-DD
 * @param {'INTAKE'|'EXPENSE'} [filters.type]
 * @param {string}  [filters.categoryId]
 * @param {string}  [filters.subCategoryId]
 * @param {string}  [filters.status]
 * @param {string}  [filters.paymentMethod]
 * @param {string}  [filters.periodKey]    YYYY-MM
 * @param {number}  [filters.page=1]
 * @param {number}  [filters.pageSize=25]
 *
 * @returns {Promise<{ transactions: Transaction[], total: number, page: number, pageSize: number }>}
 */
export async function listTransactions(filters = {}) {
  const params = new URLSearchParams()
  if (filters.from)         params.set('from', filters.from)
  if (filters.to)           params.set('to', filters.to)
  if (filters.type)         params.set('type', filters.type)
  if (filters.categoryId)    params.set('categoryId', filters.categoryId)
  if (filters.subCategoryId) params.set('subCategoryId', filters.subCategoryId)
  if (filters.status)        params.set('status', filters.status)
  if (filters.paymentMethod) params.set('paymentMethod', filters.paymentMethod)
  if (filters.periodKey)    params.set('periodKey', filters.periodKey)
  if (filters.page)          params.set('page', String(filters.page))
  if (filters.pageSize)      params.set('pageSize', String(filters.pageSize))

  const qs = params.toString()
  return get(`/api/transactions${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * POST /api/transactions
 *
 * Generates an idempotencyKey automatically using crypto.randomUUID().
 *
 * @param {Object} body
 * @param {'INTAKE'|'EXPENSE'} body.type         REQUIRED
 * @param {string}  body.amount                REQUIRED  decimal-string, e.g. "450.00"
 * @param {string}  body.categoryId             REQUIRED  cuid
 * @param {string}  body.occurredAt             REQUIRED  ISO datetime
 * @param {string}  [body.vendor]
 * @param {string}  [body.description]
 * @param {string}  [body.paymentMethod]         default 'CASH'
 * @param {string}  [body.subCategoryId]
 * @param {string}  [body.departmentId]
 * @param {string}  [body.receiptUrl]             key from POST /api/upload/receipt
 * @param {string}  [body.notes]
 * @param {string[]} [body.tags]
 *
 * @returns {Promise<Transaction & { alerts: Alert[], warnings: object }>}
 */
export async function createTransaction(body) {
  return post('/api/transactions', {
    ...body,
    idempotencyKey: crypto.randomUUID(),
  })
}
