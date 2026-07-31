/**
 * Admin — audit log query helpers.
 * API contract: docs/backend/api.md §15 Admin — Audit log.
 */

import { get, post } from '../api.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/audit
 *
 * @param {Object} [params]
 * @param {string} [params.from]          YYYY-MM-DD
 * @param {string} [params.to]            YYYY-MM-DD
 * @param {string} [params.actorId]
 * @param {string[]} [params.actions]
 * @param {string[]} [params.entityTypes]
 * @param {string}  [params.entityId]
 * @param {number}  [params.page=1]
 * @param {number}  [params.pageSize=25]    — one of 10, 25, 50, 100
 *
 * @returns {Promise<{ entries: AuditEntry[], total: number, page, pageSize }>}
 */
export function listAudit(params = {}) {
  const p = new URLSearchParams()
  if (params.from)          p.set('from', params.from)
  if (params.to)            p.set('to', params.to)
  if (params.actorId)        p.set('actorId', params.actorId)
  if (params.actions?.length)         params.actions.forEach(v => p.append('actions', v))
  if (params.entityTypes?.length)       params.entityTypes.forEach(v => p.append('entityTypes', v))
  if (params.entityId)       p.set('entityId', params.entityId)
  if (params.page != null)   p.set('page', String(params.page))
  if (params.pageSize != null) p.set('pageSize', String(params.pageSize))
  const qs = p.toString()
  return get(`/api/admin/audit${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Single entry
// ---------------------------------------------------------------------------

/** GET /api/admin/audit/:id — returns entry with before/after JSON */
export function getAuditEntry(id) {
  return get(`/api/admin/audit/${id}`)
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/audit/export
 * Returns a Blob CSV.
 *
 * @param {Object} opts
 * @param {string}  opts.format        "csv" REQUIRED
 * @param {string} [opts.from]
 * @param {string} [opts.to]
 * @param {string} [opts.actorId]
 * @param {string[]} [opts.actions]
 * @param {string[]} [opts.entityTypes]
 * @param {string}  [opts.entityId]
 */
export async function exportAudit(opts) {
  return post('/api/admin/audit/export', opts)
}
