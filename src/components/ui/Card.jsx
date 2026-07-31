import clsx from 'clsx'

const variantClasses = {
  default: 'bg-bg-surface border border-border',
  elevated: 'bg-bg-surface shadow-card',
  filled: 'bg-bg-sunken',
  flat: 'bg-transparent',
}

const padClasses = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

/**
 * Card — surface that groups related content.
 * Per docs/design-system/components/card.md
 */
export function Card({ variant = 'default', padding = 'md', className, children, ...props }) {
  return (
    <div
      className={clsx('rounded-lg', variantClasses[variant], padClasses[padding], className)}
      {...props}
    >
      {children}
    </div>
  )
}