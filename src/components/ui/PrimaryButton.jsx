import clsx from 'clsx'

const variantClasses = {
  primary: 'bg-brand-600 text-text-inverse hover:bg-brand-700 active:bg-brand-800',
  intake: 'bg-success-500 text-text-inverse hover:bg-success-600 active:bg-success-700',
  expense: 'bg-danger-500 text-text-inverse hover:bg-danger-600 active:bg-danger-700',
}

/**
 * PrimaryButton — main call to action.
 * Per docs/design-system/components/primary-button.md
 * Min 44x44 tap target enforced via min-h-11.
 */
export function PrimaryButton({
  variant = 'primary',
  type = 'button',
  fullWidth = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2',
        'min-h-11 px-4 rounded-md',
        'text-body-l font-semibold',
        'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}