// Transactions list — wired to GET /api/transactions.
// Per docs/pages/07-transactions-list.md.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, Receipt } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { AmountDisplay } from '../../components/ui/AmountDisplay.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Pagination } from '../../components/ui/Pagination.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { listTransactions } from '../../lib/api/transactions.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { formatPKR, formatDateMedium } from '../../lib/format.js'

const PAGE_SIZE = 25

// Preset date ranges → resolved to [from, to] at query time.
const DATE_OPTIONS = [
  { value: '7d',   label: 'Last 7d' },
  { value: '30d',  label: 'Last 30d' },
  { value: '90d',  label: 'Last 90d' },
  { value: 'all',  label: 'All' },
]

const TYPE_OPTIONS = [
  { value: 'ALL',     label: 'All' },
  { value: 'INTAKE',  label: 'Intake' },
  { value: 'EXPENSE', label: 'Expense' },
]

/**
 * Resolve a date preset to { from, to } YYYY-MM-DD strings.
 * Returns {} for 'all'.
 */
function dateRangeFor(preset) {
  if (preset === 'all') return {}
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 30
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  const to = today
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

export default function Transactions() {
  const [datePreset, setDatePreset] = useState('30d')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const { from, to } = useMemo(() => dateRangeFor(datePreset), [datePreset])

  const q = useQuery(
    () => listTransactions({
      from,
      to,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
    [from, to, typeFilter, page],
  )

  const txs = q.data?.transactions ?? []
  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const resetOnChange = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader title="Transactions" />

      <div
        className="sticky top-14 z-10 border-b border-border bg-bg-surface px-4 py-3"
        aria-label="Filters"
      >
        <Stack gap={2}>
          <SegmentedControl
            ariaLabel="Date range"
            options={DATE_OPTIONS}
            value={datePreset}
            onChange={resetOnChange(setDatePreset)}
          />
          <SegmentedControl
            ariaLabel="Transaction type"
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={resetOnChange(setTypeFilter)}
          />
        </Stack>
      </div>

      <main className="flex-1 px-4 py-4 sm:px-6" aria-label="Transactions list">
        {q.error && !q.loading ? (
          <ErrorState error={q.error} onRetry={q.run} />
        ) : q.loading ? (
          <Stack gap={3}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </Stack>
        ) : txs.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            message="Tap Intake or Expense on the home screen to start."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {txs.map((tx) => {
              const variant = tx.type.toLowerCase()
              const signedAmount =
                tx.type === 'INTAKE' ? Number(tx.amount) : -Number(tx.amount)
              const ariaLabel =
                `${tx.type === 'INTAKE' ? 'Intake' : 'Expense'}, ` +
                `${formatPKR(tx.amount)}, ` +
                `${tx.category?.name ?? 'Uncategorised'}, ` +
                `${tx.subCategory?.name ?? ''}, ` +
                `${tx.vendor ?? ''}, ${formatDateMedium(tx.occurredAt)}`

              return (
                <li key={tx.id}>
                  <Link
                    to={`/transactions/${tx.id}`}
                    aria-label={ariaLabel}
                    className="block min-h-16 rounded-lg focus:outline-none focus:ring-2 focus:ring-border-focus"
                  >
                    <Card padding="md" className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={variant}>{tx.type}</Badge>
                          <span className="flex items-center gap-1 text-caption text-text-tertiary">
                            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                            {formatDateMedium(tx.occurredAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AmountDisplay
                            amountPkr={signedAmount}
                            signed
                            variant={variant}
                          />
                          <ChevronRight
                            className="h-5 w-5 text-text-tertiary"
                            aria-hidden="true"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {tx.category?.name ?? 'Uncategorised'}
                        </span>
                        {tx.subCategory?.name && (
                          <>
                            <span className="text-text-tertiary">›</span>
                            <span>{tx.subCategory.name}</span>
                          </>
                        )}
                        <span className="text-text-tertiary">•</span>
                        <span>{tx.paymentMethod}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <span className="text-caption text-text-secondary">
                          {tx.vendor ?? tx.description ?? '—'}
                        </span>
                        <div className="flex items-center gap-2">
                          {tx.receiptUrl && (
                            <span
                              className="flex items-center gap-1 rounded-full bg-bg-sunken px-2 py-0.5 text-caption text-text-secondary"
                              aria-label="Has receipt"
                              title="Has receipt"
                            >
                              <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                              Receipt
                            </span>
                          )}
                          {tx.version > 1 && <Badge variant="edited">Edited</Badge>}
                        </div>
                      </div>
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {total > 0 && (
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      )}

      <BottomTabBar />
    </div>
  )
}