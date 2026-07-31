import { forwardRef, useId } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'

/**
 * SelectDropdown — single-select dropdown.
 * Per docs/design-system/components/select-dropdown.md
 * Backed by native <select> for accessibility + mobile sheet support.
 */
export const SelectDropdown = forwardRef(function SelectDropdown(
  {
    label,
    helperText,
    error,
    required,
    options = [],
    placeholder = 'Select an option',
    id: idProp,
    className,
    'aria-label': ariaLabel,
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
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-label={ariaLabel}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={clsx(
            'h-11 w-full appearance-none rounded-lg border px-4 pr-10',
            'text-body-m text-text-primary bg-bg-surface',
            'focus:outline-none focus:ring-2 focus:ring-border-focus',
            'disabled:bg-bg-sunken disabled:text-text-disabled disabled:cursor-not-allowed',
            hasError
              ? 'border-danger-500 focus:ring-danger-500'
              : 'border-border-strong focus:border-border-focus',
          )}
          {...props}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary"
          aria-hidden="true"
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