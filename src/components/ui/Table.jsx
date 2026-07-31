import clsx from 'clsx'

/**
 * Table — simple tabular display with consistent padding.
 * Per docs/design-system/components/09-components-data.md
 *
 * Props:
 *  - columns: Array<{ key, label, align?: 'left'|'right'|'center', render?: (row) => ReactNode, className?: string }>
 *  - rows: Array<object>
 *  - empty: ReactNode
 *  - striped: boolean
 */
export function Table({ columns = [], rows = [], empty, striped = false, className }) {
  if (!rows.length) {
    return <div className="p-8 text-center text-body-m text-text-tertiary">{empty ?? 'No data'}</div>
  }
  return (
    <div className={clsx('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="w-full">
        <thead className="bg-bg-sunken">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={clsx(
                  'px-4 py-3 text-caption font-semibold uppercase tracking-wide text-text-secondary',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  !col.align && 'text-left',
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((row, idx) => (
            <tr
              key={row.id ?? idx}
              className={clsx(striped && idx % 2 === 1 && 'bg-bg-sunken')}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={clsx(
                    'px-4 py-3 text-body-m text-text-primary',
                    col.align === 'right' && 'text-right tabular-nums',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}