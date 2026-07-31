import clsx from 'clsx'

/**
 * JsonDiff — side-by-side before/after viewer.
 * Per docs/pages/24-admin-audit.md §5 "JSON diff viewer".
 *
 * For static UI: renders before + after JSON as formatted blocks with
 * + / − indicators (very lightweight — not a full JSON-tree diff).
 *
 * Props:
 *  - before: object | null
 *  - after:  object | null
 */
export function JsonDiff({ before, after }) {
  const beforeStr = before ? JSON.stringify(before, null, 2) : '(none)'
  const afterStr  = after  ? JSON.stringify(after,  null, 2) : '(none)'

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-danger-700">Before</p>
        <pre className={clsx(
          'overflow-x-auto rounded-md border border-danger-200 bg-danger-50 p-3',
          'font-mono text-caption text-text-primary',
        )}>
          {beforeStr}
        </pre>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-caption font-semibold uppercase tracking-wide text-success-700">After</p>
        <pre className={clsx(
          'overflow-x-auto rounded-md border border-success-200 bg-success-50 p-3',
          'font-mono text-caption text-text-primary',
        )}>
          {afterStr}
        </pre>
      </div>
    </div>
  )
}