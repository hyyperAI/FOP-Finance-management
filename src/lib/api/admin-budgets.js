/**
 * Admin — budget query helpers.
 * API contract: docs/backend/api.md §11 Admin — Budgets.
 */

import { get, post, patch, del } from '../api.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/budgets
 *
 * @param {Object} [params]
 * @param {string} [params.period]       YYYY-MM default = current month
 * @param {boolean} [params.includeInactive]
 *
 * Response includes currentSpend, percentUsed, warningLevel from the backend.
 * Do NOT compute these locally.
 */
export function listBudgets({ period, includeInactive } = {}) {
  const params = new URLSearchParams()
  if (period)           params.set('period', period)
  if (includeInactive)   params.set('includeInactive', 'true')
  const qs = params.toString()
  return get(`/api/admin/budgets${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/budgets
 *
 * @param {Object} body
 * @param {string} body.categoryId  REQUIRED cuid
 * @param {string} body.periodKey  REQUIRED YYYY-MM
 * @param {string} body.amount     REQUIRED decimal-string
 * @param {string} [body.currency] default PKR
 */
export function createBudget(body) {
  return post('/api/admin/budgets', body)
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/** GET /api/admin/budgets/:id */
export function getBudget(id) {
  return get(`/api/admin/budgets/${id}`)
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * PATCH /api/admin/budgets/:id
 *
 * @param {string} id
 * @param {Object} body — both optional, at least one required
 * @param {string} [body.amount]
 * @param {boolean} [body.isActive]
 */
export function updateBudget(id, body) {
  return patch(`/api/admin/budgets/${id}`, body)
}

// ---------------------------------------------------------------------------
// Delete (soft-delete via isActive=false)
// ---------------------------------------------------------------------------

/** DELETE /api/admin/budgets/:id — sets isActive=false. Returns 204 No Content. */
export function deleteBudget(id) {
  return del(`/api/admin/budgets/${id}`)
}
