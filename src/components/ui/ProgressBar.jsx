import clsx from 'clsx'

/**
 * ProgressBar — horizontal progress / proportion bar.
 * Per docs/pages/12-dashboard-user.md §4 (Top categories).
 *
 * Props:
 *  - value: number (current)
 *  - max: number (max for normalization)
 *  - label: string (left side)
 *  - trailing: ReactNode (right side; usually formatted value)
 *  - variant: 'intake' | 'expense' | 'neutral' (color of the bar)
 */
export function ProgressBar({ value = 0, max = 0, label, trailing, variant = 'neutral', className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  const barColor = {
    intake: 'bg-success-500',
    expense: 'bg-danger-500',
    neutral: 'bg-brand-500',
    info: 'bg-info-500',
  }[variant]

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-body-m text-text-primary">{label}</span>
        <span className="shrink-0 text-body-m font-semibold text-text-primary tabular-nums">
          {trailing}
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-bg-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ? `${label} progress` : undefined}
      >
        <div
          className={clsx('h-full rounded-full transition-all duration-250 ease-out', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}