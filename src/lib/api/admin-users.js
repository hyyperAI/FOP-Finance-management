/**
 * Admin — user management query helpers.
 * API contract: docs/backend/api.md §9 Admin — Users.
 */

import { get, post, patch } from '../api.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/users
 *
 * @param {Object} [filters]
 * @param {string} [filters.q]        search name/email/username
 * @param {'ADMIN'|'USER'} [filters.role]
 * @param {'active'|'inactive'} [filters.status]
 * @param {number} [filters.page=1]
 * @param {number} [filters.pageSize=25]
 *
 * @returns {Promise<{ users: AdminUser[], total: number, page: number, pageSize: number }>}
 */
export function listUsers(filters = {}) {
  const params = new URLSearchParams()
  if (filters.q)      params.set('q', filters.q)
  if (filters.role)   params.set('role', filters.role)
  if (filters.status) params.set('status', filters.status)
  if (filters.page)   params.set('page', String(filters.page))
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize))
  const qs = params.toString()
  return get(`/api/admin/users${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/users
 *
 * @param {Object} body
 * @param {string} body.email      REQUIRED  unique
 * @param {string} body.username  REQUIRED  3-30 chars, alphanumeric+underscore, unique
 * @param {string} body.name      REQUIRED
 * @param {string} [body.phone]
 * @param {'ADMIN'|'USER'} body.role REQUIRED
 * @param {string[]} body.categoryIds  REQUIRED for USER; optional for ADMIN
 * @param {string} body.password  REQUIRED  min 8, letter+digit
 * @param {boolean} [body.isActive]
 */
export function createUser(body) {
  return post('/api/admin/users', body)
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/users/:id
 *
 * Response includes categories as resolved objects (not ids).
 */
export function getUser(id) {
  return get(`/api/admin/users/${id}`)
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * PATCH /api/admin/users/:id
 *
 * @param {string} id
 * @param {Object} body — all fields optional, at least one required
 * @param {string}  [body.email]
 * @param {string}  [body.username]
 * @param {string}  [body.name]
 * @param {string}  [body.phone]
 * @param {'ADMIN'|'USER'} [body.role]
 * @param {string[]} [body.categoryIds]   atomic sync — deletes existing, creates new
 * @param {boolean} [body.isActive]
 */
export function updateUser(id, body) {
  return patch(`/api/admin/users/${id}`, body)
}

// ---------------------------------------------------------------------------
// Admin-initiated password reset
// ---------------------------------------------------------------------------

/** POST /api/admin/users/:id/reset-password — returns { ok: true } */
export function resetUserPassword(id) {
  return post(`/api/admin/users/${id}/reset-password`)
}
