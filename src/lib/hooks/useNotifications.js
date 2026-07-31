/**
 * useNotifications — polls /api/notifications/unread-count every `intervalMs`.
 *
 * Returns { unreadCount, refresh }
 *
 * Used by:
 *   - Home page (top-bar bell badge)
 *   - BottomTabBar (admin badge)
 *
 * Polling is paused when the document is hidden (tab in background) to save
 * backend bandwidth. Resumes automatically when the tab becomes visible again.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { ApiError } from '../api.js'
import { unreadCount as fetchUnreadCount } from '../api/notifications.js'

/**
 * @param {number} [intervalMs=60000]  poll interval in ms (default 60s)
 */
export function useNotifications(intervalMs = 60000) {
  const [unreadCount, setUnreadCount] = useState(0)
  const mountedRef = useRef(true)
  const timerRef = useRef(null)

  const tick = useCallback(async () => {
    try {
      const data = await fetchUnreadCount()
      if (mountedRef.current) {
        setUnreadCount(data?.unreadCount ?? 0)
      }
    } catch (err) {
      // Silently swallow non-critical errors — the bell just keeps last value.
      // Log for debugging only.
      if (mountedRef.current && !(err instanceof ApiError && err.status === 401)) {
        console.warn('[useNotifications] poll failed:', err)
      }
    }
  }, [])

  // Public refresh fn (for "mark all read" → force re-poll).
  const refresh = useCallback(() => tick(), [tick])

  useEffect(() => {
    mountedRef.current = true

    const startTimer = () => {
      // immediate tick, then interval
      tick()
      timerRef.current = setInterval(tick, intervalMs)
    }
    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopTimer()
      } else {
        startTimer()
      }
    }

    if (!document.hidden) startTimer()

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      mountedRef.current = false
      stopTimer()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs, tick])

  return { unreadCount, refresh }
}