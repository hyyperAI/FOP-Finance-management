// Admin dashboard — wired to GET /api/admin/dashboard.
// Per docs/pages/13-admin-dashboard.md.

import { useState } from 'react'
import { Calendar, ChevronRight, Wallet, Inbox } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'

import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { adminDashboard } from '../../lib/api/dashboard.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { formatPKR } from '../../lib/format.js'

const PERIOD_OPTIONS = [
  { value: 'day',     label: 'Today' },
  { value: 'week',    label: 'This week' },
  { value: 'month',   label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year',    label: 'This year' },
  { value: 'custom',  label: 'Custom' },
]

const CHART_COLORS = [
  'var(--success-500)',
  'var(--danger-500)',
  'var(--warning-500)',
  'var(--info-500)',
  'var(--brand-500)',
]

const tooltipFormatter = (value) => formatPKR(value)

export default function AdminDashboard() {
  const [period, setPeriod] = useState('month')
  const [periodModalOpen, setPeriodModalOpen] = useState(false)

  const q = useQuery(() => adminDashboard({ period }), [period])

  const data = q.data
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'This month'

  const handleSelectPeriod = (value) => {
    setPeriod(value)
    setPeriodModalOpen(false)
  }

  const noData =
    !q.loading && (!data ||
      (data.summary.intake === 0 &&
        data.summary.expense === 0 &&
        data.topCategories.length === 0))

  // Build chart data from real response (topCategories + topIntakeCategories).
  const expenseData = data?.topCategories ?? []
  const intakeData = data?.topIntakeCategories ?? []
  const expenseDonutData = expenseData.map((c) => ({ name: c.categoryName, value: c.total }))
  const expenseBarData = expenseData.slice(0, 5).map((c) => ({ name: c.categoryName, total: c.total }))
  const intakeDonutData = intakeData.map((c) => ({ name: c.categoryName, value: c.total }))
  const intakeBarData = intakeData.slice(0, 5).map((c) => ({ name: c.categoryName, total: c.total }))

  // MoM delta sign for the StatCard. Real shape: {intake, expense, net}
  // — all are signed numbers (positive = growth).
  const mom = data?.momChange?.net ?? 0
  const momDirection = mom >= 0 ? 'up' : 'down'
  const momLabel = `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}% vs last month`

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title="Admin Dashboard"
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

      <main className="flex-1 pb-8" aria-label="Admin dashboard">
        <Container variant="default" className="py-4">
          {q.error && !q.loading ? (
            <ErrorState error={q.error} onRetry={q.run} />
          ) : q.loading && !data ? (
            <>
              <div
                role="status"
                aria-label="Loading key performance indicators"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            </>
          ) : noData ? (
            <Card padding="md">
              <EmptyState
                icon={Inbox}
                title="No data for this period"
                message="Once transactions are posted, org-wide aggregations will appear here."
              />
            </Card>
          ) : (
            <>
              <Stack gap={4} as="section" role="group" aria-label="Key performance indicators">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <StatCard
                    label="Total income"
                    value={formatPKR(data.summary.intake)}
                    variant="intake"
                  />
                  <StatCard
                    label="Total expense"
                    value={formatPKR(data.summary.expense)}
                    variant="expense"
                  />
                  <StatCard
                    label="Net balance"
                    value={formatPKR(data.summary.net)}
                    variant={data.summary.net >= 0 ? 'intake' : 'expense'}
                    trend={{
                      direction: data.summary.net >= 0 ? 'up' : 'down',
                      label: 'Net of period intake and expense',
                    }}
                  />
                  <StatCard
                    label="MoM change (net)"
                    value={momLabel}
                    variant="neutral"
                    trend={{
                      direction: momDirection,
                      label: 'vs last month',
                    }}
                  />
                  <StatCard
                    label="Now in account"
                    value={formatPKR(data.runningBalance)}
                    variant="info"
                    icon={Wallet}
                  />
                  <StatCard
                    label="Period"
                    value={periodLabel}
                    variant="neutral"
                  />
                </div>
              </Stack>

              <section
                className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
                aria-label="Expense charts"
              >
                <Card padding="md">
                  <h2 className="mb-3 text-body-l font-semibold text-text-primary">
                    Expense by category
                  </h2>
                  <div
                    role="img"
                    aria-label="Org-wide expense chart"
                    className="h-64 w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseDonutData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {expenseDonutData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card padding="md">
                  <h2 className="mb-3 text-body-l font-semibold text-text-primary">
                    Top 5 expense by category
                  </h2>
                  <div
                    role="img"
                    aria-label="Top 5 expense categories chart"
                    className="h-64 w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={expenseBarData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatPKR(v)} />
                        <YAxis type="category" dataKey="name" width={90} />
                        <Tooltip formatter={tooltipFormatter} />
                        <Bar dataKey="total" fill="var(--danger-600)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>

              <section
                className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2"
                aria-label="Income charts"
              >
                <Card padding="md">
                  <h2 className="mb-3 text-body-l font-semibold text-text-primary">
                    Income by category
                  </h2>
                  <div
                    role="img"
                    aria-label="Org-wide income chart"
                    className="h-64 w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={intakeDonutData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {intakeDonutData.map((_, idx) => (
                            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={tooltipFormatter} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card padding="md">
                  <h2 className="mb-3 text-body-l font-semibold text-text-primary">
                    Top 5 income by category
                  </h2>
                  <div
                    role="img"
                    aria-label="Top 5 income categories chart"
                    className="h-64 w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={intakeBarData}
                        layout="vertical"
                        margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v) => formatPKR(v)} />
                        <YAxis type="category" dataKey="name" width={90} />
                        <Tooltip formatter={tooltipFormatter} />
                        <Bar dataKey="total" fill="var(--success-600)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </section>
            </>
          )}
        </Container>
      </main>

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
              className={period === opt.value ? 'bg-bg-sunken text-brand-700' : ''}
            >
              {opt.label}
            </GhostButton>
          ))}
        </Stack>
      </Modal>
    </div>
  )
}