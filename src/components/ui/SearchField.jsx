import { forwardRef, useId } from 'react'
import { Search, X } from 'lucide-react'
import clsx from 'clsx'

/**
 * SearchField — text input with leading search icon + clear button.
 * Per docs/design-system/components/search-field.md
 *
 * Props:
 *  - value, onChange, onClear
 *  - placeholder
 *  - 'aria-label' (required if no visible label)
 */
export const SearchField = forwardRef(function SearchField(
  {
    label,
    value = '',
    onChange,
    onClear,
    placeholder = 'Search…',
    'aria-label': ariaLabel,
    id: idProp,
    className,
  },
  ref,
) {
  const autoId = useId()
  const id = idProp ?? autoId

  return (
    <div className={clsx('relative', className)}>
      {label && (
        <label htmlFor={id} className="sr-only">{label}</label>
      )}
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-text-tertiary"
        aria-hidden="true"
      />
      <input
        ref={ref}
        id={id}
        type="search"
        aria-label={ariaLabel ?? label ?? 'Search'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={clsx(
          'h-11 w-full rounded-lg border border-border-strong bg-bg-surface pl-10 pr-10',
          'text-body-m text-text-primary placeholder:text-text-tertiary',
          'focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-border-focus',
        )}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={() => onClear('')}
          aria-label="Clear search"
          className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-sunken hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
})