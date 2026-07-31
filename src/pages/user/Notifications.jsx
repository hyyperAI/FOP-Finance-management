// Notifications — wired to live API.
// Per docs/pages/29-notifications.md.
//
// Icon map keys now match the BACKEND enum (per Phase E2).
//   - BUDGET_THRESHOLD_80
//   - BUDGET_EXCEEDED_100
//   - ANOMALY_AMOUNT
//   - MISSING_DAILY_CLOSE
//   - PERIOD_NOT_CLOSED
//
// (Legacy mock used 'budget', 'variance', 'missing-close', 'edit', 'system' —
// intentionally dropped; backend no longer sends those values.)

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarX,
  CheckCircle2,
  Info,
  PiggyBank,
  TrendingUp,
} from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import {
  listNotifications,
  markRead,
  markAllRead,
} from '../../lib/api/notifications.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { useNotifications as useNotificationsBadge } from '../../lib/hooks/useNotifications.js'
import { ApiError } from '../../lib/api.js'
import { relativeTime } from '../../lib/format.js'

const FILTER_OPTIONS = [
  { value: 'all',    label: 'All' },
  { value: 'unread', label: 'Unread only' },
]

// Map backend enum keys → { icon, label, color }.
// Phase E2 explicit instruction: do NOT keep the old mock keys.
const TYPE_META = {
  BUDGET_THRESHOLD_80: {
    icon: PiggyBank,
    label: 'Budget',
    tone: 'warning',
  },
  BUDGET_EXCEEDED_100: {
    icon: TrendingUp,
    label: 'Budget exceeded',
    tone: 'danger',
  },
  ANOMALY_AMOUNT: {
    icon: AlertTriangle,
    label: 'Anomaly',
    tone: 'danger',
  },
  MISSING_DAILY_CLOSE: {
    icon: CalendarX,
    label: 'Missing close',
    tone: 'warning',
  },
  PERIOD_NOT_CLOSED: {
    icon: CalendarX,
    label: 'Period not closed',
    tone: 'warning',
  },
}

const ONE_DAY = 86_400_000

function groupKey(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  const diff = now - t
  if (diff < ONE_DAY) return 'today'
  if (diff < 7 * ONE_DAY) return 'week'
  return 'earlier'
}

const GROUP_LABELS = { today: 'Today', week: 'This week', earlier: 'Earlier' }
const GROUP_ORDER = ['today', 'week', 'earlier']

export default function Notifications() {
  const [filter, setFilter] = useState('all')
  const [pageError, setPageError] = useState(null)

  // Refresh trigger to re-fetch after mark-as-read.
  const [refreshKey, setRefreshKey] = useState(0)
  const triggerRefresh = () => setRefreshKey((k) => k + 1)

  // Badge refresh (bell count) — call after markAllRead.
  const { refresh: refreshBadge } = useNotificationsBadge()

  const q = useQuery(
    () => listNotifications({
      isRead: filter === 'unread' ? false : undefined,
      limit: 50,
    }),
    [filter, refreshKey],
  )

  const alerts = q.data?.alerts ?? []
  const unreadCount = q.data?.unreadCount ?? 0
  const allRead = unreadCount === 0

  const grouped = useMemo(() => {
    const buckets = { today: [], week: [], earlier: [] }
    for (const n of alerts) buckets[groupKey(n.createdAt)].push(n)
    for (const k of GROUP_ORDER) {
      buckets[k].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    }
    return buckets
  }, [alerts])

  async function handleMarkAll() {
    setPageError(null)
    try {
      await markAllRead()
      refreshBadge()
      triggerRefresh()
    } catch (err) {
      setPageError(err)
    }
  }

  async function handleMarkOne(id, e) {
    e.preventDefault()
    e.stopPropagation()
    setPageError(null)
    try {
      await markRead(id, true)
      refreshBadge()
      triggerRefresh()
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // ownership mismatch — refresh list to drop stale item
        triggerRefresh()
      } else {
        setPageError(err)
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader
        title="Notifications"
        rightAction={
          <GhostButton
            onClick={handleMarkAll}
            disabled={allRead || q.loading}
            aria-label={allRead ? 'No unread notifications' : 'Mark all notifications as read'}
            className="px-3"
          >
            <span>Mark all as read</span>
          </GhostButton>
        }
      />

      <div
        className="sticky top-14 z-sticky border-b border-border bg-bg-surface px-4 py-3 sm:px-6"
        aria-label="Filters"
      >
        <SegmentedControl
          ariaLabel="Notification filter"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={setFilter}
        />
        <p className="mt-2 text-caption text-text-tertiary" aria-live="polite">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : 'No unread notifications'}
        </p>
      </div>

      <main className="flex-1" aria-label="Notifications">
        <Container variant="default" className="py-4">
          {pageError && (
            <ErrorState error={pageError} onRetry={() => { setPageError(null); q.run() }} />
          )}

          {q.error && !q.loading && !pageError && (
            <ErrorState error={q.error} onRetry={q.run} />
          )}

          {q.loading && !q.data ? (
            <Stack gap={3}>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </Stack>
          ) : alerts.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="All caught up"
              message="No notifications to show."
            />
          ) : (
            <Stack gap={6}>
              {GROUP_ORDER.map((key) => {
                const items = grouped[key]
                if (items.length === 0) return null
                return (
                  <section key={key} aria-label={GROUP_LABELS[key]}>
                    <h2 className="mb-2 px-1 text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                      {GROUP_LABELS[key]}
                    </h2>
                    <ul className="flex flex-col gap-3">
                      {items.map((n) => {
                        const meta = TYPE_META[n.type] ?? { icon: Info, label: n.type, tone: 'info' }
                        const Icon = meta.icon
                        const ariaLabel =
                          `${meta.label}: ${n.title}` +
                          (n.isRead ? '' : ', unread')
                        return (
                          <li key={n.id}>
                            <Link
                              to={n.link ?? '/'}
                              aria-label={ariaLabel}
                              className="block rounded-lg focus:outline-none focus:ring-2 focus:ring-border-focus"
                            >
                              <Card padding="md" className="flex items-start gap-3">
                                <span
                                  className={`mt-0.5 inline-flex h-9 w-9 flex-none items-center justify-center rounded-md bg-bg-sunken ${
                                    meta.tone === 'danger'
                                      ? 'text-danger-700'
                                      : meta.tone === 'warning'
                                        ? 'text-warning-700'
                                        : 'text-text-secondary'
                                  }`}
                                  aria-hidden="true"
                                >
                                  <Icon className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-body-m font-semibold text-text-primary">
                                    {n.title}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-caption text-text-tertiary">
                                    {n.message}
                                  </p>
                                  <p className="mt-1 text-caption text-text-tertiary">
                                    {relativeTime(n.createdAt)}
                                  </p>
                                </div>
                                {!n.isRead && (
                                  <button
                                    type="button"
                                    aria-label="Mark as read"
                                    onClick={(e) => handleMarkOne(n.id, e)}
                                    className="mt-1 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-border-focus"
                                  >
                                    <span
                                      className="h-2 w-2 rounded-full bg-brand-500"
                                      aria-hidden="true"
                                    />
                                  </button>
                                )}
                              </Card>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </Stack>
          )}
        </Container>
      </main>

      <BottomTabBar />
    </div>
  )
}