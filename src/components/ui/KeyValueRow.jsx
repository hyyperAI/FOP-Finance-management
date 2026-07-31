import clsx from 'clsx'

/**
 * KeyValueRow — a single label/value row used in detail pages.
 * Per docs/pages/08-transaction-detail.md §3 "Details list".
 */
export function KeyValueRow({ label, value, children, className }) {
  return (
    <div className={clsx('flex items-start justify-between gap-4 py-3', className)}>
      <dt className="text-body-m text-text-secondary">{label}</dt>
      <dd className="text-body-m font-medium text-text-primary text-right">
        {children ?? value}
      </dd>
    </div>
  )
}