// Admin Exports — wired to /api/admin/exports/csv.
// Per docs/pages/23-admin-exports.md.

import { useMemo, useState } from 'react'
import { Download, AlertTriangle } from 'lucide-react'

import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { MultiSelect } from '../../components/ui/MultiSelect.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { Switch } from '../../components/ui/Switch.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { exportPreview, exportCsv } from '../../lib/api/admin-search.js'
import { listCategories } from '../../lib/api/admin-categories.js'
import { listUsers } from '../../lib/api/admin-users.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatPKR } from '../../lib/format.js'

const PRESET_OPTIONS = [
  { value: 'today',   label: 'Today' },
  { value: 'week',    label: 'This week' },
  { value: 'month',   label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year',    label: 'This year' },
  { value: 'custom',  label: 'Custom' },
]

const TYPE_OPTIONS = [
  { value: 'all',     label: 'All' },
  { value: 'INTAKE',  label: 'Intake' },
  { value: 'EXPENSE', label: 'Expense' },
]

function isoToday() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

function presetRange(preset) {
  const today = new Date()
  const end = isoToday()
  const start = new Date(today)

  if (preset === 'today') {
    // start === end
  } else if (preset === 'week') {
    start.setDate(start.getDate() - 6)
  } else if (preset === 'month') {
    start.setDate(1)
  } else if (preset === 'quarter') {
    start.setDate(1)
    start.setMonth(start.getMonth() - 2)
  } else if (preset === 'year') {
    start.setMonth(0, 1)
  }
  return { from: start.toISOString().slice(0, 10), to: end }
}

function buildFilename(to) {
  const d = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(to) : new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `fop-transactions-${yyyy}-${mm}-${dd}.csv`
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function AdminExports() {
  const initialRange = presetRange('month')
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo]     = useState(initialRange.to)
  const [preset, setPreset]     = useState('month')

  const [categoryIds, setCategoryIds]       = useState([])
  const [subCategoryIds, setSubCategoryIds] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [userIds, setUserIds]               = useState([])
  const [type, setType]                     = useState('all')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')

  const [includeSoftDeleted, setIncludeSoftDeleted] = useState(false)
  const [includeEditHistory, setIncludeEditHistory] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [generatedAlert, setGeneratedAlert] = useState(null)
  const [generationError, setGenerationError] = useState(null)

  const catQ  = useQuery(() => listCategories({ isActive: true }), [])
  const userQ = useQuery(() => listUsers({ page: 1, pageSize: 200 }), [])

  const params = useMemo(() => ({
    from: dateFrom,
    to: dateTo,
    type: type === 'all' ? undefined : type,
    categoryIds: categoryIds.length ? categoryIds : undefined,
    subCategoryIds: subCategoryIds.length ? subCategoryIds : undefined,
    paymentMethods: paymentMethods.length ? paymentMethods : undefined,
    userIds: userIds.length ? userIds : undefined,
    minAmount: amountMin === '' ? undefined : Number(amountMin),
    maxAmount: amountMax === '' ? undefined : Number(amountMax),
  }), [dateFrom, dateTo, type, categoryIds, subCategoryIds, paymentMethods, userIds, amountMin, amountMax])

  const previewQ = useQuery(() => exportPreview(params), [
    dateFrom, dateTo, type,
    JSON.stringify(categoryIds), JSON.stringify(subCategoryIds),
    JSON.stringify(paymentMethods), JSON.stringify(userIds),
    amountMin, amountMax,
  ])

  const previewRows = previewQ.data?.rows ?? []
  const previewTotal = previewQ.data?.total ?? 0
  const previewHeaders = previewQ.data?.headers ?? []
  const canExport = previewTotal > 0 && !generating

  const handlePresetChange = (value) => {
    setPreset(value)
    if (value !== 'custom') {
      const { from, to } = presetRange(value)
      setDateFrom(from)
      setDateTo(to)
    }
  }

  const handleExport = async () => {
    if (!canExport) return
    setGenerating(true)
    setGeneratedAlert(null)
    setGenerationError(null)
    try {
      const blob = await exportCsv({
        filters: {
          from: params.from,
          to: params.to,
          type: params.type,
          categoryIds: params.categoryIds,
          subCategoryIds: params.subCategoryIds,
          paymentMethods: params.paymentMethods,
          userIds: params.userIds,
          minAmount: params.minAmount,
          maxAmount: params.maxAmount,
        },
        includeSoftDeleted,
        includeEditHistory,
      })
      triggerBlobDownload(blob, buildFilename(dateTo))
      setGeneratedAlert({
        filename: buildFilename(dateTo),
        count: previewTotal,
      })
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
      setGenerationError(err.message || 'Couldn\u2019t export CSV.')
    } finally {
      setGenerating(false)
    }
  }

  const categoryOptions = (catQ.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))
  const userOptions = (userQ.data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))

  return (
    <div className="min-h-screen bg-bg-app text-text-primary">
      <AdminTopBar
        title="Exports"
        currentAdmin={{ id: 'u-aisha', name: 'Aisha Khan' }}
      />

      <Container className="py-6">
        <Stack gap={6}>
          {/* Filter panel */}
          <Card padding="lg">
            <Stack gap={4}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DatePicker
                  label="From"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => { setDateFrom(e.target.value); setPreset('custom') }}
                />
                <DatePicker
                  label="To"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => { setDateTo(e.target.value); setPreset('custom') }}
                />
              </div>

              <div>
                <p className="mb-2 text-body-m font-semibold text-text-primary">Quick presets</p>
                <SegmentedControl
                  ariaLabel="Date range preset"
                  options={PRESET_OPTIONS}
                  value={preset}
                  onChange={handlePresetChange}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <MultiSelect
                  label="Category"
                  options={categoryOptions}
                  value={categoryIds}
                  onChange={setCategoryIds}
                  placeholder="All categories"
                  disabled={categoryOptions.length === 0}
                />
                <MultiSelect
                  label="Sub-category"
                  options={[]}
                  value={subCategoryIds}
                  onChange={setSubCategoryIds}
                  placeholder="All sub-categories"
                  disabled
                />
                <MultiSelect
                  label="Payment method"
                  options={[
                    { value: 'CASH',      label: 'Cash' },
                    { value: 'BANK',      label: 'Bank' },
                    { value: 'JAZZCASH',  label: 'JazzCash' },
                    { value: 'EASYPAISA', label: 'Easypaisa' },
                    { value: 'CARD',      label: 'Card' },
                  ]}
                  value={paymentMethods}
                  onChange={setPaymentMethods}
                  placeholder="All methods"
                />
                <MultiSelect
                  label="User"
                  options={userOptions}
                  value={userIds}
                  onChange={setUserIds}
                  placeholder="All users"
                  disabled={userOptions.length === 0}
                />
              </div>

              <div>
                <p className="mb-2 text-body-m font-semibold text-text-primary">Type</p>
                <SegmentedControl
                  ariaLabel="Transaction type"
                  options={TYPE_OPTIONS}
                  value={type}
                  onChange={setType}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <NumberInput label="Amount min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="0" />
                <NumberInput label="Amount max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="Any" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-sunken px-4 py-3">
                  <div>
                    <p className="text-body-m font-semibold text-text-primary">Include soft-deleted</p>
                    <p className="text-caption text-text-tertiary">
                      Add rows that were removed by admin.
                    </p>
                  </div>
                  <Switch
                    checked={includeSoftDeleted}
                    onChange={setIncludeSoftDeleted}
                    aria-label="Include soft-deleted"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-sunken px-4 py-3">
                  <div>
                    <p className="text-body-m font-semibold text-text-primary">Include edit history</p>
                    <p className="text-caption text-text-tertiary">
                      Append a row for every prior edit.
                    </p>
                  </div>
                  <Switch
                    checked={includeEditHistory}
                    onChange={setIncludeEditHistory}
                    aria-label="Include edit history"
                  />
                </div>
              </div>
            </Stack>
          </Card>

          {/* Preview panel */}
          <Card padding="lg">
            <Stack gap={4}>
              {previewQ.error && !previewQ.loading && (
                <ErrorState error={previewQ.error} onRetry={previewQ.run} />
              )}

              {previewQ.loading && !previewQ.data ? (
                <Stack gap={3}>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </Stack>
              ) : previewRows.length === 0 ? (
                <EmptyState
                  title="No transactions match"
                  message="Adjust filters to enable CSV export."
                />
              ) : (
                <>
                  <p className="text-caption text-text-tertiary" aria-live="polite">
                    Showing first {previewRows.length} of {previewTotal} transactions · CSV columns ({previewHeaders.length}):
                    {' '}
                    <code className="font-mono">{previewHeaders.slice(0, 5).join(', ')}{previewHeaders.length > 5 ? '…' : ''}</code>
                  </p>

                  <Card padding="none" className="overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table
                        columns={[
                          { key: 'id', label: 'ID' },
                          {
                            key: 'type',
                            label: 'Type',
                            render: (row) => <span className="font-semibold uppercase">{row.type}</span>,
                          },
                          {
                            key: 'amount',
                            label: 'Amount',
                            align: 'right',
                            render: (row) => formatPKR(row.amount),
                          },
                          { key: 'categoryName', label: 'Category' },
                          { key: 'postedByUsername', label: 'Posted by' },
                          {
                            key: 'paymentMethod',
                            label: 'Method',
                            render: (row) => row.paymentMethod,
                          },
                          {
                            key: 'occurredAt',
                            label: 'Date',
                            render: (row) => row.occurredAt?.slice(0, 10) ?? '—',
                          },
                        ]}
                        rows={previewRows}
                      />
                    </div>
                  </Card>
                </>
              )}
            </Stack>
          </Card>

          {/* Export action */}
          <Card padding="lg" className="sticky bottom-4 z-10 shadow-raised sm:bottom-6">
            <Stack gap={3}>
              {generatedAlert && (
                <InlineAlert variant="success" title="CSV downloaded" icon={Download}>
                  {generatedAlert.filename} ({generatedAlert.count} transactions)
                </InlineAlert>
              )}
              {generationError && (
                <InlineAlert variant="danger" title="Export failed" icon={AlertTriangle}>
                  {generationError}
                </InlineAlert>
              )}

              <PrimaryButton
                fullWidth
                disabled={!canExport}
                aria-disabled={!canExport}
                onClick={handleExport}
                className="h-14 text-body-l"
              >
                {generating ? (
                  <>
                    <Spinner size="md" label="Exporting" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" aria-hidden="true" />
                    Export CSV ({previewTotal} transactions)
                  </>
                )}
              </PrimaryButton>

              {previewTotal === 0 && !generating && (
                <p className="text-caption text-text-tertiary text-center">
                  No data to export. Adjust filters to enable CSV export.
                </p>
              )}
            </Stack>
          </Card>
        </Stack>
      </Container>
    </div>
  )
}