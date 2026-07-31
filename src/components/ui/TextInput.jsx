import { forwardRef, useId } from 'react'
import clsx from 'clsx'

/**
 * TextInput — single-line text field with label + helper/error.
 * Per docs/design-system/components/text-input.md
 */
export const TextInput = forwardRef(function TextInput(
  {
    label,
    helperText,
    error,
    required,
    type = 'text',
    id: idProp,
    className,
    inputClassName,
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
      <input
        ref={ref}
        id={id}
        type={type}
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className={clsx(
          'h-11 w-full rounded-lg border px-4 text-body-m text-text-primary',
          'placeholder:text-text-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-0',
          'disabled:bg-bg-sunken disabled:text-text-disabled disabled:cursor-not-allowed',
          hasError
            ? 'border-danger-500 focus:ring-danger-500'
            : 'border-border-strong focus:border-border-focus',
          inputClassName,
        )}
        {...props}
      />
      {hasError && (
        <p id={`${id}-error`} className="text-caption text-danger-700" role="alert">
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${id}-helper`} className="text-caption text-text-tertiary">
          {helperText}
        </p>
      )}
    </div>
  )
})