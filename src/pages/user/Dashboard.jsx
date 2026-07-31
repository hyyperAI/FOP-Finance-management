// Dashboard — live user dashboard.
// Per docs/pages/12-dashboard-user.md. Wired to GET /api/dashboard.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronRight, RefreshCw } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { ProgressBar } from '../../components/ui/ProgressBar.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { VarianceBanner } from '../../components/ui/VarianceBanner.jsx'
import { KeyValueRow } from '../../components/ui/KeyValueRow.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { getDashboard } from '../../lib/api/dashboard.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { formatPKR, formatDateMedium } from '../../lib/format.js'

const PERIOD_OPTIONS = [
  { value: 'day',     label: 'Today' },
  { value: 'week',    label: 'This week' },
  { value: 'month',   label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year',    label: 'This year' },
  { value: 'custom',  label: 'Custom' },
]

export default function Dashboard() {
  const [period, setPeriod] = useState('month')
  const [customDates, setCustomDates] = useState({ start: '', end: '' })
  const [periodModalOpen, setPeriodModalOpen] = useState(false)
  const [activeClose, setActiveClose] = useState(null)

  const q = useQuery(
    () => getDashboard({
      period,
      ...(period === 'custom' && customDates.start && customDates.end
        ? { startDate: customDates.start, endDate: customDates.end }
        : {}),
    }),
    [period, customDates.start, customDates.end],
  )

  const data = q.data
  const loading = q.loading
  const error = q.error

  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'This month'

  const topMax = data?.topCategories?.[0]?.total ?? 0
  const scaleMax = topMax > 0 ? topMax : 100

  const handleSelectPeriod = (value) => {
    setPeriod(value)
    setPeriodModalOpen(false)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader
        title="Dashboard"
        rightAction={
          <GhostButton
            onClick={() => setPeriodModalOpen(true)}
            aria-label="Select period"
            className="min-h-11 px-3"
          >
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span className="text-caption font-medium">{periodLabel}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </GhostButton>
        }
      />

      <main className="flex-1 px-4 py-4 sm:px-6" aria-label="Personal dashboard">
        <p className="mb-4 text-caption text-text-tertiary">
          Showing: <span className="text-text-secondary">{periodLabel.toLowerCase()}</span>
        </p>

        {error && !loading ? (
          <ErrorState error={error} onRetry={q.run} />
        ) : (
          <Stack gap={3} as="section" role="group" aria-label="Key performance indicators">
            {loading || !data ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : (
              <>
                <StatCard
                  label="Income"
                  value={formatPKR(data.summary.intake)}
                  variant="intake"
                />
                <StatCard
                  label="Expense"
                  value={formatPKR(data.summary.expense)}
                  variant="expense"
                />
                <StatCard
                  label="Net"
                  value={formatPKR(data.summary.net)}
                  variant={data.summary.net >= 0 ? 'intake' : 'expense'}
                />
              </>
            )}
          </Stack>
        )}

        <section className="mt-6" aria-labelledby="top-categories-title">
          <Card padding="md">
            <h2 id="top-categories-title" className="mb-3 text-body-l font-semibold text-text-primary">
              Top categories
            </h2>
            {loading || !data ? (
              <Stack gap={3}>
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </Stack>
            ) : data.topCategories.length === 0 ? (
              <EmptyState
                title="No activity yet"
                message="Log a transaction to see categories here."
              />
            ) : (
              <Stack gap={3}>
                {data.topCategories.map((cat) => (
                  <ProgressBar
                    key={cat.categoryId}
                    label={cat.categoryName}
                    trailing={formatPKR(cat.total)}
                    value={cat.total}
                    max={scaleMax}
                    variant="expense"
                  />
                ))}
              </Stack>
            )}
          </Card>
        </section>

        <section className="mt-6" aria-labelledby="recent-closes-title">
          <Card padding="md">
            <h2 id="recent-closes-title" className="mb-3 text-body-l font-semibold text-text-primary">
              Recent close-days
            </h2>
            {loading || !data ? (
              <Stack gap={2}>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </Stack>
            ) : data.recentCloses.length === 0 ? (
              <EmptyState
                title="No close-days yet"
                message="Submit a close to see history here."
              />
            ) : (
              <ul className="flex flex-col">
                {data.recentCloses.map((close, idx) => {
                  const badgeVariant = close.hasVariance ? 'expense' : 'intake'
                  const badgeLabel = close.status === 'CLOSED_OK' ? 'Balanced' : 'Variance'
                  return (
                    <li key={close.id}>
                      {idx > 0 && <hr className="border-border-subtle" />}
                      <button
                        type="button"
                        onClick={() => setActiveClose(close)}
                        aria-label={`Open close-day for ${formatDateMedium(close.closeDate)}`}
                        className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left focus:outline-none focus:ring-2 focus:ring-border-focus"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-body-m font-medium text-text-primary">
                            {formatDateMedium(close.closeDate)}
                          </span>
                          {close.hasVariance && (
                            <span className="text-caption text-danger-700 tabular-nums">
                              {formatPKR(close.totalVariance)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                          <ChevronRight className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </section>

        <div className="mt-4 text-center">
          <Link
            to="/transactions"
            className="inline-flex min-h-11 items-center text-body-m font-semibold text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
          >
            View all transactions
          </Link>
        </div>

        {!error && (
          <p
            className="mt-3 flex items-center justify-center gap-1 text-caption text-text-tertiary"
            aria-live="polite"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Last updated: just now
          </p>
        )}
      </main>

      <BottomTabBar />

      <Modal
        open={periodModalOpen}
        onClose={() => setPeriodModalOpen(false)}
        title="Select period"
        size="sm"
      >
        <Stack gap={2}>
          {PERIOD_OPTIONS.map((opt) => (
            <GhostButton
              key={opt.value}
              fullWidth
              onClick={() => handleSelectPeriod(opt.value)}
              aria-pressed={period === opt.value}
              className={
                period === opt.value
                  ? 'bg-bg-sunken text-brand-700'
                  : ''
              }
            >
              {opt.label}
            </GhostButton>
          ))}
        </Stack>
      </Modal>

      <Modal
        open={Boolean(activeClose)}
        onClose={() => setActiveClose(null)}
        title={activeClose ? `Close-day — ${formatDateMedium(activeClose.closeDate)}` : 'Close-day'}
        size="md"
      >
        {activeClose && (
          <Stack gap={4}>
            <VarianceBanner
              totalVariance={activeClose.totalVariance}
              hasVariance={activeClose.hasVariance}
            />
            <dl className="rounded-lg border border-border">
              <KeyValueRow label="Date" value={formatDateMedium(activeClose.closeDate)} />
              <KeyValueRow
                label="Status"
                value={activeClose.status === 'CLOSED_OK' ? 'Balanced' : 'Variance detected'}
              />
              <KeyValueRow label="Total variance" value={formatPKR(activeClose.totalVariance)} />
              <KeyValueRow
                label="Notes"
                value={
                  activeClose.status === 'CLOSED_OK'
                    ? 'No variance notes needed.'
                    : 'Cash shortage or payment-method pending transfer.'
                }
              />
            </dl>
          </Stack>
        )}
      </Modal>
    </div>
  )
}