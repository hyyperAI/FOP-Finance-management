/**
 * Dashboard query helpers.
 * API contract: docs/backend/api.md §6 Dashboards.
 */

import { get } from '../api.js'

/**
 * GET /api/dashboard
 *
 * USER scope (own transactions only). ADMIN also gets own scope.
 * For org-wide, use adminDashboard().
 *
 * @param {Object} [params]
 * @param {'day'|'week'|'month'|'quarter'|'year'|'custom'} [params.period]
 * @param {string}  [params.startDate] YYYY-MM-DD (required when period=custom)
 * @param {string}  [params.endDate]   YYYY-MM-DD (required when period=custom)
 *
 * @returns {Promise<DashboardResponse>}
 */
export async function getDashboard(params = {}) {
  const q = new URLSearchParams()
  if (params.period)    q.set('period', params.period)
  if (params.startDate) q.set('startDate', params.startDate)
  if (params.endDate)   q.set('endDate', params.endDate)
  const qs = q.toString()
  return get(`/api/dashboard${qs ? `?${qs}` : ''}`)
}

/**
 * GET /api/admin/dashboard
 *
 * Org-wide (no postedById filter).
 *
 * @param {Object} [params]
 * @param {'day'|'week'|'month'|'quarter'|'year'|'custom'} [params.period]
 * @param {string} [params.startDate]
 * @param {string} [params.endDate]
 *
 * Response shape:
 *   { period, startDate, endDate,
 *     summary: { intake, expense, net },
 *     momChange: { intake, expense, net },
 *     runningBalance: number,
 *     topCategories: [{ categoryId, name, total, count }] }
 */
export async function adminDashboard(params = {}) {
  const q = new URLSearchParams()
  if (params.period)    q.set('period', params.period)
  if (params.startDate) q.set('startDate', params.startDate)
  if (params.endDate)   q.set('endDate', params.endDate)
  const qs = q.toString()
  return get(`/api/admin/dashboard${qs ? `?${qs}` : ''}`)
}
