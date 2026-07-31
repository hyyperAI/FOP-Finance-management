import clsx from 'clsx'

/**
 * Skeleton — loading placeholder block.
 * Per docs/design-system/components/skeleton-loader.md
 *
 * Props:
 *  - className: tailwind for shape (h-* w-*, rounded-*, etc.)
 *  - count: number (renders count stacked with gap)
 */
export function Skeleton({ className, count = 1 }) {
  if (count === 1) {
    return (
      <div
        aria-hidden="true"
        className={clsx('animate-pulse rounded-md bg-neutral-200', className)}
      />
    )
  }
  return (
    <div className={clsx('flex flex-col gap-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-4 w-full animate-pulse rounded-md bg-neutral-200"
        />
      ))}
    </div>
  )
}