/**
 * RequireAdmin — route guard for admin-only pages.
 *
 * Must be placed INSIDE RequireAuth so useAuth() is available.
 *
 * States:
 *   loading → spinner (AuthProvider still fetching session)
 *   forbidden → "Access denied" surface
 *   admin → children
 */

import { useAuth } from '../../lib/auth.jsx'
import { Spinner } from '../ui/Spinner.jsx'

function AccessDenied() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-page p-8">
      <div className="rounded-lg border border-border bg-bg-surface p-8 text-center shadow-card max-w-sm">
        <div className="mb-4 mx-auto h-12 w-12 rounded-full bg-danger-50 flex items-center justify-center">
          <span className="text-2xl" aria-hidden="true">
            🚫
          </span>
        </div>
        <h1 className="mb-2 text-h4 font-semibold text-text-primary">
          Access denied
        </h1>
        <p className="text-body-m text-text-tertiary">
          You need admin privileges to view this page.
        </p>
      </div>
    </main>
  )
}

/**
 * @param {{ children: React.ReactNode }}
 */
export function RequireAdmin({ children }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-page p-8">
        <Spinner label="Checking access..." />
      </main>
    )
  }

  const { user } = useAuth()
  if (!user || user.role !== 'ADMIN') {
    return <AccessDenied />
  }

  return children
}
