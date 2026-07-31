/**
 * Admin — category management query helpers.
 * API contract: docs/backend/api.md §10 Admin — Categories.
 */

import { get, post, patch, del } from '../api.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/categories
 *
 * @param {Object} [filters]
 * @param {'INTAKE'|'EXPENSE'} [filters.type]
 * @param {boolean} [filters.isActive]
 * @param {string}  [filters.departmentId]
 *
 * @returns {Promise<{ categories: AdminCategory[] }>}
 *
 * AdminCategory shape (per api.md):
 *   { id, name, type, color, icon, description, isActive, isDefault,
 *     departmentId, department, subCategoryCount, assignedUserCount,
 *     createdAt, updatedAt }
 */
export function listCategories(filters = {}) {
  const params = new URLSearchParams()
  if (filters.type)                params.set('type', filters.type)
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
  if (filters.departmentId)         params.set('departmentId', filters.departmentId)
  const qs = params.toString()
  return get(`/api/admin/categories${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * POST /api/admin/categories
 *
 * @param {Object} body
 * @param {string} body.name       REQUIRED
 * @param {'INTAKE'|'EXPENSE'} body.type REQUIRED
 * @param {string} [body.color]
 * @param {string} [body.icon]
 * @param {string} [body.description]
 * @param {boolean} [body.isDefault]
 * @param {string} [body.departmentId]
 */
export function createCategory(body) {
  return post('/api/admin/categories', body)
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

/** GET /api/admin/categories/:id */
export function getCategory(id) {
  return get(`/api/admin/categories/${id}`)
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * PATCH /api/admin/categories/:id
 *
 * @param {string} id
 * @param {Object} body — all optional, at least one required
 * @param {string} [body.name]
 * @param {'INTAKE'|'EXPENSE'} [body.type]
 * @param {string} [body.color]
 * @param {string} [body.icon]
 * @param {string} [body.description]
 * @param {boolean} [body.isActive]
 * @param {string|null} [body.departmentId]
 */
export function updateCategory(id, body) {
  return patch(`/api/admin/categories/${id}`, body)
}

// ---------------------------------------------------------------------------
// Soft-delete
// ---------------------------------------------------------------------------

/** DELETE /api/admin/categories/:id — sets isActive=false. Idempotent. */
export function deleteCategory(id) {
  return del(`/api/admin/categories/${id}`)
}