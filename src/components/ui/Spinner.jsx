import clsx from 'clsx'

const sizeClasses = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

/**
 * Spinner — indeterminate loading indicator.
 * Per docs/design-system/components/spinner.md
 * Inherits color via currentColor.
 */
export function Spinner({ size = 'md', className, label = 'Loading', ...props }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={clsx(
        'inline-block rounded-full',
        'border-current border-r-transparent',
        'animate-spin',
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  )
}