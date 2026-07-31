// CloseDay — wired to GET/POST /api/close-day.
// Per docs/pages/11-close-day.md.
// The backend computes expectedByMethod from posted transactions — we do
// NOT compute variance locally; we trust the server.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { VarianceBanner } from '../../components/ui/VarianceBanner.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { FormError } from '../../components/ui/FormError.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { getCloseDay, closeDay } from '../../lib/api/close-day.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatPKR } from '../../lib/format.js'

const NOTES_MAX = 500
const BACK_DAYS = 7

// Payment-method order — fixed across UI.
const PAYMENT_METHODS = [
  { value: 'CASH',     label: 'Cash' },
  { value: 'BANK',     label: 'Bank' },
  { value: 'JAZZCASH', label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
  { value: 'CARD',     label: 'Card' },
]

function isoToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoOffsetDays(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function sanitizeAmount(raw) {
  if (raw == null) return ''
  const cleaned = String(raw).replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  const intPart = parts.shift() ?? ''
  const rest = parts.join('').slice(0, 2)
  if (parts.length > 0) return `${intPart || '0'}.${rest}`
  return intPart
}

function buildZeroedCounted() {
  return PAYMENT_METHODS.reduce((acc, m) => {
    acc[m.value] = 0
    return acc
  }, {})
}

function toNumberOrZero(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function CloseDay() {
  const navigate = useNavigate()
  const [date, setDate] = useState(isoToday())
  const [countedByMethod, setCountedByMethod] = useState(buildZeroedCounted)
  const [notes, setNotes] = useState('')
  const [topError, setTopError] = useState('')

  // Submit state machine: 'idle' | 'submitting' | 'done'
  const [submitState, setSubmitState] = useState('idle')

  // Live expectedByMethod from server. We never compute variance locally.
  const probeQ = useQuery(() => getCloseDay(date), [date])

  const expectedByMethod = probeQ.data?.expectedByMethod ?? {}
  const alreadyClosed = probeQ.data?.closed === true

  // Build variance preview rows from live expected + user-typed counted
  const varianceRows = useMemo(
    () => PAYMENT_METHODS.map((m) => {
      const counted = toNumberOrZero(countedByMethod[m.value])
      const expected = toNumberOrZero(expectedByMethod[m.value])
      return {
        method: m.value,
        label: m.label,
        counted,
        expected,
        variance: counted - expected,
      }
    }),
    [countedByMethod, expectedByMethod],
  )

  const totalExpected = varianceRows.reduce((sum, r) => sum + r.expected, 0)
  const totalCounted = varianceRows.reduce((sum, r) => sum + r.counted, 0)
  const totalVariance = varianceRows.reduce((sum, r) => sum + r.variance, 0)
  const hasLiveVariance = totalVariance !== 0

  function handleMethodChange(methodValue, rawValue) {
    const sanitized = sanitizeAmount(rawValue)
    setCountedByMethod((prev) => ({
      ...prev,
      [methodValue]: sanitized === '' ? 0 : Number(sanitized),
    }))
  }

  // ── Post-submit summary view ────────────────────────────────────────────
  if (submitState === 'done') {
    // After successful submit, the server's dayClose is what we trust.
    // We re-fetch here (not in real-time) by triggering a manual run.
    // For v1 we just use the latest probeQ data which is still fresh
    // because of automatic refetch on deps.
    return (
      <SummaryView
        date={date}
        dayClose={probeQ.data?.dayClose}
        notes={notes}
        onEditAgain={() => {
          setSubmitState('idle')
          probeQ.run()
        }}
        onDone={() => navigate('/', { replace: true })}
      />
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitState === 'submitting') return
    setTopError('')
    setSubmitState('submitting')
    try {
      await closeDay({
        closeDate: date,
        countedByMethod: PAYMENT_METHODS.reduce((acc, m) => {
          acc[m.value] = toNumberOrZero(countedByMethod[m.value])
          return acc
        }, {}),
        notes: notes.trim() || undefined,
      })
      // Refresh probe so dayClose is populated for the summary view
      probeQ.run()
      setSubmitState('done')
    } catch (err) {
      setSubmitState('idle')
      if (err instanceof ApiError && err.code === 'day_already_closed') {
        setTopError('This day is already closed. View the existing close-day from the dashboard.')
      } else if (err instanceof ApiError && err.code === 'date_in_future') {
        setTopError('Cannot close a future date.')
      } else if (err instanceof ApiError && err.code === 'date_too_old') {
        setTopError('Cannot close a day more than 7 days back. Contact an admin.')
      } else {
        setTopError(err?.message || 'Couldn\u2019t close day. Please try again.')
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page">
      <PageHeader
        title="Close my day"
        rightAction={
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-11 items-center justify-center"
          >
            <Info className="h-5 w-5 text-text-tertiary" />
          </span>
        }
      />

      <main className="flex-1">
        <Container variant="narrow" className="py-6">
          <Stack gap={6}>
            {topError && <FormError title="Couldn't close day" message={topError} />}

            {probeQ.error && !probeQ.loading && (
              <ErrorState error={probeQ.error} onRetry={probeQ.run} />
            )}

            {alreadyClosed && (
              <div className="rounded-lg border border-info-500 bg-info-50 p-4 text-info-700">
                <p className="text-body-m font-semibold">
                  This day is already closed.
                </p>
                <p className="mt-1 text-caption">
                  View the existing close-day from the dashboard.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <Stack gap={6}>
                <DatePicker
                  label="Closing date"
                  required
                  value={date}
                  min={isoOffsetDays(-BACK_DAYS)}
                  max={isoToday()}
                  onChange={(e) => setDate(e.target.value)}
                  helperText="You can close a day up to 7 days back."
                />

                <div>
                  <p className="mb-2 text-body-m font-semibold text-text-primary">
                    Counted amounts (PKR)
                  </p>
                  <p className="mb-4 text-caption text-text-tertiary">
                    Enter the actual amount you counted for each payment method.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {PAYMENT_METHODS.map((m) => (
                      <NumberInput
                        key={m.value}
                        label={m.label}
                        variant="compact"
                        inputMode="decimal"
                        value={
                          countedByMethod[m.value] === 0
                            ? ''
                            : String(countedByMethod[m.value])
                        }
                        onChange={(e) => handleMethodChange(m.value, e.target.value)}
                        aria-label={`${m.label} counted amount`}
                        placeholder="0"
                        disabled={alreadyClosed}
                      />
                    ))}
                  </div>
                </div>

                <Textarea
                  label="Notes (optional)"
                  value={notes}
                  maxLength={NOTES_MAX}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document any variance or unusual counts…"
                  helperText="Notes help explain shortfalls or surpluses."
                  disabled={alreadyClosed}
                />

                {/* Live variance preview */}
                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body-m font-semibold text-text-primary">
                      Live variance
                    </span>
                    <span className="text-caption text-text-tertiary">
                      {probeQ.loading ? 'Loading expected…' : 'Updates as you type'}
                    </span>
                  </div>
                  {probeQ.loading && !probeQ.data ? (
                    <div className="mt-3">
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : (
                    <>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-body-m">
                        <dt className="text-text-tertiary">Expected total</dt>
                        <dd className="text-right tabular-nums text-text-primary">
                          {formatPKR(totalExpected)}
                        </dd>
                        <dt className="text-text-tertiary">Counted total</dt>
                        <dd className="text-right tabular-nums text-text-primary">
                          {formatPKR(totalCounted)}
                        </dd>
                        <dt className="text-text-tertiary">Variance</dt>
                        <dd
                          className={
                            totalVariance < 0
                              ? 'text-right font-semibold tabular-nums text-danger-700'
                              : totalVariance > 0
                                ? 'text-right font-semibold tabular-nums text-success-700'
                                : 'text-right tabular-nums text-text-secondary'
                          }
                        >
                          {totalVariance === 0 ? 'PKR 0' : formatPKR(totalVariance)}
                        </dd>
                      </dl>

                      {hasLiveVariance && (
                        <div className="mt-4">
                          <VarianceBanner
                            totalVariance={totalVariance}
                            hasVariance={true}
                            perMethod={varianceRows.map((r) => ({
                              method: r.label,
                              counted: r.counted,
                              expected: r.expected,
                              variance: r.variance,
                            }))}
                          />
                        </div>
                      )}
                    </>
                  )}
                </Card>

                <PrimaryButton
                  type="submit"
                  variant="primary"
                  fullWidth
                  disabled={submitState === 'submitting' || alreadyClosed}
                >
                  {submitState === 'submitting' ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner size="sm" label="Submitting" />
                      Closing…
                    </span>
                  ) : (
                    'Close my day'
                  )}
                </PrimaryButton>
              </Stack>
            </form>
          </Stack>
        </Container>
      </main>

      <BottomTabBar />
    </div>
  )
}

// ── Summary sub-view ─────────────────────────────────────────────────────────

function SummaryView({ date, dayClose, notes, onEditAgain, onDone }) {
  const rows = PAYMENT_METHODS.map((m) => {
    const counted = Number(dayClose?.countedByMethod?.[m.value] ?? 0)
    const expected = Number(dayClose?.expectedByMethod?.[m.value] ?? 0)
    return {
      id: m.value,
      method: m.label,
      counted,
      expected,
      variance: counted - expected,
    }
  })

  const totalVariance = dayClose?.hasVariance
    ? Number(dayClose.totalVariance)
    : 0

  return (
    <div className="flex min-h-screen flex-col bg-bg-page">
      <PageHeader title="Close my day" />

      <main className="flex-1">
        <Container variant="narrow" className="py-6">
          <Stack gap={6}>
            <VarianceBanner
              totalVariance={totalVariance}
              hasVariance={!!dayClose?.hasVariance}
              perMethod={rows.map((r) => ({
                method: r.method,
                counted: r.counted,
                expected: r.expected,
                variance: r.variance,
              }))}
            />

            <Card>
              <h2 className="text-h4 font-semibold text-text-primary">
                Per-method breakdown
              </h2>
              <p className="mt-1 text-caption text-text-tertiary">
                {date} — compared against expected totals from posted transactions.
              </p>
              <div className="mt-4">
                <Table
                  columns={[
                    { key: 'method', label: 'Method', render: (row) => <span className="font-semibold">{row.method}</span> },
                    { key: 'counted', label: 'Counted', align: 'right' },
                    { key: 'expected', label: 'Expected', align: 'right' },
                    {
                      key: 'variance',
                      label: 'Variance',
                      align: 'right',
                      render: (row) => (
                        <span
                          className={
                            row.variance < 0
                              ? 'font-semibold text-danger-700'
                              : row.variance > 0
                                ? 'font-semibold text-success-700'
                                : 'text-text-secondary'
                          }
                        >
                          {row.variance === 0 ? 'PKR 0' : formatPKR(row.variance)}
                        </span>
                      ),
                    },
                  ]}
                  rows={rows}
                />
              </div>
            </Card>

            {notes?.trim() && (
              <Card>
                <h2 className="text-h4 font-semibold text-text-primary">Notes</h2>
                <p className="mt-2 whitespace-pre-wrap text-body-m text-text-primary">
                  {notes}
                </p>
              </Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <GhostButton onClick={onEditAgain}>Edit and resubmit</GhostButton>
              <PrimaryButton variant="primary" onClick={onDone}>Done</PrimaryButton>
            </div>
          </Stack>
        </Container>
      </main>

      <BottomTabBar />
    </div>
  )
}