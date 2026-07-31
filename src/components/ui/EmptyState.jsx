import clsx from 'clsx'

/**
 * EmptyState — centered illustration + headline + helper copy.
 * Per docs/design-system/components/empty-state.md
 */
export function EmptyState({ icon: Icon, title, message, className }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center gap-3 p-8 text-center', className)}>
      {Icon && <Icon className="h-12 w-12 text-text-tertiary" aria-hidden="true" />}
      {title && <p className="text-body-l font-semibold text-text-primary">{title}</p>}
      {message && <p className="text-body-m text-text-tertiary">{message}</p>}
    </div>
  )
}