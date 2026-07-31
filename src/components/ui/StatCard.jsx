import clsx from 'clsx'

const variantClasses = {
  intake:    { value: 'text-success-700', accent: 'bg-success-500' },
  expense:   { value: 'text-danger-700',  accent: 'bg-danger-500' },
  neutral:   { value: 'text-text-primary', accent: 'bg-brand-500' },
  info:      { value: 'text-info-700',    accent: 'bg-info-500' },
}

/**
 * StatCard — KPI display card.
 * Per docs/pages/12-dashboard-user.md §3 and 13-admin-dashboard.md.
 *
 * Props:
 *  - label: string
 *  - value: string | number (already formatted)
 *  - variant: 'intake' | 'expense' | 'neutral' | 'info'
 *  - trend: { direction: 'up'|'down'|'flat', label: string } (optional)
 *  - icon: LucideIcon (optional, shown top-right)
 */
export function StatCard({ label, value, variant = 'neutral', trend, icon: Icon, className }) {
  const v = variantClasses[variant]
  return (
    <div className={clsx('relative overflow-hidden rounded-lg border border-border bg-bg-surface p-4', className)}>
      <span aria-hidden="true" className={clsx('absolute inset-y-0 left-0 w-1', v.accent)} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <p className="text-caption font-medium uppercase tracking-wide text-text-secondary">{label}</p>
        {Icon && <Icon className="h-5 w-5 text-text-tertiary" aria-hidden="true" />}
      </div>
      <p className={clsx('mt-2 pl-2 text-h3 font-semibold tabular-nums', v.value)}>{value}</p>
      {trend && (
        <p className="mt-1 pl-2 text-caption text-text-tertiary">
          {trend.direction === 'up' && '↑ '}
          {trend.direction === 'down' && '↓ '}
          {trend.direction === 'flat' && '→ '}
          {trend.label}
        </p>
      )}
    </div>
  )
}