import clsx from 'clsx'

/**
 * Switch — iOS-style toggle.
 * Per docs/design-system/components/switch.md
 *
 * Props:
 *  - checked: boolean
 *  - onChange: (checked: boolean) => void
 *  - disabled, ariaLabel, className
 *  - size: 'sm' | 'md'
 */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  'aria-label': ariaLabel,
  size = 'md',
  className,
}) {
  const dims = {
    sm: { track: 'h-5 w-9',  thumb: 'h-4 w-4', translate: 'translate-x-4' },
    md: { track: 'h-6 w-11', thumb: 'h-5 w-5', translate: 'translate-x-5' },
  }[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange?.(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full',
        'transition-colors duration-150 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-success-500' : 'bg-neutral-300',
        dims.track,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'inline-block rounded-full bg-bg-surface shadow-card',
          'transition-transform duration-150 ease-out',
          dims.thumb,
          checked ? dims.translate : 'translate-x-0.5',
        )}
      />
    </button>
  )
}