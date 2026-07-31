import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

/**
 * Pagination — simple Prev / Page X of Y / Next.
 * Per docs/design-system/components/09-components-data.md
 */
export function Pagination({ page, totalPages, onChange, className }) {
  if (totalPages <= 1) return null
  const canPrev = page > 1
  const canNext = page < totalPages

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={clsx('flex items-center justify-between gap-4 px-4 py-3', className)}
    >
      <button
        type="button"
        onClick={() => canPrev && onChange?.(page - 1)}
        disabled={!canPrev}
        className={clsx(
          'inline-flex h-11 items-center gap-1 rounded-md px-3',
          'text-body-m font-medium text-text-primary',
          'hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Prev
      </button>
      <span className="text-body-m text-text-secondary tabular-nums">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => canNext && onChange?.(page + 1)}
        disabled={!canNext}
        className={clsx(
          'inline-flex h-11 items-center gap-1 rounded-md px-3',
          'text-body-m font-medium text-text-primary',
          'hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        Next <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </nav>
  )
}