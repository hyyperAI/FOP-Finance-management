// Admin Audit Log — /admin/audit
// Wired to GET /api/admin/audit + /api/admin/audit/:id + POST /api/admin/audit/export.
// Per docs/pages/24-admin-audit.md.

import { useEffect, useMemo, useState } from 'react'
import { Download, ScrollText, AlertTriangle } from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Pagination } from '../../components/ui/Pagination.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { listAudit, getAuditEntry, exportAudit } from '../../lib/api/admin-audit.js'
import { listUsers } from '../../lib/api/admin-users.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatDateMedium, formatDateTime } from '../../lib/format.js'

const PAGE_SIZE = 25

const COMMON_ACTIONS = [
  'transaction.create', 'transaction.update', 'transaction.delete',
  'user.create', 'user.update', 'user.disable', 'user.enable', 'user.reset_password',
  'category.create', 'category.update', 'category.disable', 'category.enable',
  'budget.create', 'budget.update', 'budget.delete',
  'subcategory.create', 'subcategory.update', 'subcategory.delete',
  'dayclose.create', 'dayclose.create_by_admin',
  'auth.login_success', 'auth.login_failure', 'auth.user_inactive',
  'storage.prune', 'cron.run',
]

const ENTITY_TYPES = [
  'Transaction', 'User', 'Category', 'SubCategory', 'Budget',
  'DayClose', 'AuditLog', 'StorageUsage', 'JobRun',
]

function actionVariant(action) {
  if (!action) return 'neutral'
  if (action.startsWith('auth.')) return 'neutral'
  if (/\.(disable|deactivate|delete|remove|revoke)$/.test(action)) return 'expense'
  if (/\.create$/.test(action)) return 'intake'
  if (/\.(update|edit|reset|restore|enable|reactivate|prune|run|export)$/.test(action)) return 'info'
  return 'neutral'
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

export default function AdminAudit() {
  const [actorFilter, setActorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityIdFilter, setEntityIdFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedEntry, setSelectedEntry] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [exportedAlert, setExportedAlert] = useState(null)
  const [exportError, setExportError] = useState(null)

  const actorQ = useQuery(() => listUsers({ page: 1, pageSize: 200 }), [])
  const actorOptions = (actorQ.data?.users ?? []).map((u) => ({ value: u.id, label: u.name }))

  // Build params
  const params = useMemo(() => {
    const p = { page, pageSize: PAGE_SIZE }
    if (actorFilter)        p.actorId = actorFilter
    if (entityTypeFilter)   p.entityTypes = [entityTypeFilter]
    if (actionFilter)       p.actions = [actionFilter]
    if (entityIdFilter)     p.entityId = entityIdFilter
    if (dateFrom)            p.from = dateFrom
    if (dateTo)              p.to = dateTo
    return p
  }, [actorFilter, entityTypeFilter, actionFilter, entityIdFilter, dateFrom, dateTo, page])

  const q = useQuery(() => listAudit(params), [
    actorFilter, entityTypeFilter, actionFilter, entityIdFilter, dateFrom, dateTo, page,
  ])

  const entries = q.data?.entries ?? []
  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleReset = () => {
    setActorFilter('')
    setEntityTypeFilter('')
    setActionFilter('')
    setEntityIdFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const blob = await exportAudit({
        format: 'csv',
        actorId: actorFilter || undefined,
        entityTypes: entityTypeFilter ? [entityTypeFilter] : undefined,
        actions: actionFilter ? [actionFilter] : undefined,
        entityId: entityIdFilter || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      })
      triggerBlobDownload(blob, 'audit-export.csv')
      setExportedAlert({ count: total })
    } catch (err) {
      setExportError(err?.message || 'Couldn\u2019t export audit log.')
    } finally {
      setExporting(false)
    }
  }

  // Auto-dismiss toast
  useEffect(() => {
    if (!exportedAlert) return undefined
    const t = setTimeout(() => setExportedAlert(null), 2000)
    return () => clearTimeout(t)
  }, [exportedAlert])

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <AdminTopBar
        title="Audit log"
        rightAction={
          <GhostButton onClick={handleExport} disabled={exporting || total === 0}>
            {exporting ? 'Exporting…' : (<><Download className="h-4 w-4" aria-hidden="true" /> Export CSV</>)}
          </GhostButton>
        }
      />

      <main className="flex-1" aria-label="Audit log">
        <Container variant="default" className="py-4">
          <Stack gap={4}>
            {exportedAlert && (
              <InlineAlert variant="success" title="CSV downloaded">
                {exportedAlert.count} entries exported.
              </InlineAlert>
            )}
            {exportError && (
              <InlineAlert variant="danger" title="Export failed" icon={AlertTriangle}>
                {exportError}
              </InlineAlert>
            )}

            <Card padding="md">
              <Stack gap={3}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SelectDropdown
                    label="Actor"
                    aria-label="Filter by actor"
                    options={actorOptions}
                    value={actorFilter}
                    onChange={(e) => { setActorFilter(e.target.value); setPage(1) }}
                    placeholder="All actors"
                    disabled={actorOptions.length === 0}
                  />
                  <SelectDropdown
                    label="Entity type"
                    aria-label="Filter by entity type"
                    options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
                    value={entityTypeFilter}
                    onChange={(e) => { setEntityTypeFilter(e.target.value); setPage(1) }}
                    placeholder="All entity types"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <SelectDropdown
                    label="Action"
                    aria-label="Filter by action"
                    options={COMMON_ACTIONS.map((a) => ({ value: a, label: a }))}
                    value={actionFilter}
                    onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
                    placeholder="All actions"
                  />
                  <DatePicker
                    label="From"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                  />
                  <DatePicker
                    label="To"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                  />
                </div>
                <TextInput
                  label="Entity ID"
                  placeholder="Filter by entity cuid (exact match)"
                  value={entityIdFilter}
                  onChange={(e) => { setEntityIdFilter(e.target.value); setPage(1) }}
                  helperText="Optional — paste a record ID to see all actions on it."
                />
                <div className="flex items-center justify-end gap-2">
                  <GhostButton onClick={handleReset} aria-label="Reset filters">
                    Reset filters
                  </GhostButton>
                </div>
              </Stack>
            </Card>

            {q.error && !q.loading && (
              <ErrorState error={q.error} onRetry={q.run} />
            )}

            {q.loading && !q.data ? (
              <Stack gap={3}>
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </Stack>
            ) : entries.length === 0 ? (
              <Card padding="lg">
                <EmptyState
                  icon={ScrollText}
                  title="No audit entries match"
                  message="Try clearing the filters or choosing a different period."
                />
              </Card>
            ) : (
              <>
                <p className="text-caption text-text-tertiary" aria-live="polite">
                  Showing {entries.length} of {total} entries
                </p>

                <Card padding="none" className="overflow-hidden">
                  <ul className="divide-y divide-border-subtle">
                    {entries.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedEntry(entry)}
                          aria-label={`View audit entry ${entry.action} on ${entry.entityType}`}
                          className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-inset focus:ring-border-focus sm:flex-row sm:items-center sm:gap-3"
                        >
                          <span className="w-36 shrink-0 font-mono text-caption tabular-nums text-text-secondary">
                            {formatDateMedium(entry.occurredAt)}
                          </span>
                          <Badge variant={actionVariant(entry.action)}>
                            {entry.action}
                          </Badge>
                          <span className="flex-1 truncate text-body-m text-text-primary">
                            <span className="font-semibold">
                              {entry.actor?.name ?? entry.actor?.username ?? '—'}
                            </span>
                            {' '}
                            {entry.entityType}
                            {entry.entityId ? ` · ${entry.entityId}` : ''}
                          </span>
                          <span className="hidden font-mono text-caption text-text-tertiary sm:inline">
                            {entry.ip ?? ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </>
            )}
          </Stack>
        </Container>
      </main>

      <Modal
        open={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry ? `Audit · ${selectedEntry.action}` : 'Audit entry'}
        size="lg"
      >
        {selectedEntry && (
          <AuditDetailContent id={selectedEntry.id} fallback={selectedEntry} />
        )}
      </Modal>
    </div>
  )
}

function AuditDetailContent({ id, fallback }) {
  const q = useQuery(() => getAuditEntry(id), [id])

  if (q.loading && !q.data) {
    return <Skeleton className="h-40 w-full" />
  }

  const entry = q.data ?? fallback
  const before = entry?.before ?? null
  const after = entry?.after ?? null

  return (
    <Stack gap={4}>
      <Card padding="md">
        <h2 className="text-h4 font-semibold text-text-primary">Metadata</h2>
        <dl className="mt-3 divide-y divide-border-subtle">
          <Row label="When" value={formatDateTime(entry.occurredAt)} />
          <Row label="Actor" value={
            <span className="flex items-center gap-2">
              <Avatar name={entry.actor?.name ?? entry.actor?.username ?? '—'} size="sm" />
              <span>
                {entry.actor?.name ?? entry.actor?.username ?? '—'}
                {entry.actor?.username && ` (@${entry.actor.username})`}
              </span>
            </span>
          } />
          <Row label="Action" value={<Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>} />
          <Row label="Entity type" value={entry.entityType ?? '—'} />
          <Row label="Entity ID" value={
            entry.entityId ? <code className="font-mono text-caption">{entry.entityId}</code> : '—'
          } />
          {entry.reason && <Row label="Reason" value={entry.reason} />}
          <Row label="IP" value={entry.ip ?? '—'} />
          {entry.userAgent && <Row label="User-agent" value={<span className="break-all text-caption">{entry.userAgent}</span>} />}
        </dl>
      </Card>

      {(before || after) && (
        <Card padding="md">
          <h2 className="text-h4 font-semibold text-text-primary">Before / After</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-caption uppercase tracking-wide text-text-tertiary">Before</p>
              <pre className="overflow-x-auto rounded-md border border-border-subtle bg-bg-sunken p-3 text-caption font-mono text-text-primary">
                {before ? JSON.stringify(before, null, 2) : '—'}
              </pre>
            </div>
            <div>
              <p className="mb-1 text-caption uppercase tracking-wide text-text-tertiary">After</p>
              <pre className="overflow-x-auto rounded-md border border-border-subtle bg-bg-sunken p-3 text-caption font-mono text-text-primary">
                {after ? JSON.stringify(after, null, 2) : '—'}
              </pre>
            </div>
          </div>
        </Card>
      )}

      {!before && !after && (
        <Card padding="md">
          <p className="text-body-m text-text-tertiary">
            No before/after payload captured for this action.
          </p>
        </Card>
      )}
    </Stack>
  )
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3 py-2 first:pt-0 last:pb-0">
      <span className="text-caption uppercase tracking-wide text-text-tertiary">{label}</span>
      <span className="text-body-m text-text-primary">{value}</span>
    </div>
  )
}