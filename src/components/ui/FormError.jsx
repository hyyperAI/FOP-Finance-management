import { AlertCircle } from 'lucide-react'
import clsx from 'clsx'

/**
 * FormError — top-of-form error banner.
 * Per docs/design-system/components/form-error.md
 * role="alert" + aria-live="polite" so screen readers announce.
 */
export function FormError({ title, message, className, ...props }) {
  if (!title && !message) return null
  return (
    <div
      role="alert"
      aria-live="polite"
      className={clsx(
        'flex items-start gap-3',
        'rounded-lg border border-danger-500 bg-danger-50 p-4',
        className,
      )}
      {...props}
    >
      <AlertCircle className="h-6 w-6 shrink-0 text-danger-700" aria-hidden="true" />
      <div className="flex flex-col gap-1 text-danger-700">
        {title && <p className="text-body-m font-semibold">{title}</p>}
        {message && <p className="text-caption">{message}</p>}
      </div>
    </div>
  )
}