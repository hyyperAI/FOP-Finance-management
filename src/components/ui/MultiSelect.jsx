import { useState, useRef, useEffect, useId } from 'react'
import { ChevronDown, X } from 'lucide-react'
import clsx from 'clsx'

/**
 * MultiSelect — chip-based multi-select dropdown.
 * Per docs/design-system/components/multi-select.md
 *
 * Props:
 *  - options: [{ value, label }]
 *  - value: string[] (selected values)
 *  - onChange: (newValues: string[]) => void
 *  - placeholder: string
 *  - label: string
 *  - maxDisplayedChips: number (defaults to 3; remainder shows as "+N")
 */
export function MultiSelect({
  label,
  options = [],
  value = [],
  onChange,
  placeholder = 'Select…',
  maxDisplayedChips = 3,
  'aria-label': ariaLabel,
  id: idProp,
  className,
}) {
  const autoId = useId()
  const id = idProp ?? autoId
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const toggle = (val) => {
    if (value.includes(val)) onChange?.(value.filter((v) => v !== val))
    else onChange?.([...value, val])
  }

  const remove = (val) => onChange?.(value.filter((v) => v !== val))

  const selectedLabels = value.map((v) => options.find((o) => o.value === v)?.label ?? v)
  const visibleChips = selectedLabels.slice(0, maxDisplayedChips)
  const extra = selectedLabels.length - visibleChips.length

  return (
    <div className={clsx('relative', className)} ref={rootRef}>
      {label && (
        <label id={`${id}-label`} className="mb-2 block text-body-m font-semibold text-text-primary">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={!label ? ariaLabel : undefined}
        className={clsx(
          'flex h-auto min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border-strong bg-bg-surface px-3 py-2 text-left text-body-m',
          'focus:outline-none focus:ring-2 focus:ring-border-focus',
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {value.length === 0 ? (
            <span className="text-text-tertiary">{placeholder}</span>
          ) : (
            <>
              {visibleChips.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-md bg-bg-sunken px-2 py-0.5 text-caption font-medium text-text-primary"
                >
                  {label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      const val = options.find((o) => o.label === label)?.value
                      if (val) remove(val)
                    }}
                    aria-label={`Remove ${label}`}
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-surface hover:text-text-primary focus:outline-none focus:ring-1 focus:ring-border-focus"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
              {extra > 0 && (
                <span className="inline-flex items-center rounded-md bg-bg-sunken px-2 py-0.5 text-caption font-medium text-text-tertiary">
                  +{extra} more
                </span>
              )}
            </>
          )}
        </div>
        <ChevronDown
          className={clsx(
            'h-5 w-5 shrink-0 text-text-tertiary transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={label ? `${id}-label` : undefined}
          className="absolute z-modal mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-bg-surface py-1 shadow-raised"
        >
          {options.map((opt) => {
            const checked = value.includes(opt.value)
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => toggle(opt.value)}
                  className={clsx(
                    'flex w-full items-center gap-3 px-3 py-2 text-left text-body-m',
                    checked ? 'bg-bg-sunken font-medium text-text-primary' : 'text-text-primary hover:bg-bg-sunken',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'inline-flex h-5 w-5 items-center justify-center rounded border',
                      checked ? 'border-brand-600 bg-brand-600 text-text-inverse' : 'border-border-strong bg-bg-surface',
                    )}
                  >
                    {checked && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                        <path d="M2 6 L5 9 L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}