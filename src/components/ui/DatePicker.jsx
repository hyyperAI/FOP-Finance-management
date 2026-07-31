import { forwardRef, useId } from 'react'
import { Calendar } from 'lucide-react'
import clsx from 'clsx'

/**
 * DatePicker — single date input.
 * Per docs/design-system/components/date-picker.md
 * Backed by native <input type="date"> for mobile native picker.
 */
export const DatePicker = forwardRef(function DatePicker(
  {
    label,
    helperText,
    error,
    required,
    id: idProp,
    className,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hasError = Boolean(error)

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={id} className="text-body-m font-semibold text-text-primary">
          {label}
          {required && <span className="ml-1 text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}
      <div
        className={clsx(
          'relative flex w-full items-center rounded-lg border bg-bg-surface',
          hasError
            ? 'border-danger-500 focus-within:ring-2 focus-within:ring-danger-500'
            : 'border-border-strong focus-within:ring-2 focus-within:ring-border-focus',
        )}
      >
        <Calendar
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
        />
        <input
          ref={ref}
          id={id}
          type="date"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={clsx(
            'h-11 w-full bg-transparent pl-10 pr-4 text-body-m text-text-primary',
            'focus:outline-none',
            'disabled:bg-bg-sunken disabled:text-text-disabled disabled:cursor-not-allowed',
          )}
          {...props}
        />
      </div>
      {hasError && (
        <p id={`${id}-error`} className="text-caption text-danger-700" role="alert">{error}</p>
      )}
      {!hasError && helperText && (
        <p id={`${id}-helper`} className="text-caption text-text-tertiary">{helperText}</p>
      )}
    </div>
  )
})