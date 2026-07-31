// Admin Reports — wired to /api/admin/reports endpoints.
// Per docs/pages/22-admin-reports.md.
//
// - GET /api/admin/exports/preview      (preview panel)
// - POST /api/admin/reports/pdf         (PDF download)
//
// Per-category breakdown is rendered from the live preview data; mock-data
// references have been removed.

import { useMemo, useState } from 'react'
import { FileText, Download, AlertTriangle } from 'lucide-react'

import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { MultiSelect } from '../../components/ui/MultiSelect.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ProgressBar } from '../../components/ui/ProgressBar.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { exportPreview, reportPdf } from '../../lib/api/admin-search.js'
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
  const d = to && /^\d{4}-\d{2}-\d{2}$/.test(to)
    ? new Date(to)
    : new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `fop-statement-${yyyy}-${mm}.pdf`
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

export default function AdminReports() {
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

  const [generating, setGenerating] = useState(false)
  const [generatedAlert, setGeneratedAlert] = useState(null)
  const [generationError, setGenerationError] = useState(null)

  // Dropdowns
  const catQ  = useQuery(() => listCategories({ isActive: true }), [])
  const userQ = useQuery(() => listUsers({ page: 1, pageSize: 200 }), [])

  // Build params object
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

  // Use string-serialized params for stable dependency tracking
  const paramsKey = useMemo(() => JSON.stringify(params), [
    dateFrom, dateTo, type,
    JSON.stringify(categoryIds), JSON.stringify(subCategoryIds),
    JSON.stringify(paymentMethods), JSON.stringify(userIds),
    amountMin, amountMax,
  ])
  const previewQ = useQuery(
    () => exportPreview(params),
    [paramsKey],
  )

  const previewRows = previewQ.data?.rows ?? []
  const previewTotal = previewQ.data?.total ?? 0

  // Compute per-category subtotals from preview rows.
  const perCategory = useMemo(() => {
    const map = new Map()
    for (const r of previewRows) {
      const id = r.categoryName || '—'
      const current = map.get(id) ?? 0
      map.set(id, current + Number(r.amount))
    }
    return Array.from(map.entries())
      .map(([categoryName, total]) => ({ categoryName, total }))
      .sort((a, b) => b.total - a.total)
  }, [previewRows])

  const previewStats = useMemo(() => {
    let intake = 0
    let expense = 0
    for (const r of previewRows) {
      if (r.type === 'INTAKE') intake += Number(r.amount)
      else if (r.type === 'EXPENSE') expense += Number(r.amount)
    }
    return { intake, expense, net: intake - expense }
  }, [previewRows])

  const hasTransactions = previewTotal > 0
  const canGenerate = hasTransactions && !generating

  const handlePresetChange = (value) => {
    setPreset(value)
    if (value !== 'custom') {
      const { from, to } = presetRange(value)
      setDateFrom(from)
      setDateTo(to)
    }
  }

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setGeneratedAlert(null)
    setGenerationError(null)
    try {
      const blob = await reportPdf({
        from: params.from,
        to: params.to,
        categoryIds: params.categoryIds,
        subCategoryIds: params.subCategoryIds,
        paymentMethods: params.paymentMethods,
        userIds: params.userIds,
        type: params.type,
        minAmount: params.minAmount,
        maxAmount: params.maxAmount,
      })
      triggerBlobDownload(blob, buildFilename(dateTo))
      setGeneratedAlert({
        filename: buildFilename(dateTo),
        count: previewTotal,
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'pdf_generation_failed') {
        setGenerationError('PDF generation failed on the server. Try again or contact support.')
      } else {
        setGenerationError(err?.message || 'Couldn\u2019t generate PDF.')
      }
    } finally {
      setGenerating(false)
    }
  }

  const categoryOptions = (catQ.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))
  const userOptions = (userQ.data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))

  const maxCategoryTotal = useMemo(
    () => perCategory.reduce((m, c) => Math.max(m, c.total), 0),
    [perCategory],
  )

  return (
    <div className="min-h-screen bg-bg-app text-text-primary">
      <AdminTopBar
        title="Reports"
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
            </Stack>
          </Card>

          {/* Preview panel */}
          <Card padding="lg">
            <Stack gap={4}>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-text-secondary" aria-hidden="true" />
                <h2 className="text-body-l font-semibold text-text-primary">
                  Preview for selected period
                </h2>
              </div>

              {previewQ.error && !previewQ.loading && (
                <ErrorState error={previewQ.error} onRetry={previewQ.run} />
              )}

              {previewQ.loading && !previewQ.data ? (
                <Stack gap={3}>
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </Stack>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Total income"  value={formatPKR(previewStats.intake)}  variant="intake" />
                    <StatCard label="Total expense" value={formatPKR(previewStats.expense)} variant="expense" />
                    <StatCard
                      label="Net balance"
                      value={formatPKR(previewStats.net)}
                      variant={previewStats.net >= 0 ? 'intake' : 'expense'}
                    />
                  </div>

                  <Card padding="md" variant="filled">
                    <Stack gap={3}>
                      <h3 className="text-body-m font-semibold text-text-primary">
                        Per-category subtotals
                      </h3>
                      {perCategory.length === 0 ? (
                        <p className="text-body-m text-text-tertiary">
                          No transactions in this period.
                        </p>
                      ) : (
                        <Stack gap={2}>
                          {perCategory.map((row) => (
                            <ProgressBar
                              key={row.categoryName}
                              label={row.categoryName}
                              value={row.total}
                              max={maxCategoryTotal}
                              variant="neutral"
                              trailing={formatPKR(row.total)}
                            />
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Card>

                  <p className="text-caption text-text-tertiary" aria-live="polite">
                    Showing {previewRows.length} of {previewTotal} transactions
                  </p>

                  {!hasTransactions && (
                    <EmptyState
                      icon={FileText}
                      title="No transactions match these filters"
                      message="Try widening the date range or clearing one of the selections."
                    />
                  )}
                </>
              )}
            </Stack>
          </Card>

          {/* Generate action */}
          <Card padding="lg" className="sticky bottom-4 z-10 shadow-raised sm:bottom-6">
            <Stack gap={3}>
              {generatedAlert && (
                <InlineAlert variant="success" title="PDF downloaded" icon={Download}>
                  {generatedAlert.filename} ({generatedAlert.count} transactions)
                </InlineAlert>
              )}
              {generationError && (
                <InlineAlert variant="danger" title="PDF generation failed" icon={AlertTriangle}>
                  {generationError}
                </InlineAlert>
              )}

              <PrimaryButton
                fullWidth
                disabled={!canGenerate}
                aria-disabled={!canGenerate}
                onClick={handleGenerate}
                className="h-14 text-body-l"
              >
                {generating ? (
                  <>
                    <Spinner size="md" label="Generating PDF" />
                    Generating PDF…
                  </>
                ) : (
                  <>
                    <Download className="h-5 w-5" aria-hidden="true" />
                    Generate PDF
                  </>
                )}
              </PrimaryButton>

              {!hasTransactions && !generating && (
                <p className="text-caption text-text-tertiary text-center">
                  No data to report. Adjust filters to enable PDF generation.
                </p>
              )}
            </Stack>
          </Card>
        </Stack>
      </Container>
    </div>
  )
}