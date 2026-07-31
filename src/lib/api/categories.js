/**
 * Sub-category query helpers (user-private).
 * API contract: docs/backend/api.md §4 Sub-categories.
 *
 * Admin category CRUD lives in admin-categories.js.
 */

import { get, post, patch, del } from '../api.js'

// ---------------------------------------------------------------------------
// List parent categories (user-scoped)
// ---------------------------------------------------------------------------

/**
 * GET /api/categories
 *
 * USER: returns only categories the user has been assigned to.
 * ADMIN: returns all active categories.
 *
 * @returns {Promise<{ categories: ParentCategory[] }>}
 */
export async function listUserCategories() {
  return get('/api/categories')
}

// ---------------------------------------------------------------------------
// List sub-categories
// ---------------------------------------------------------------------------

/**
 * GET /api/sub-categories
 *
 * @param {Object} [filters]
 * @param {boolean} [filters.mine]       ADMIN-only override; ignored for USER
 * @param {string}  [filters.parentId]    cuid — filter by category
 * @param {boolean} [filters.isActive]
 *
 * @returns {Promise<{ subCategories: SubCategory[] }>}
 */
export async function listSubCategories(filters = {}) {
  const params = new URLSearchParams()
  if (filters.mine !== undefined)      params.set('mine', String(filters.mine))
  if (filters.parentId)                 params.set('parentId', filters.parentId)
  if (filters.isActive !== undefined)    params.set('isActive', String(filters.isActive))
  const qs = params.toString()
  return get(`/api/sub-categories${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * POST /api/sub-categories
 *
 * Soft-deletes with the same (owner, parent, name) triple are auto-restored.
 *
 * @param {Object} body
 * @param {string} body.name      REQUIRED  1-50 chars
 * @param {string} body.parentId REQUIRED  cuid
 * @param {string} [body.color]  hex e.g. "#AABBCC"
 * @param {string} [body.icon]
 * @param {string} [body.notes]
 *
 * @returns {Promise<SubCategory>}
 */
export async function createSubCategory(body) {
  return post('/api/sub-categories', body)
}

// ---------------------------------------------------------------------------
// Rename
// ---------------------------------------------------------------------------

/**
 * PATCH /api/sub-categories/:id
 *
 * ⚠ STRICT — only 'name' is accepted. Sending color/icon will return 400.
 *
 * @param {string} id
 * @param {{ name: string }} body — only 'name' allowed
 */
export async function renameSubCategory(id, body) {
  return patch(`/api/sub-categories/${id}`, body)
}

// ---------------------------------------------------------------------------
// Soft-delete
// ---------------------------------------------------------------------------

/**
 * DELETE /api/sub-categories/:id
 *
 * Sets isActive=false. Idempotent.
 *
 * @returns {Promise<{ ok: boolean, alreadyDeleted?: boolean }>}
 */
export async function deleteSubCategory(id) {
  return del(`/api/sub-categories/${id}`)
}
