import { TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

const pkr = new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0, maximumFractionDigits: 2 })

/**
 * VarianceBanner — loud visual showing close-day variance.
 * Per docs/pages/11-close-day.md §3 (CRITICAL — must be loud).
 *
 * Props:
 *  - totalVariance: number (PKR; positive = surplus, negative = shortage)
 *  - hasVariance: boolean
 *  - perMethod: [{ method, counted, expected, variance }]
 */
export function VarianceBanner({ totalVariance = 0, hasVariance = false, perMethod = [] }) {
  if (!hasVariance) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg border border-success-500 bg-success-50 p-4"
      >
        <CheckCircle2 className="h-7 w-7 shrink-0 text-success-700" aria-hidden="true" />
        <div>
          <p className="text-body-l font-semibold text-success-700">Day closed. Books balance ✓</p>
          <p className="text-caption text-success-700">No variance across all payment methods.</p>
        </div>
      </div>
    )
  }

  const isPositive = totalVariance > 0
  const Icon = isPositive ? TrendingUp : TrendingDown
  const verb = isPositive ? 'surplus' : 'shortage'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border-2 border-danger-500 bg-danger-50 p-4"
    >
      <div className="flex items-start gap-3">
        <Icon className="h-7 w-7 shrink-0 text-danger-700" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-h4 font-semibold text-danger-700">
            Variance detected — {verb} of {pkr.format(Math.abs(totalVariance))}
          </p>
          <p className="mt-1 text-caption text-danger-700">
            Review the per-method breakdown below. Document in notes if expected.
          </p>
          {perMethod.length > 0 && (
            <ul className="mt-3 space-y-1 text-caption">
              {perMethod.map((m) => (
                <li key={m.method} className="flex items-center justify-between gap-3 text-danger-700">
                  <span className="font-semibold">{m.method}</span>
                  <span className="tabular-nums">
                    counted {pkr.format(m.counted)} − expected {pkr.format(m.expected)} ={' '}
                    <span className={clsx('font-semibold', m.variance < 0 ? 'text-danger-700' : 'text-success-700')}>
                      {pkr.format(m.variance)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}