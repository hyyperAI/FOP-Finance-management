import clsx from 'clsx'

/**
 * GhostButton — tertiary action with no border or fill.
 * Per docs/design-system/components/ghost-button.md
 */
export function GhostButton({
  type = 'button',
  disabled,
  fullWidth = false,
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
        'text-body-l font-semibold text-text-primary',
        'hover:bg-bg-sunken active:bg-neutral-200',
        'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}