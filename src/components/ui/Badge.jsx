import clsx from 'clsx'

const variantClasses = {
  intake: 'bg-success-50 text-success-700',
  expense: 'bg-danger-50 text-danger-700',
  edited: 'bg-neutral-100 text-text-secondary',
  default: 'bg-neutral-100 text-text-secondary',
}

/**
 * Badge — small inline tag for transaction type / state.
 * Per docs/design-system/components/alert-banner.md (small tag variant)
 */
export function Badge({ variant = 'default', className, children }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5',
        'text-caption font-semibold uppercase tracking-wide',
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}