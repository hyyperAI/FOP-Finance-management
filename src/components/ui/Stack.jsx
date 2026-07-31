import clsx from 'clsx'

const gapMap = {
  0: 'gap-0', 1: 'gap-1', 2: 'gap-2', 3: 'gap-3',
  4: 'gap-4', 6: 'gap-6', 8: 'gap-8', 12: 'gap-12',
}

/**
 * Stack — vertical layout with consistent gap.
 * Per docs/design-system/components/stack.md
 */
export function Stack({ gap = 4, as: Tag = 'div', className, children, ...props }) {
  return (
    <Tag className={clsx('flex flex-col', gapMap[gap], className)} {...props}>
      {children}
    </Tag>
  )
}