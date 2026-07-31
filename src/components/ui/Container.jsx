import clsx from 'clsx'

/**
 * Container — max-width wrapper that centers content.
 * Per docs/design-system/components/container.md
 */
export function Container({ variant = 'default', as: Tag = 'div', className, children, ...props }) {
  const widths = {
    default: 'max-w-7xl',
    narrow: 'max-w-3xl',
    wide: 'max-w-screen-2xl',
  }
  return (
    <Tag
      className={clsx('mx-auto w-full px-4 sm:px-6 md:px-8', widths[variant], className)}
      {...props}
    >
      {children}
    </Tag>
  )
}