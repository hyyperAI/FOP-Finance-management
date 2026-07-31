import clsx from 'clsx'

/**
 * SegmentedControl — row of mutually exclusive options.
 * Per docs/design-system/components/segmented-control.md
 * Used for Payment Method (Cash/Bank/JazzCash/EasyPaisa/Card) and filters.
 *
 * Props:
 *  - options: Array<{ value, label, ariaLabel? }>
 *  - value: current selected value
 *  - onChange: (value) => void
 *  - ariaLabel: string (group label for screen readers)
 *  - scrollable: boolean (allow horizontal scroll on narrow screens, default true)
 */
export function SegmentedControl({
  options = [],
  value,
  onChange,
  ariaLabel,
  scrollable = true,
  className,
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex w-full items-center rounded-lg border border-border-strong bg-bg-surface p-1',
        scrollable && 'overflow-x-auto',
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={opt.ariaLabel ?? opt.label}
            onClick={() => onChange?.(opt.value)}
            className={clsx(
              'flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md px-3',
              'text-body-m focus:outline-none focus:ring-2 focus:ring-border-focus',
              isActive
                ? 'bg-bg-sunken font-semibold text-text-primary'
                : 'bg-transparent font-normal text-text-tertiary hover:text-text-primary',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}