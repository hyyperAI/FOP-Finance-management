/**
 * Generic data-fetching hook built on top of api.js.
 *
 * Wraps any async query fn and exposes loading/error/data state.
 *
 * Components using useQuery() get:
 *   { data, error, loading, run, reset }
 *
 * Usage:
 *   const q = useQuery(() => listTransactions({ period: 'month' }))
 *   if (q.loading) return <Skeleton />
 *   if (q.error)   return <ErrorState error={q.error} onRetry={q.run} />
 *   return <Table data={q.data.transactions} />
 *
 * For debounced search (e.g. 300ms delay):
 *   const q = useDebouncedQuery(() => searchUsers({ q: term }), [term], 300)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { ApiError } from '../api.js'

// ---------------------------------------------------------------------------
// Core useQuery — fires on mount; caller controls re-fetch via run()
// ---------------------------------------------------------------------------

/**
 * @param {() => Promise<any>} queryFn
 * @param {any[]} [deps]  — queryFn only re-created when deps change
 * @param {Object} [options]
 * @param {boolean} [options.enabled=true]  when false, skips the fetch
 */
export function useQuery(queryFn, deps = [], options = {}) {
  const [data, setData] = useState(undefined)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  // Track mount to guard against setState after unmount
  const mountedRef = useRef(true)
  const depsRef = useRef(deps)
  depsRef.current = deps
  const enabled = options.enabled !== false

  const run = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const result = await queryFn()
      if (mountedRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof ApiError ? err : new ApiError(0, 'unknown', null, err?.message))
        setLoading(false)
      }
    }
  // deps are intentionally excluded — queryFn is stable via useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  // Fire on mount (or when queryFn reference changes via deps)
  useEffect(() => {
    mountedRef.current = true
    run()
    return () => { mountedRef.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...depsRef.current, enabled])

  const reset = useCallback(() => {
    setData(undefined)
    setError(null)
    setLoading(true)
  }, [])

  return { data, error, loading, run, reset }
}

// ---------------------------------------------------------------------------
// useDebouncedQuery — fires after delay ms of stability
// ---------------------------------------------------------------------------

/**
 * Debounced variant — fires after `delay` ms of stability.
 * The query fn is only called once the deps + delay settle.
 *
 * @param {() => Promise<any>} queryFn
 * @param {any[]} deps
 * @param {number} [delay=300]
 */
export function useDebouncedQuery(queryFn, deps = [], delay = 300) {
  const [data, setData] = useState(undefined)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)
  const timerRef = useRef(null)
  const depsRef = useRef(deps)
  depsRef.current = deps

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const run = useCallback(async () => {
    cancel()
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      setLoading(true)
      setError(null)
      try {
        const result = await queryFn()
        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof ApiError ? err : new ApiError(0, 'unknown', null, err?.message))
          setLoading(false)
        }
      }
    }, delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, depsRef.current)  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true
    run()
    return () => {
      mountedRef.current = false
      cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, depsRef.current)

  const reset = useCallback(() => {
    cancel()
    setData(undefined)
    setError(null)
    setLoading(false)
  }, [cancel])

  return { data, error, loading, run, reset, cancel }
}
