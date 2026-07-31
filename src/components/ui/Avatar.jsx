import clsx from 'clsx'

const sizeMap = {
  sm: 'h-8 w-8 text-caption',
  md: 'h-10 w-10 text-body-m',
  lg: 'h-14 w-14 text-h4',
}

/**
 * Avatar — circular initial-based avatar (no image upload in v1).
 * Per docs/design-system/components/avatar.md
 *
 * Props:
 *  - name: string (used for initials + accessible name)
 *  - size: 'sm' | 'md' | 'lg'
 */
export function Avatar({ name = '', size = 'md', className }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('')

  // Stable color from name hash (pick from design-system color tokens)
  const hash = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0)
  const palette = ['bg-brand-500', 'bg-success-500', 'bg-danger-500', 'bg-warning-500', 'bg-info-500', 'bg-neutral-500']
  const bg = palette[hash % palette.length]

  return (
    <span
      role="img"
      aria-label={name}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-text-inverse',
        sizeMap[size],
        bg,
        className,
      )}
    >
      {initials || '?'}
    </span>
  )
}