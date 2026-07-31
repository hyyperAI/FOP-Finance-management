/**
 * Daily close query helpers.
 * API contract: docs/backend/api.md §5 Daily close + §18 Admin — close on behalf.
 */

import { get, post } from '../api.js'

// ---------------------------------------------------------------------------
// User close-day
// ---------------------------------------------------------------------------

/**
 * GET /api/close-day?date=YYYY-MM-DD
 *
 * @param {string} date YYYY-MM-DD
 * @returns {Promise<CloseDayGetResponse>}
 */
export function getCloseDay(date, userId) {
  const params = new URLSearchParams({ date })
  if (userId) params.set('userId', userId)
  return get(`/api/close-day?${params.toString()}`)
}

/**
 * POST /api/close-day
 *
 * USER can backdate up to 7 days. reason is NOT required for USER.
 *
 * @param {{ closeDate: string, countedByMethod: PaymentTotals, notes?: string }} body
 * @param {string} body.closeDate        YYYY-MM-DD
 * @param {{ CASH: number, BANK: number, JAZZCASH: number, EASYPAISA: number, CARD: number }} body.countedByMethod
 * @param {string} [body.notes]          max 500 chars
 *
 * @returns {Promise<DayClose>}
 */
export function closeDay(body) {
  return post('/api/close-day', body)
}

// ---------------------------------------------------------------------------
// Admin close on behalf
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/close-day/:userId
 *
 * ADMIN can backdate up to 365 days. reason >= 20 chars is REQUIRED.
 *
 * @param {string} userId
 * @param {Object} body
 * @param {string} body.closeDate
 * @param {{ CASH: number, BANK: number, JAZZCASH: number, EASYPAISA: number, CARD: number }} body.countedByMethod
 * @param {string} [body.notes]
 * @param {string} body.reason             REQUIRED — >= 20 chars
 */
export function adminCloseDay(userId, body) {
  return post(`/api/admin/close-day/${userId}`, body)
}
