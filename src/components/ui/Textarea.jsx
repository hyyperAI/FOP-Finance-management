import { forwardRef, useId } from 'react'
import clsx from 'clsx'

/**
 * Textarea — multi-line text input.
 * Per docs/design-system/components/text-input.md (textarea variant)
 *
 * Props:
 *  - label, helperText, error, required
 *  - maxLength: number (shows counter "n / max")
 */
export const Textarea = forwardRef(function Textarea(
  {
    label,
    helperText,
    error,
    required,
    maxLength,
    value = '',
    id: idProp,
    className,
    ...props
  },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId
  const hasError = Boolean(error)
  const currentLength = (value ?? '').length

  return (
    <div className={clsx('flex flex-col gap-2', className)}>
      {label && (
        <label htmlFor={id} className="text-body-m font-semibold text-text-primary">
          {label}
          {required && <span className="ml-1 text-danger-500" aria-hidden="true">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={3}
        value={value}
        maxLength={maxLength}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className={clsx(
          'w-full rounded-lg border px-4 py-3',
          'text-body-m text-text-primary bg-bg-surface resize-y',
          'placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus',
          'disabled:bg-bg-sunken disabled:text-text-disabled disabled:cursor-not-allowed',
          hasError
            ? 'border-danger-500 focus:ring-danger-500'
            : 'border-border-strong focus:border-border-focus',
        )}
        {...props}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          {hasError && (
            <p id={`${id}-error`} className="text-caption text-danger-700" role="alert">{error}</p>
          )}
          {!hasError && helperText && (
            <p id={`${id}-helper`} className="text-caption text-text-tertiary">{helperText}</p>
          )}
        </div>
        {maxLength && (
          <span className="text-caption text-text-tertiary tabular-nums">
            {currentLength} / {maxLength}
          </span>
        )}
      </div>
    </div>
  )
})