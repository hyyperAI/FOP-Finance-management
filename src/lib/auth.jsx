// Auth context for FOP Financial Management.
// Provides session management, authentication state, and route guards.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from './api/auth.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {'ADMIN'|'USER'} role
 * @property {boolean} isActive
 * @property {string} [email]
 * @property {string} [name]
 * @property {string} [username]
 */

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  // Re-read role + isActive on every mount so stale cookie can't grant
  // admin access after deactivation.
  const fetchSession = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getSession()
      setSession(data.user ? data : null)
    } catch (err) {
      console.error('[AuthProvider] session fetch failed:', err)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSession() }, [fetchSession])

  const refresh = useCallback(() => fetchSession(), [fetchSession])

  const value = {
    session,    // full NextAuth session object
    user: session?.user ?? null,
    loading,
    refresh,
    isAuthenticated: !!session?.user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

/** Redirects to /login if unauthenticated. Shows spinner while loading. */
export function RequireAuth({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/login', { replace: true })
  }, [loading, isAuthenticated, navigate])

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-page p-8">
        <div className="rounded-lg border border-border bg-bg-surface p-8 text-center shadow-card">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-body-m text-text-tertiary">Loading…</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) return null

  return children
}

/** Redirects to / if already authenticated (e.g. login page). Shows spinner while loading. */
export function RedirectIfAuthed({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && isAuthenticated) navigate('/', { replace: true })
  }, [loading, isAuthenticated, navigate])

  if (loading || isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-page p-8">
        <div className="rounded-lg border border-border bg-bg-surface p-8 text-center shadow-card">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-body-m text-text-tertiary">Loading…</p>
        </div>
      </main>
    )
  }

  return children
}
