/**
 * ErrorState — standardised error display for API failures.
 *
 * Usage:
 *   const q = useApi(() => getUser(id))
 *   if (q.error) return <ErrorState error={q.error} onRetry={q.run} />
 *
 * Or inline for form errors:
 *   <ErrorState error={fieldError} />
 */

import { AlertTriangle, RefreshCw } from 'lucide-react'

// ---------------------------------------------------------------------------
// Per-field inline error
// ---------------------------------------------------------------------------

/**
 * Inline error for a single form field.
 * Renders nothing when error is falsy.
 *
 * @param {{ error?: string, className?: string }} props
 */
export function FieldError({ error, className = '' }) {
  if (!error) return null
  return (
    <p role="alert" className={`mt-1 text-caption text-danger-700 ${className}`}>
      {error}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Page-level error state
// ---------------------------------------------------------------------------

/**
 * Full-page / section-level error with retry action.
 *
 * @param {{ error: Error, onRetry?: () => void, title?: string }} props
 */
export function ErrorState({ error, onRetry, title }) {
  const code = error?.code || 'HTTP error'
  const isNetwork = !error?.status || error.status === 0

  const heading = isNetwork
    ? 'Network error'
    : error.status === 403
      ? 'Access denied'
      : error.status === 404
        ? 'Not found'
        : 'Something went wrong'

  const message = isNetwork
    ? 'Check your connection and try again.'
    : error.fields
      ? null  // field-level errors should be shown inline, not here
      : error.message || code

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 py-12 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-50">
        <AlertTriangle className="h-6 w-6 text-danger-600" aria-hidden="true" />
      </div>

      <div>
        <p className="text-h4 font-semibold text-text-primary">{title || heading}</p>
        {message && (
          <p className="mt-1 text-body-m text-text-secondary">
            {message}
          </p>
        )}
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-4 py-2 text-body-m font-medium text-text-primary transition-colors hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  )
}
