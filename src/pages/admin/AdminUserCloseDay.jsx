// AdminUserCloseDay — wired to:
//   - GET /api/admin/users/:id                  (user context)
//   - GET /api/close-day?date=...&userId=...    (expected totals)
//   - POST /api/admin/close-day/:userId          (submit with reason)
//
// Per docs/pages/17-admin-user-close-day.md.

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { RoleBadge } from '../../components/ui/RoleBadge.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { VarianceBanner } from '../../components/ui/VarianceBanner.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { getUser } from '../../lib/api/admin-users.js'
import { getCloseDay, adminCloseDay } from '../../lib/api/close-day.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatPKR } from '../../lib/format.js'

const REASON_MIN_CHARS = 20
const BACK_DAYS_ADMIN = 365

const PAYMENT_METHODS = [
  { value: 'CASH',      label: 'Cash' },
  { value: 'BANK',      label: 'Bank' },
  { value: 'JAZZCASH',  label: 'JazzCash' },
  { value: 'EASYPAISA', label: 'Easypaisa' },
  { value: 'CARD',      label: 'Card' },
]

function isoToday() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function isoOffsetDays(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function sanitizeAmount(raw) {
  if (raw == null) return ''
  const cleaned = String(raw).replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  const intPart = parts.shift() || ''
  const rest = parts.join('').slice(0, 2)
  if (parts.length > 0) return `${intPart || '0'}.${rest}`
  return intPart
}

function toNumberOrZero(v) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function buildZeroedCounted() {
  return PAYMENT_METHODS.reduce((acc, m) => {
    acc[m.value] = 0
    return acc
  }, {})
}

export default function AdminUserCloseDay() {
  const navigate = useNavigate()
  const { id } = useParams()

  const userQ = useQuery(() => getUser(id), [id])

  const [date, setDate] = useState(isoToday())
  const [countedByMethod, setCountedByMethod] = useState(buildZeroedCounted)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [topError, setTopError] = useState(null)

  // Live expected totals — server-computed.
  const expectedQ = useQuery(
    () => getCloseDay(date, id),
    [date, id],
  )

  const expectedByMethod = expectedQ.data?.expectedByMethod ?? {}
  const alreadyClosed = expectedQ.data?.closed === true

  const varianceRows = PAYMENT_METHODS.map((m) => {
    const counted = toNumberOrZero(countedByMethod[m.value])
    const expected = toNumberOrZero(expectedByMethod[m.value])
    return {
      method: m.value,
      label: m.label,
      counted,
      expected,
      variance: counted - expected,
    }
  })

  const totalExpected = varianceRows.reduce((s, r) => s + r.expected, 0)
  const totalCounted = varianceRows.reduce((s, r) => s + r.counted, 0)
  const totalVariance = varianceRows.reduce((s, r) => s + r.variance, 0)
  const hasLiveVariance = totalVariance !== 0

  const reasonTrimmed = reason.trim()
  const reasonTooShort = reasonTrimmed.length < REASON_MIN_CHARS
  const reasonError =
    reason.length > 0 && reasonTooShort
      ? `Reason must be at least ${REASON_MIN_CHARS} characters (currently ${reasonTrimmed.length}).`
      : null
  const submitDisabled = reasonTooShort || isSubmitting || alreadyClosed

  function handleMethodChange(methodValue, rawValue) {
    const sanitized = sanitizeAmount(rawValue)
    setCountedByMethod((prev) => ({
      ...prev,
      [methodValue]: sanitized === '' ? 0 : Number(sanitized),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitDisabled) return
    setTopError(null)
    setIsSubmitting(true)
    try {
      await adminCloseDay(id, {
        closeDate: date,
        countedByMethod: PAYMENT_METHODS.reduce((acc, m) => {
          acc[m.value] = toNumberOrZero(countedByMethod[m.value])
          return acc
        }, {}),
        notes: notes.trim() || undefined,
        reason: reason.trim(),
      })
      expectedQ.run()
      setSubmitted(true)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'day_already_closed') {
          setTopError('This day is already closed for this user.')
        } else if (err.code === 'date_in_future') {
          setTopError('Cannot close a future date.')
        } else if (err.code === 'date_too_old') {
          setTopError('This date is too far back. Admin limit is 365 days.')
        } else if (err.code === 'user_not_found') {
          setTopError('User no longer exists.')
        } else if (err.fields) {
          const firstField = Object.keys(err.fields)[0]
          setTopError(err.fields[firstField][0])
        } else {
          setTopError(err.message || 'Couldn\u2019t close day.')
        }
      } else {
        setTopError(err?.message || 'Couldn\u2019t close day.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancel() {
    navigate(`/admin/users/${id}`)
  }

  function handleBackToUserDetail() {
    navigate(`/admin/users/${id}`)
  }

  function handleEditAgain() {
    setSubmitted(false)
    expectedQ.run()
  }

  if (userQ.loading && !userQ.data) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page">
        <AdminTopBar title="Loading…" back={`/admin/users/${id}`} />
        <main className="flex-1"><Container variant="narrow" className="py-6">
          <Skeleton className="h-32 w-full" />
        </Container></main>
      </div>
    )
  }

  if (userQ.error && !userQ.data) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page">
        <AdminTopBar title="User" back={`/admin/users/${id}`} />
        <main className="flex-1"><Container variant="narrow" className="py-6">
          <ErrorState error={userQ.error} onRetry={userQ.run} />
        </Container></main>
      </div>
    )
  }

  const user = userQ.data ?? { id, name: 'Unknown user', role: 'USER', isActive: true }

  // ── Post-submit summary ──────────────────────────────────────────────────
  if (submitted) {
    const summaryRows = varianceRows.map((r) => ({ ...r, id: r.method }))
    const summaryPerMethod = summaryRows.map((r) => ({
      method: r.label,
      counted: r.counted,
      expected: r.expected,
      variance: r.variance,
    }))

    return (
      <div className="flex min-h-screen flex-col bg-bg-page">
        <AdminTopBar title={`Close day for ${user.name}`} back={`/admin/users/${id}`} />

        <main className="flex-1">
          <Container variant="narrow" className="py-6">
            <Stack gap={6}>
              <VarianceBanner
                totalVariance={totalVariance}
                hasVariance={totalVariance !== 0}
                perMethod={summaryPerMethod}
              />

              <Card>
                <h2 className="text-h4 font-semibold text-text-primary">
                  Per-method breakdown
                </h2>
                <p className="mt-1 text-caption text-text-tertiary">
                  {date} — closed on behalf of {user.name}. Compared against expected totals from posted transactions.
                </p>
                <div className="mt-4">
                  <Table
                    columns={[
                      { key: 'method', label: 'Method', render: (row) => <span className="font-semibold">{row.label}</span> },
                      { key: 'counted', label: 'Counted', align: 'right', render: (row) => formatPKR(row.counted) },
                      { key: 'expected', label: 'Expected', align: 'right', render: (row) => formatPKR(row.expected) },
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
                    rows={summaryRows}
                  />
                </div>
              </Card>

              <Card>
                <h2 className="text-h4 font-semibold text-text-primary">Reason recorded</h2>
                <p className="mt-2 whitespace-pre-wrap text-body-m text-text-primary">{reason}</p>
                <p className="mt-2 text-caption text-text-tertiary">
                  This reason has been written to the audit log (action: dayclose.create_by_admin).
                </p>
              </Card>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <GhostButton onClick={handleEditAgain}>Edit and resubmit</GhostButton>
                <PrimaryButton variant="primary" onClick={handleBackToUserDetail}>
                  Back to admin user detail
                </PrimaryButton>
              </div>
            </Stack>
          </Container>
        </main>
      </div>
    )
  }

  // ── Pre-submit form ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-bg-page">
      <AdminTopBar title={`Close day for ${user.name}`} back={`/admin/users/${id}`} />

      <main className="flex-1">
        <Container variant="narrow" className="py-6">
          <Stack gap={6}>
            {topError && (
              <InlineAlert variant="danger" title="Couldn\u2019t close day">
                {topError}
              </InlineAlert>
            )}

            <Card>
              <div className="flex items-center gap-3">
                <Avatar name={user.name} size="md" />
                <div className="flex flex-col gap-1">
                  <span className="text-body-l font-semibold text-text-primary">{user.name}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={user.role} />
                    <span className="text-caption text-text-tertiary">User ID: {user.id}</span>
                  </div>
                </div>
              </div>
              {!user.isActive && (
                <div className="mt-3">
                  <InlineAlert variant="warning" title="User inactive">
                    This user is inactive. You may still close the day for them (back-filling history).
                  </InlineAlert>
                </div>
              )}
            </Card>

            <form onSubmit={handleSubmit} noValidate>
              <Stack gap={6}>
                <DatePicker
                  label="Closing date"
                  required
                  value={date}
                  min={isoOffsetDays(-BACK_DAYS_ADMIN)}
                  max={isoToday()}
                  onChange={(e) => setDate(e.target.value)}
                  helperText="Admins can close a day up to 365 days back (user limit is 7)."
                />

                {alreadyClosed && (
                  <InlineAlert variant="warning" title="This day is already closed">
                    View the existing close from the user&rsquo;s dashboard.
                  </InlineAlert>
                )}

                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="text-h4 font-semibold text-text-primary">
                      Expected for {user.name} on {date}
                    </h2>
                    <span className="text-caption text-text-tertiary">
                      Read-only · from posted transactions
                    </span>
                  </div>
                  <div className="mt-4">
                    <Table
                      columns={[
                        { key: 'method', label: 'Method', render: (row) => <span className="font-semibold">{row.label}</span> },
                        {
                          key: 'expected',
                          label: 'Expected',
                          align: 'right',
                          render: (row) => <span className="tabular-nums text-text-primary">{formatPKR(row.expected)}</span>,
                        },
                      ]}
                      rows={expectedQ.loading && !expectedQ.data
                        ? []
                        : PAYMENT_METHODS.map((m) => ({
                            id: m.value,
                            label: m.label,
                            expected: toNumberOrZero(expectedByMethod[m.value]),
                          }))}
                    />
                    {expectedQ.loading && (
                      <p className="mt-2 text-caption text-text-tertiary">Loading expected…</p>
                    )}
                  </div>
                </Card>

                <div>
                  <p className="mb-2 text-body-m font-semibold text-text-primary">
                    Counted amounts (PKR)
                  </p>
                  <p className="mb-4 text-caption text-text-tertiary">
                    Enter the actual amount you counted for {user.name} for each payment method.
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {PAYMENT_METHODS.map((m) => (
                      <NumberInput
                        key={m.value}
                        label={m.label}
                        variant="compact"
                        inputMode="decimal"
                        value={countedByMethod[m.value] === 0 ? '' : String(countedByMethod[m.value])}
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
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes…"
                  rows={3}
                  disabled={alreadyClosed}
                />

                <Textarea
                  label="Reason (required)"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you are closing this day on the user's behalf…"
                  helperText="Required for audit trail — why are you closing this on their behalf? (min 20 characters)"
                  error={reasonError}
                  aria-required="true"
                  rows={4}
                />

                {reasonError && (
                  <InlineAlert variant="danger" title="Reason required">
                    Please provide at least {REASON_MIN_CHARS} characters explaining why you are closing this day on the user&rsquo;s behalf. ({reasonTrimmed.length} / {REASON_MIN_CHARS})
                  </InlineAlert>
                )}

                <Card>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body-m font-semibold text-text-primary">Live variance</span>
                    <span className="text-caption text-text-tertiary">Updates as you type</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-body-m">
                    <dt className="text-text-tertiary">Expected total</dt>
                    <dd className="text-right tabular-nums text-text-primary">{formatPKR(totalExpected)}</dd>
                    <dt className="text-text-tertiary">Counted total</dt>
                    <dd className="text-right tabular-nums text-text-primary">{formatPKR(totalCounted)}</dd>
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
                </Card>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <GhostButton onClick={handleCancel} disabled={isSubmitting}>
                    Cancel
                  </GhostButton>
                  <PrimaryButton type="submit" variant="primary" fullWidth disabled={submitDisabled}>
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size="sm" label="Submitting" />
                        Closing…
                      </span>
                    ) : (
                      `Close day for ${user.name}`
                    )}
                  </PrimaryButton>
                </div>
              </Stack>
            </form>
          </Stack>
        </Container>
      </main>
    </div>
  )
}