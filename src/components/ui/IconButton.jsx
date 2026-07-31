import clsx from 'clsx'

const variantClasses = {
  default: 'text-text-primary hover:bg-bg-sunken active:bg-neutral-200',
  ghost: 'text-text-secondary hover:bg-bg-sunken',
}

/**
 * IconButton — 44×44 square with centered icon.
 * Per docs/design-system/components/icon-button.md
 */
export function IconButton({
  variant = 'default',
  'aria-label': ariaLabel,
  disabled,
  className,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center',
        'h-11 w-11 rounded-md',
        'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}