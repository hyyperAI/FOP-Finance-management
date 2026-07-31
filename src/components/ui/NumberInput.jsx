import { forwardRef, useId } from 'react'
import clsx from 'clsx'

/**
 * NumberInput — currency input with PKR prefix.
 * Per docs/design-system/components/number-input.md
 * Variants: default (56px) | compact (44px) | readonly
 */
export const NumberInput = forwardRef(function NumberInput(
  {
    label,
    helperText,
    error,
    required,
    variant = 'default',
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
  const heightClass = variant === 'compact' ? 'h-11' : 'h-14'

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
          'flex w-full overflow-hidden rounded-lg border',
          hasError
            ? 'border-danger-500 focus-within:ring-2 focus-within:ring-danger-500'
            : 'border-border-strong focus-within:ring-2 focus-within:ring-border-focus',
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'inline-flex items-center justify-center px-4 text-body-m font-semibold text-text-tertiary',
            heightClass, 'bg-bg-sunken border-r border-border-subtle',
          )}
        >
          PKR
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
          autoComplete="off"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={clsx(
            'flex-1 px-4 text-body-l font-medium text-text-primary tabular-nums',
            'placeholder:text-text-tertiary focus:outline-none',
            'disabled:bg-bg-sunken disabled:text-text-disabled disabled:cursor-not-allowed',
            heightClass,
            inputClassName,
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