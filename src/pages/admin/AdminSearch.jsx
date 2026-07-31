// AdminSearch — wired to GET /api/admin/search.
// Per docs/pages/21-admin-search.md.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download, Search, Inbox, ChevronDown, ChevronUp, Eye, Receipt,
} from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { SearchField } from '../../components/ui/SearchField.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Pagination } from '../../components/ui/Pagination.jsx'
import { Switch } from '../../components/ui/Switch.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { AmountDisplay } from '../../components/ui/AmountDisplay.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { KeyValueRow } from '../../components/ui/KeyValueRow.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { search, exportCsv, exportPreview } from '../../lib/api/admin-search.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { listCategories } from '../../lib/api/admin-categories.js'
import { listUsers } from '../../lib/api/admin-users.js'
import { ApiError } from '../../lib/api.js'
import { formatPKR, formatDateMedium } from '../../lib/format.js'

const TYPE_OPTIONS = [
  { value: 'all',     label: 'All'      },
  { value: 'INTAKE',  label: 'Intake'   },
  { value: 'EXPENSE', label: 'Expense'  },
]

const PAYMENT_METHODS = [
  { value: 'CASH',      label: 'Cash' },
  { value: 'BANK',      label: 'Bank' },
  { value: 'JAZZCASH',  label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
  { value: 'CARD',      label: 'Card' },
]

const PAGE_SIZE = 25

const EMPTY_FILTERS = {
  search: '',
  dateFrom: '',
  dateTo: '',
  categoryId: '',
  paymentMethod: '',
  userId: '',
  type: 'all',
  amountMin: '',
  amountMax: '',
}

function truncate(text, n) {
  if (!text) return ''
  return text.length > n ? `${text.slice(0, n).trimEnd()}…` : text
}

export default function AdminSearch() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedTx, setSelectedTx] = useState(null)
  const [demoShowAll, setDemoShowAll] = useState(false)

  // Dropdown data
  const catQ = useQuery(() => listCategories({}), [])
  const userQ = useQuery(() => listUsers({ page: 1, pageSize: 200 }), [])

  const setFilter = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const buildParams = (pageArg = page) => {
    const p = {
      page: pageArg,
      pageSize: PAGE_SIZE,
    }
    if (filters.search)        p.q = filters.search
    if (filters.dateFrom)        p.from = filters.dateFrom
    if (filters.dateTo)          p.to = filters.dateTo
    if (filters.categoryId)      p.categoryIds = [filters.categoryId]
    if (filters.paymentMethod)   p.paymentMethods = [filters.paymentMethod]
    if (filters.userId)          p.userIds = [filters.userId]
    if (filters.type !== 'all')  p.type = filters.type
    if (filters.amountMin !== '') p.minAmount = Number(filters.amountMin)
    if (filters.amountMax !== '') p.maxAmount = Number(filters.amountMax)
    return p
  }

  // Skip fetch until user clicks Search (or flips demo mode).
  const q = useQuery(
    () => search(buildParams(page)),
    [demoShowAll, hasSearched, page, JSON.stringify(filters)],
    { enabled: hasSearched || demoShowAll },
  )

  const transactions = q.data?.transactions ?? []
  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = demoShowAll
    ? transactions
    : transactions

  const handleReset = () => {
    setFilters(EMPTY_FILTERS)
    setPage(1)
  }

  const handleSearch = () => {
    setHasSearched(true)
    setPage(1)
  }

  const handleExportCsv = async () => {
    // Build CSV params from current filters (no pagination).
    const p = {}
    if (filters.search)        p.q = filters.search
    if (filters.dateFrom)        p.from = filters.dateFrom
    if (filters.dateTo)          p.to = filters.dateTo
    if (filters.categoryId)      p.categoryIds = [filters.categoryId]
    if (filters.paymentMethod)   p.paymentMethods = [filters.paymentMethod]
    if (filters.userId)          p.userIds = [filters.userId]
    if (filters.type !== 'all')  p.type = filters.type
    if (filters.amountMin !== '') p.minAmount = Number(filters.amountMin)
    if (filters.amountMax !== '') p.maxAmount = Number(filters.amountMax)

    try {
      const blob = await exportCsv({ filters: { ...p } })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'admin-search.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('CSV export failed:', err)
      if (!(err instanceof ApiError)) throw err
    }
  }

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
        title="Search transactions"
        rightAction={
          hasSearched && (
            <GhostButton onClick={handleExportCsv} aria-label="Export CSV">
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">CSV</span>
            </GhostButton>
          )
        }
      />

      <main className="flex-1" aria-label="Admin search">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 md:px-8">
          <Stack gap={4}>
            <Card padding="md" aria-label="Search filters">
              <Stack gap={3}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SearchField
                    label="Search description"
                    aria-label="Search description"
                    placeholder="Search description…"
                    value={filters.search}
                    onChange={setFilter('search')}
                    onClear={() => setFilter('search')('')}
                    className="sm:col-span-1"
                    maxLength={200}
                  />
                  <DatePicker
                    aria-label="From date"
                    helperText="From date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilter('dateFrom')(e.target.value)}
                  />
                  <DatePicker
                    aria-label="To date"
                    helperText="To date"
                    value={filters.dateTo}
                    onChange={(e) => setFilter('dateTo')(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  aria-expanded={showAdvanced}
                  className="inline-flex w-fit items-center gap-1 self-start rounded-md px-1 py-1 text-body-m font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
                >
                  {showAdvanced ? 'Hide advanced filters' : 'Show advanced filters'}
                  {showAdvanced ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <SelectDropdown
                      label="Category"
                      aria-label="Filter by category"
                      options={categoryOptions}
                      value={filters.categoryId}
                      onChange={(e) => setFilter('categoryId')(e.target.value)}
                      placeholder="All categories"
                    />
                    <SelectDropdown
                      label="Payment method"
                      aria-label="Filter by payment method"
                      options={PAYMENT_METHODS}
                      value={filters.paymentMethod}
                      onChange={(e) => setFilter('paymentMethod')(e.target.value)}
                      placeholder="All payment methods"
                    />
                    <SelectDropdown
                      label="Posted by"
                      aria-label="Filter by posted-by user"
                      options={userOptions}
                      value={filters.userId}
                      onChange={(e) => setFilter('userId')(e.target.value)}
                      placeholder="All users"
                    />
                    <div className="flex flex-col gap-2">
                      <span className="text-body-m font-semibold text-text-primary">
                        Type
                      </span>
                      <SegmentedControl
                        ariaLabel="Transaction type"
                        options={TYPE_OPTIONS}
                        value={filters.type}
                        onChange={setFilter('type')}
                      />
                    </div>
                    <NumberInput
                      label="Min amount"
                      aria-label="Minimum amount"
                      variant="compact"
                      value={filters.amountMin}
                      onChange={(e) => setFilter('amountMin')(e.target.value)}
                      placeholder="0"
                    />
                    <NumberInput
                      label="Max amount"
                      aria-label="Maximum amount"
                      variant="compact"
                      value={filters.amountMax}
                      onChange={(e) => setFilter('amountMax')(e.target.value)}
                      placeholder="∞"
                    />
                  </div>
                )}

                <div className="flex flex-row items-center justify-end gap-2 border-t border-border-subtle pt-3">
                  <GhostButton onClick={handleReset} aria-label="Reset filters">
                    Reset filters
                  </GhostButton>
                  <PrimaryButton
                    onClick={handleSearch}
                    aria-label="Run search"
                  >
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Search
                  </PrimaryButton>
                </div>
              </Stack>
            </Card>

            {!hasSearched && !demoShowAll ? (
              <Card padding="lg">
                <EmptyState
                  icon={Search}
                  title="Enter filters and tap Search"
                  message="Results run server-side — they reflect every transaction in the database."
                />
              </Card>
            ) : q.error && !q.loading ? (
              <ErrorState error={q.error} onRetry={q.run} />
            ) : q.loading && !q.data ? (
              <Stack gap={3}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </Stack>
            ) : pageItems.length === 0 ? (
              <Card padding="lg">
                <EmptyState
                  icon={Inbox}
                  title="No transactions match"
                  message="Try widening your date range or removing a filter."
                />
              </Card>
            ) : (
              <Stack gap={3}>
                <div className="flex flex-row items-center justify-between gap-3">
                  <p className="text-body-m font-semibold text-text-primary">
                    {total} transactions match
                  </p>
                  <GhostButton
                    onClick={handleExportCsv}
                    aria-label="Export to CSV"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Export to CSV</span>
                  </GhostButton>
                </div>

                {/* Mobile cards */}
                <ul className="flex flex-col gap-3 sm:hidden" aria-label="Search results (mobile)">
                  {pageItems.map((tx) => {
                    const variant = tx.type.toLowerCase()
                    const signedAmount = tx.type === 'INTAKE' ? Number(tx.amount) : -Number(tx.amount)
                    return (
                      <li key={tx.id}>
                        <Card padding="md" className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={variant}>{tx.type}</Badge>
                            <AmountDisplay amountPkr={signedAmount} signed variant={variant} size="sm" />
                          </div>
                          <p className="text-body-m font-medium text-text-primary">
                            {tx.category?.name ?? '—'} · {tx.subCategory?.name ?? '—'}
                          </p>
                          <p
                            className="text-caption text-text-secondary"
                            title={tx.description}
                          >
                            {truncate(tx.description, 40)}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-caption text-text-tertiary">
                              {formatDateMedium(tx.occurredAt)} · {tx.vendor ?? '—'}
                            </span>
                            <IconButton
                              onClick={() => setSelectedTx(tx)}
                              aria-label={`View details for ${tx.id}`}
                            >
                              <Eye className="h-5 w-5" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </Card>
                      </li>
                    )
                  })}
                </ul>

                {/* Desktop table */}
                <Card padding="none" className="hidden overflow-x-auto sm:block">
                  <table className="min-w-full divide-y divide-border" aria-label="Search results">
                    <thead className="bg-bg-sunken">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Date</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Type</th>
                        <th scope="col" className="px-3 py-2 text-right text-caption font-semibold uppercase tracking-wide text-text-secondary">Amount</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Category</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Sub-category</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Payment</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Description</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Vendor</th>
                        <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Posted by</th>
                        <th scope="col" className="px-3 py-2 text-right text-caption font-semibold uppercase tracking-wide text-text-secondary">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-bg-surface">
                      {pageItems.map((tx) => {
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
                              <AmountDisplay amountPkr={signedAmount} signed variant={variant} size="sm" />
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-body-m text-text-secondary">
                              {tx.category?.name ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-body-m text-text-secondary">
                              {tx.subCategory?.name ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-body-m text-text-secondary">
                              {tx.paymentMethod}
                            </td>
                            <td
                              className="max-w-[14rem] truncate px-3 py-2 text-body-m text-text-primary"
                              title={tx.description}
                            >
                              {truncate(tx.description, 40)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-body-m text-text-secondary">
                              {tx.vendor ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-body-m text-text-secondary">
                              {tx.postedBy?.name ?? tx.postedBy?.username ?? '—'}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right">
                              <IconButton
                                onClick={() => setSelectedTx(tx)}
                                aria-label={`View details for ${tx.id}`}
                              >
                                <Eye className="h-5 w-5" aria-hidden="true" />
                              </IconButton>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Card>

                <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
              </Stack>
            )}

            <Card padding="md" className="border-dashed">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-body-m font-medium text-text-primary">
                    Demo: show all transactions
                  </p>
                  <p className="text-caption text-text-tertiary">
                    Bypass filters for a quick look at the latest 200 rows.
                  </p>
                </div>
                <Switch
                  checked={demoShowAll}
                  onChange={setDemoShowAll}
                  ariaLabel="Show all transactions"
                />
              </div>
            </Card>
          </Stack>
        </div>
      </main>

      <Modal
        open={Boolean(selectedTx)}
        onClose={() => setSelectedTx(null)}
        title={selectedTx ? `Transaction ${selectedTx.id}` : 'Transaction'}
        size="lg"
      >
        {selectedTx && (
          <Stack gap={4}>
            <Card padding="md">
              <dl className="divide-y divide-border-subtle">
                <div className="px-1">
                  <KeyValueRow
                    label="Amount"
                    value={
                      <AmountDisplay
                        amountPkr={selectedTx.type === 'INTAKE' ? Number(selectedTx.amount) : -Number(selectedTx.amount)}
                        signed
                        variant={selectedTx.type.toLowerCase()}
                        size="sm"
                      />
                    }
                  />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Type" value={
                    <Badge variant={selectedTx.type.toLowerCase()}>{selectedTx.type}</Badge>
                  } />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Date" value={formatDateMedium(selectedTx.occurredAt)} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Category" value={selectedTx.category?.name ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Sub-category" value={selectedTx.subCategory?.name ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Payment method" value={selectedTx.paymentMethod} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Description" value={selectedTx.description ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Vendor" value={selectedTx.vendor ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Posted by" value={selectedTx.postedBy?.name ?? selectedTx.postedBy?.username ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Transaction ID" value={selectedTx.id} />
                </div>
              </dl>
            </Card>

            <Card padding="md">
              <Stack gap={2}>
                <p className="text-body-m font-semibold text-text-primary">Receipt</p>
                {selectedTx.receiptUrl ? (
                  <a
                    href={`/api/receipt/${encodeURIComponent(selectedTx.receiptUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <img
                      src={`/api/receipt/${encodeURIComponent(selectedTx.receiptUrl)}`}
                      alt="Receipt"
                      className="h-48 w-full rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div
                    aria-label="Receipt placeholder"
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-sunken text-caption text-text-tertiary"
                  >
                    <Receipt className="h-6 w-6" aria-hidden="true" />
                    <span>No receipt attached</span>
                  </div>
                )}
              </Stack>
            </Card>

            <Link to={`/admin/transactions/${selectedTx.id}`} className="block">
              <PrimaryButton fullWidth>
                Open full detail
              </PrimaryButton>
            </Link>
          </Stack>
        )}
      </Modal>
    </div>
  )
}