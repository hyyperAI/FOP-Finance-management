/**
 * Notification query helpers.
 * API contract: docs/backend/api.md §8 Notifications.
 */

import { get, patch, post } from '../api.js'

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * GET /api/notifications
 *
 * @param {Object} [filters]
 * @param {boolean} [filters.isRead]
 * @param {'BUDGET_THRESHOLD_80'|'BUDGET_EXCEEDED_100'|'ANOMALY_AMOUNT'|'MISSING_DAILY_CLOSE'|'PERIOD_NOT_CLOSED'} [filters.type]
 * @param {number} [filters.limit=25]   one of 10, 25, 50
 * @param {number} [filters.offset=0]
 *
 * @returns {Promise<{ alerts: Alert[], total: number, unreadCount: number, limit: number, offset: number }>}
 */
export function listNotifications(filters = {}) {
  const params = new URLSearchParams()
  if (filters.isRead !== undefined) params.set('isRead', String(filters.isRead))
  if (filters.type)                params.set('type', filters.type)
  if (filters.limit !== undefined)  params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))
  const qs = params.toString()
  return get(`/api/notifications${qs ? `?${qs}` : ''}`)
}

// ---------------------------------------------------------------------------
// Mark one read/unread
// ---------------------------------------------------------------------------

/**
 * PATCH /api/notifications/:id
 *
 * @param {string} id        Alert cuid
 * @param {boolean} isRead
 */
export function markRead(id, isRead) {
  return patch(`/api/notifications/${id}`, { isRead })
}

// ---------------------------------------------------------------------------
// Mark all read
// ---------------------------------------------------------------------------

/** POST /api/notifications/read-all — returns { markedRead: number } */
export function markAllRead() {
  return post('/api/notifications/read-all')
}

// ---------------------------------------------------------------------------
// Unread count (bell badge)
// ---------------------------------------------------------------------------

/** GET /api/notifications/unread-count — returns { unreadCount: number } */
export function unreadCount() {
  return get('/api/notifications/unread-count')
}
