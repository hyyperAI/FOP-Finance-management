/**
 * Admin — search, reports, exports helpers.
 * API contract: docs/backend/api.md §12-§14.
 */

import { get, post, postBlob } from '../api.js'

// ---------------------------------------------------------------------------
// Transaction search
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/search
 *
 * Admin scope is automatic (no postedById filter).
 *
 * @param {Object} [params]
 * @param {string} [params.from]           YYYY-MM-DD
 * @param {string} [params.to]             YYYY-MM-DD
 * @param {'INTAKE'|'EXPENSE'} [params.type]
 * @param {string[]} [params.categoryIds]
 * @param {string[]} [params.subCategoryIds]
 * @param {string[]} [params.paymentMethods]
 * @param {string[]} [params.userIds]
 * @param {string}  [params.status]
 * @param {number}  [params.minAmount]
 * @param {number}  [params.maxAmount]
 * @param {string}  [params.description]
 * @param {number}  [params.page=1]
 * @param {number}  [params.pageSize=25]
 *
 * @returns {Promise<{ transactions: AdminTransaction[], total: number, page, pageSize }>}
 */
export function search(params = {}) {
  const p = new URLSearchParams()
  if (params.from)          p.set('from', params.from)
  if (params.to)            p.set('to', params.to)
  if (params.type)         p.set('type', params.type)
  if (params.categoryIds?.length)     params.categoryIds.forEach(v => p.append('categoryIds', v))
  if (params.subCategoryIds?.length)  params.subCategoryIds.forEach(v => p.append('subCategoryIds', v))
  if (params.paymentMethods?.length)   params.paymentMethods.forEach(v => p.append('paymentMethods', v))
  if (params.userIds?.length)          params.userIds.forEach(v => p.append('userIds', v))
  if (params.status)        p.set('status', params.status)
  if (params.minAmount != null)  p.set('minAmount', String(params.minAmount))
  if (params.maxAmount != null)  p.set('maxAmount', String(params.maxAmount))
  if (params.description)    p.set('description', params.description)
  if (params.page != null)   p.set('page', String(params.page))
  if (params.pageSize != null) p.set('pageSize', String(params.pageSize))
  const qs = p.toString()
  return get(`/api/admin/search${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Export preview
// ---------------------------------------------------------------------------

/** GET /api/admin/exports/preview — returns first 10 rows as JSON. */
export function exportPreview(params) {
  const p = new URLSearchParams()
  if (params.from)          p.set('from', params.from)
  if (params.to)            p.set('to', params.to)
  if (params.type)         p.set('type', params.type)
  if (params.categoryIds?.length)     params.categoryIds.forEach(v => p.append('categoryIds', v))
  if (params.subCategoryIds?.length)  params.subCategoryIds.forEach(v => p.append('subCategoryIds', v))
  if (params.paymentMethods?.length)   params.paymentMethods.forEach(v => p.append('paymentMethods', v))
  if (params.userIds?.length)          params.userIds.forEach(v => p.append('userIds', v))
  if (params.status)        p.set('status', params.status)
  if (params.minAmount != null)  p.set('minAmount', String(params.minAmount))
  if (params.maxAmount != null)  p.set('maxAmount', String(params.maxAmount))
  if (params.description)    p.set('description', params.description)
  if (params.page != null)   p.set('page', String(params.page))
  if (params.pageSize != null) p.set('pageSize', String(params.pageSize))
  const qs = p.toString()
  return get(`/api/admin/exports/preview${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/exports/csv
 * Returns a Blob — callers must handle download:
 *   const blob = await exportCsv(params)
 *   const url = URL.createObjectURL(blob)
 *   window.location.href = url
 *   URL.revokeObjectURL(url)
 *
 * @param {Object} opts
 * @param {{ from: string, to: string }} opts.filters
 * @param {'all'|'INTAKE'|'EXPENSE'} [opts.filters.type]
 * @param {string[]} [opts.filters.categoryIds]
 * @param {string[]} [opts.filters.subCategoryIds]
 * @param {string[]} [opts.filters.paymentMethods]
 * @param {string[]} [opts.filters.userIds]
 * @param {number} [opts.filters.minAmount]
 * @param {number} [opts.filters.maxAmount]
 * @param {boolean} [opts.includeSoftDeleted]
 * @param {boolean} [opts.includeEditHistory]
 */
export async function exportCsv(opts = {}) {
  return postBlob('/api/admin/exports/csv', opts)
}

// ---------------------------------------------------------------------------
// PDF report
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/reports/pdf
 * Returns a Blob.
 *
 * @param {Object} opts — same shape as exportCsv (minus includeSoftDeleted/editHistory)
 */
export async function reportPdf(opts = {}) {
  return postBlob('/api/admin/reports/pdf', opts)
}
