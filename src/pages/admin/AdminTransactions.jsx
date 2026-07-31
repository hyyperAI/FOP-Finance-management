// AdminTransactions — wired to GET /api/admin/search.
// Per docs/pages/19-admin-transactions-list.md.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileDown, Receipt } from 'lucide-react'
import clsx from 'clsx'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { AmountDisplay } from '../../components/ui/AmountDisplay.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Pagination } from '../../components/ui/Pagination.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { search, exportCsv } from '../../lib/api/admin-search.js'
import { listCategories } from '../../lib/api/admin-categories.js'
import { listUsers } from '../../lib/api/admin-users.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatPKR, formatDateMedium } from '../../lib/format.js'

const DATE_OPTIONS = [
  { value: '7d',  label: 'Last 7d'  },
  { value: '30d', label: 'Last 30d' },
  { value: '90d', label: 'Last 90d' },
  { value: 'all', label: 'All'      },
]

const TYPE_OPTIONS = [
  { value: 'ALL',    label: 'All'    },
  { value: 'INTAKE', label: 'Intake' },
  { value: 'EXPENSE', label: 'Expense' },
]

const PAYMENT_METHODS = [
  { value: 'CASH',      label: 'Cash' },
  { value: 'BANK',      label: 'Bank' },
  { value: 'JAZZCASH',  label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
  { value: 'CARD',      label: 'Card' },
]

const PAGE_SIZE = 50
const SORTABLE = new Set(['date', 'amount', 'type'])

function dateRangeFor(preset) {
  if (preset === 'all') return {}
  const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  return {
    from: from.toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  }
}

export default function AdminTransactions() {
  const [datePreset, setDatePreset] = useState('30d')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [categoryId, setCategoryId] = useState('')
  const [userId, setUserId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  // Dropdown data
  const catQ = useQuery(() => listCategories({}), [])
  const userQ = useQuery(() => listUsers({ page: 1, pageSize: 200 }), [])

  // The /api/admin/search endpoint doesn't accept a "pageSize > 100" cap, so we
  // fetch up to 100 per page and do client-side sort + paging for the visible
  // window. For v1 we page at 50 server-side.
  const { from, to } = useMemo(() => dateRangeFor(datePreset), [datePreset])

  const params = useMemo(() => ({
    from,
    to,
    type: typeFilter === 'ALL' ? undefined : typeFilter,
    categoryIds: categoryId ? [categoryId] : undefined,
    userIds: userId ? [userId] : undefined,
    paymentMethods: paymentMethod ? [paymentMethod] : undefined,
    page,
    pageSize: PAGE_SIZE,
  }), [from, to, typeFilter, categoryId, userId, paymentMethod, page])

  const q = useQuery(() => search(params), [
    params.from, params.to, params.type,
    JSON.stringify(params.categoryIds),
    JSON.stringify(params.userIds),
    JSON.stringify(params.paymentMethods),
    params.page,
  ])

  // Client-side sort (search endpoint returns in createdAt order).
  const sorted = useMemo(() => {
    const txs = q.data?.transactions ?? []
    const arr = [...txs].sort((a, b) => {
      let cmp = 0
      if (sortBy === 'date') cmp = new Date(b.occurredAt) - new Date(a.occurredAt)
      else if (sortBy === 'amount') cmp = Number(a.amount) - Number(b.amount)
      else if (sortBy === 'type') cmp = a.type.localeCompare(b.type)
      if (cmp === 0) cmp = 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [q.data, sortBy, sortDir])

  const totalIntake = sorted
    .filter((t) => t.type === 'INTAKE')
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = sorted
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + Number(t.amount), 0)

  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const toggleSort = (key) => {
    if (!SORTABLE.has(key)) return
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(key === 'date' ? 'desc' : 'desc')
    }
  }

  const onFilterChange = (setter) => (value) => {
    setter(value)
    setPage(1)
  }

  const sortIndicator = (key) => {
    if (sortBy !== key) return null
    return sortDir === 'asc' ? '▲' : '▼'
  }

  const sortAria = (key) => {
    if (!SORTABLE.has(key)) return undefined
    if (sortBy !== key) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  const handleDownloadCsv = async () => {
    try {
      const blob = await exportCsv({ filters: {
        from: params.from,
        to: params.to,
        type: params.type,
        categoryIds: params.categoryIds,
        userIds: params.userIds,
        paymentMethods: params.paymentMethods,
      } })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'admin-transactions.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
      if (!(err instanceof ApiError)) throw err
    }
  }

  const renderSortHeader = (key, label, extraClass = '') => (
    <th
      scope="col"
      aria-sort={sortAria(key)}
      className={clsx('px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary', extraClass)}
    >
      {SORTABLE.has(key) ? (
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="inline-flex items-center gap-1 rounded text-caption font-semibold uppercase tracking-wide text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
        >
          <span>{label}</span>
          <span aria-hidden="true" className="text-text-tertiary">
            {sortIndicator(key) ?? '↕'}
          </span>
        </button>
      ) : (
        <span>{label}</span>
      )}
    </th>
  )

  const categoryOptions = (catQ.data?.categories ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))
  const userOptions = (userQ.data?.users ?? []).map((u) => ({
    value: u.id,
    label: u.name,
  }))

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title="All Transactions"
        rightAction={
          <div className="flex flex-row items-center gap-2">
            <Link to="/admin/reports" aria-label="Download PDF report">
              <GhostButton>
                <FileDown className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Download PDF</span>
                <span className="sm:hidden">PDF</span>
              </GhostButton>
            </Link>
            <GhostButton onClick={handleDownloadCsv} aria-label="Download CSV">
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Download CSV</span>
              <span className="sm:hidden">CSV</span>
            </GhostButton>
          </div>
        }
      />

      <div
        className="sticky top-0 z-sticky border-b border-border bg-bg-surface px-4 py-3 sm:px-6"
        aria-label="Filters"
      >
        <Stack gap={2}>
          <SegmentedControl
            ariaLabel="Date range"
            options={DATE_OPTIONS}
            value={datePreset}
            onChange={onFilterChange(setDatePreset)}
          />
          <SegmentedControl
            ariaLabel="Transaction type"
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={onFilterChange(setTypeFilter)}
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <SelectDropdown
              aria-label="Filter by category"
              options={categoryOptions}
              value={categoryId}
              onChange={(e) => onFilterChange(setCategoryId)(e.target.value)}
              placeholder="All categories"
            />
            <SelectDropdown
              aria-label="Filter by user"
              options={userOptions}
              value={userId}
              onChange={(e) => onFilterChange(setUserId)(e.target.value)}
              placeholder="All users"
            />
            <SelectDropdown
              aria-label="Filter by payment method"
              options={PAYMENT_METHODS}
              value={paymentMethod}
              onChange={(e) => onFilterChange(setPaymentMethod)(e.target.value)}
              placeholder="All payment methods"
            />
          </div>
        </Stack>
      </div>

      <main className="flex-1 px-4 py-4 sm:px-6" aria-label="All transactions">
        {q.error && !q.loading ? (
          <ErrorState error={q.error} onRetry={q.run} />
        ) : (
          <>
            <section
              aria-label="Summary"
              className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              <Card padding="sm" className="flex items-center justify-between">
                <span className="text-caption uppercase tracking-wide text-text-tertiary">
                  Showing
                </span>
                <span className="text-body-m font-semibold tabular-nums text-text-primary">
                  {total} {total === 1 ? 'transaction' : 'transactions'}
                </span>
              </Card>
              <Card padding="sm" className="flex items-center justify-between">
                <span className="text-caption uppercase tracking-wide text-text-tertiary">
                  Total in
                </span>
                <AmountDisplay
                  amountPkr={totalIntake}
                  variant="intake"
                  size="md"
                  signed
                />
              </Card>
              <Card padding="sm" className="flex items-center justify-between">
                <span className="text-caption uppercase tracking-wide text-text-tertiary">
                  Total out
                </span>
                <AmountDisplay
                  amountPkr={-totalExpense}
                  variant="expense"
                  size="md"
                  signed
                />
              </Card>
            </section>

            {q.loading && !q.data ? (
              <Stack gap={3}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </Stack>
            ) : sorted.length === 0 ? (
              <EmptyState
                title="No transactions match"
                message="Try adjusting the filters or clear them to see all transactions."
              />
            ) : (
              <>
                <ul className="flex flex-col gap-3 sm:hidden" aria-label="Transactions (mobile)">
                  {sorted.map((tx) => {
                    const variant = tx.type.toLowerCase()
                    const signedAmount = tx.type === 'INTAKE' ? Number(tx.amount) : -Number(tx.amount)
                    return (
                      <li key={tx.id}>
                        <Link
                          to={`/transactions/${tx.id}`}
                          className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-border-focus"
                          aria-label={`${tx.type} ${formatPKR(tx.amount)} ${tx.category?.name ?? ''} ${formatDateMedium(tx.occurredAt)}`}
                        >
                          <Card padding="md" className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant={variant}>{tx.type}</Badge>
                              <AmountDisplay amountPkr={signedAmount} signed variant={variant} />
                            </div>
                            <p className="text-body-m font-medium text-text-primary">
                              {tx.vendor ?? tx.category?.name ?? '—'}
                            </p>
                            <p className="text-caption text-text-tertiary">
                              {tx.category?.name ?? '—'} • {tx.subCategory?.name ?? '—'}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-caption text-text-secondary">
                                {tx.vendor ?? '—'} · {tx.paymentMethod}
                              </span>
                              {tx.version > 1 && <Badge variant="edited">Edited</Badge>}
                            </div>
                            <p className="text-caption text-text-tertiary">{formatDateMedium(tx.occurredAt)}</p>
                          </Card>
                        </Link>
                      </li>
                    )
                  })}
                </ul>

                <Card padding="none" className="hidden overflow-x-auto sm:block">
                  <table className="min-w-full divide-y divide-border" aria-label="All transactions">
                    <thead className="bg-bg-sunken">
                      <tr>
                        {renderSortHeader('date', 'Date')}
                        {renderSortHeader('type', 'Type')}
                        {renderSortHeader('amount', 'Amount', 'text-right')}
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">
                          Description
                        </th>
                        <th scope="col" className="px-3 py-2 text-center text-caption font-semibold uppercase tracking-wide text-text-secondary">
                          Receipt
                        </th>
                        <th scope="col" className="px-3 py-2 text-right text-caption font-semibold uppercase tracking-wide text-text-secondary">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-bg-surface">
                      {sorted.map((tx) => {
                        const variant = tx.type.toLowerCase()
                        const signedAmount = tx.type === 'INTAKE' ? Number(tx.amount) : -Number(tx.amount)
                        return (
                          <tr key={tx.id} className="hover:bg-bg-sunken">
                            <td className="whitespace-nowrap px-3 py-2 text-body-m text-text-primary tabular-nums">
                              {formatDateMedium(tx.occurredAt)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2">
                              <Badge variant={variant}>{tx.type}</Badge>
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              <AmountDisplay amountPkr={signedAmount} signed variant={variant} />
                            </td>
                            <td className="max-w-[16rem] truncate px-3 py-2 text-body-m text-text-secondary" title={tx.description ?? tx.vendor ?? ''}>
                              {tx.description ?? tx.vendor ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-center">
                              {tx.receiptUrl ? (
                                <span className="flex items-center justify-center gap-1 text-success-600" title="Receipt attached">
                                  <Receipt className="h-4 w-4" />
                                </span>
                              ) : (
                                <span className="text-text-tertiary" title="No receipt">—</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              <Link
                                to={`/transactions/${tx.id}`}
                                className="inline-flex min-h-11 items-center rounded-md px-2 text-body-m font-semibold text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Card>
              </>
            )}
          </>
        )}
      </main>

      {total > 0 && totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
      )}

      <p className="px-4 pb-6 text-center text-caption text-text-tertiary sm:px-6">
        Showing {total} of {total} transactions
      </p>
    </div>
  )
}