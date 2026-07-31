// AdminUserDetail — wired to GET/PATCH /api/admin/users/:id + reset-password.
// Per docs/pages/16-admin-user-detail.md.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CalendarRange, ChevronDown, KeyRound, ListChecks,
  Mail, Power, Save, UserRoundSearch,
} from 'lucide-react'
import clsx from 'clsx'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { MultiSelect } from '../../components/ui/MultiSelect.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { RadioGroup } from '../../components/ui/RadioGroup.jsx'
import { RoleBadge } from '../../components/ui/RoleBadge.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Switch } from '../../components/ui/Switch.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import {
  getUser, updateUser, resetUserPassword,
} from '../../lib/api/admin-users.js'
import { listCategories } from '../../lib/api/admin-categories.js'
import { listAudit } from '../../lib/api/admin-audit.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { useAuth } from '../../lib/auth.jsx'
import { ApiError } from '../../lib/api.js'
import {
  formatDateTime, formatDateMedium, relativeTime,
} from '../../lib/format.js'

const ROLE_OPTIONS = [
  { value: 'USER',  label: 'User',  description: 'Standard access — can post intake/expense and close their day' },
  { value: 'ADMIN', label: 'Admin', description: 'Full access including user management and reports' },
]

const TOAST_TIMEOUT_MS = 2000
const AUDIT_LIMIT = 10

function actionVariant(action) {
  if (!action) return 'default'
  if (/\.(disable|deactivate|delete|remove)$/.test(action)) return 'expense'
  if (/\.create$/.test(action)) return 'intake'
  return 'default'
}

export default function AdminUserDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user: sessionUser } = useAuth()

  // Refetch on id change
  const [refreshKey, setRefreshKey] = useState(0)
  const q = useQuery(() => getUser(id), [id, refreshKey])

  // Live categories for the picker
  const catQ = useQuery(() => listCategories({}), [])
  const categoryOptions = useMemo(
    () => (catQ.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    [catQ.data],
  )

  // Live audit rows touching this user
  const auditQ = useQuery(
    () => Promise.all([
      listAudit({ actorId: id, pageSize: AUDIT_LIMIT }),
      listAudit({ entityId: id, pageSize: AUDIT_LIMIT }),
    ]).then(([actor, entity]) => {
      const map = new Map()
      // Defensively handle missing or error responses
      if (actor?.entries) {
        for (const row of actor.entries) map.set(row.id, row)
      }
      if (entity?.entries) {
        for (const row of entity.entries) map.set(row.id, row)
      }
      return [...map.values()]
        .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
        .slice(0, AUDIT_LIMIT)
    }),
    [id, refreshKey],
  )

  // Working form state — initialise from query data
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [savedToast, setSavedToast] = useState(null)
  const [blockedToast, setBlockedToast] = useState(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetToast, setResetToast] = useState(null)
  const [auditOpen, setAuditOpen] = useState(true)

  // Hydrate form when user data first arrives or user changes
  useEffect(() => {
    if (q.data) {
      setForm({
        name: q.data.name ?? '',
        email: q.data.email ?? '',
        username: q.data.username ?? '',
        phone: q.data.phone ?? '',
        role: q.data.role,
        isActive: q.data.isActive,
        // categories is flat array [{ id, name, type }] from API
        categoryIds: q.data.categoryIds ?? q.data.categories?.map((c) => c.id) ?? [],
      })
    }
  }, [q.data])

  // Auto-dismiss toasts
  useEffect(() => {
    if (!savedToast) return undefined
    const t = setTimeout(() => setSavedToast(null), TOAST_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [savedToast])

  // Derived: dirty state
  const isDirty = useMemo(() => {
    if (!q.data || !form) return false
    return (
      q.data.name !== form.name ||
      q.data.email !== form.email ||
      q.data.username !== form.username ||
      (q.data.phone ?? '') !== form.phone ||
      q.data.role !== form.role ||
      q.data.isActive !== form.isActive ||
      JSON.stringify(q.data.categoryIds ?? []) !== JSON.stringify(form.categoryIds)
    )
  }, [q.data, form])

  // Min-2-admin guard for the live current data.
  // (Strictly server-side, but we surface a banner for clarity.)
  const wouldViolateAdminMin = useMemo(() => {
    if (!q.data || q.data.role !== 'ADMIN' || !q.data.isActive) return false
    // We can't compute org-wide admin count from a single user endpoint, so we
    // rely on the server response code 'last_admin_guard' for the canonical check.
    return false
  }, [q.data])

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async (e) => {
    e?.preventDefault?.()
    if (!isDirty || saving) return
    setSaving(true)
    setSavedToast(null)
    try {
      await updateUser(id, {
        name: form.name,
        email: form.email,
        username: form.username,
        phone: form.phone || undefined,
        role: form.role,
        categoryIds: form.categoryIds,
        isActive: form.isActive,
      })
      setRefreshKey((k) => k + 1)
      setSavedToast({ kind: 'success', message: 'Changes saved' })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'duplicate_email') {
          setSavedToast({ kind: 'error', message: 'Email already in use.' })
        } else if (err.code === 'duplicate_username') {
          setSavedToast({ kind: 'error', message: 'Username already taken.' })
        } else if (err.code === 'cannot_demote_self') {
          setSavedToast({ kind: 'error', message: 'You cannot demote yourself.' })
        } else if (err.code === 'last_admin_guard') {
          setSavedToast({ kind: 'error', message: 'At least 2 admins must remain active.' })
        } else if (err.fields) {
          const firstField = Object.keys(err.fields)[0]
          setSavedToast({ kind: 'error', message: err.fields[firstField][0] })
        } else {
          setSavedToast({ kind: 'error', message: err.message || 'Couldn\u2019t save.' })
        }
      } else {
        setSavedToast({ kind: 'error', message: err?.message || 'Couldn\u2019t save.' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!q.data) return
    setForm({
      name: q.data.name ?? '',
      email: q.data.email ?? '',
      username: q.data.username ?? '',
      phone: q.data.phone ?? '',
      role: q.data.role,
      isActive: q.data.isActive,
      // categories is flat array [{ id, name, type }] from API
      categoryIds: q.data.categoryIds ?? q.data.categories?.map((c) => c.id) ?? [],
    })
  }

  const handleConfirmResetPassword = async () => {
    setConfirmReset(false)
    try {
      await resetUserPassword(id)
      setResetToast({ kind: 'success', email: q.data?.email })
    } catch (err) {
      setResetToast({ kind: 'error', email: q.data?.email, message: err?.message })
    }
  }

  const handleConfirmDeactivate = async () => {
    setConfirmDeactivate(false)
    if (!q.data) return
    const nextActive = !q.data.isActive
    try {
      await updateUser(id, { isActive: nextActive })
      setRefreshKey((k) => k + 1)
      setSavedToast({
        kind: 'success',
        message: nextActive ? 'User reactivated' : 'User deactivated',
      })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'last_admin_guard') {
        setBlockedToast('At least 2 admins must remain active.')
      } else if (err instanceof ApiError && err.code === 'cannot_demote_self') {
        setBlockedToast('You cannot deactivate yourself.')
      } else {
        setBlockedToast(err?.message || 'Couldn\u2019t update user.')
      }
    }
  }

  if (q.loading && !q.data) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="Loading…" back="/admin/users" />
        <main className="flex-1">
          <Container className="py-4 sm:py-6">
            <Stack gap={4}>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-48 w-full" />
            </Stack>
          </Container>
        </main>
      </div>
    )
  }

  if (q.error && !q.data) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="User" back="/admin/users" />
        <main className="flex-1">
          <Container className="py-4 sm:py-6">
            <ErrorState error={q.error} onRetry={q.run} />
          </Container>
        </main>
      </div>
    )
  }

  const user = q.data

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="User not found" back="/admin/users" />
        <main className="flex-1">
          <Container className="py-4 sm:py-6">
            <Card padding="none">
              <EmptyState
                icon={UserRoundSearch}
                title="User not found"
                message={`No user exists with id "${id}". They may have been removed.`}
              />
            </Card>
          </Container>
        </main>
      </div>
    )
  }

  const deactivateLabel = user.isActive ? 'Deactivate' : 'Reactivate'
  const deactivateVariant = user.isActive ? 'expense' : 'primary'

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title={user.name}
        back="/admin/users"
        currentAdmin={sessionUser ? { id: sessionUser.id, name: sessionUser.name || sessionUser.username } : null}
        rightAction={
          <Badge variant={user.isActive ? 'intake' : 'expense'}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      <main aria-label={`Edit ${user.name}`} className="flex-1">
        <Container className="py-4 sm:py-6">
          <Stack gap={4}>
            {savedToast && (
              <InlineAlert variant={savedToast.kind === 'error' ? 'danger' : 'success'}
                title={savedToast.kind === 'error' ? 'Couldn\u2019t save' : 'Success'}>
                {savedToast.message}
              </InlineAlert>
            )}
            {blockedToast && (
              <InlineAlert variant="danger" title="Action blocked" role="alert">
                {blockedToast}
              </InlineAlert>
            )}

            <Card padding="md" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <Avatar name={user.name} size="lg" />
              <div className="flex-1">
                <h2 className="text-h3 font-semibold text-text-primary">{user.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RoleBadge role={user.role} />
                  <Badge variant={user.isActive ? 'intake' : 'expense'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="mt-2 text-caption text-text-tertiary">
                  Last login: {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                  {user.lastLoginAt ? ` · ${relativeTime(user.lastLoginAt)}` : ''}
                </p>
              </div>
            </Card>

            <Card padding="md">
              <form onSubmit={handleSave} noValidate>
                <Stack gap={4}>
                  <div>
                    <h3 className="text-h4 font-semibold text-text-primary">Profile</h3>
                    <p className="text-caption text-text-tertiary">
                      Update the user&rsquo;s profile information and access.
                    </p>
                  </div>

                  {form && (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <TextInput
                          label="Name"
                          required
                          value={form.name}
                          onChange={(e) => updateField('name', e.target.value)}
                          autoComplete="name"
                        />
                        <TextInput
                          label="Username"
                          required
                          value={form.username}
                          onChange={(e) => updateField('username', e.target.value)}
                          autoComplete="username"
                          helperText="3–30 chars, letters/numbers/underscore"
                        />
                        <TextInput
                          label="Email"
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) => updateField('email', e.target.value)}
                          autoComplete="email"
                        />
                        <TextInput
                          label="Phone"
                          type="tel"
                          value={form.phone}
                          onChange={(e) => updateField('phone', e.target.value)}
                          autoComplete="tel"
                        />
                      </div>

                      <RadioGroup
                        name="role"
                        label="Role"
                        value={form.role}
                        onChange={(value) => updateField('role', value)}
                        options={ROLE_OPTIONS}
                      />

                      <MultiSelect
                        label="Categories"
                        options={categoryOptions}
                        value={form.categoryIds}
                        onChange={(next) => updateField('categoryIds', next)}
                        helperText={
                          form.role === 'USER'
                            ? 'User role requires at least 1 category'
                            : 'Optional for admins'
                        }
                        disabled={categoryOptions.length === 0}
                      />

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-sunken px-4 py-3">
                        <div>
                          <p className="text-body-m font-semibold text-text-primary">Active</p>
                          <p className="text-caption text-text-tertiary">
                            Inactive users cannot sign in.
                          </p>
                        </div>
                        <Switch
                          checked={form.isActive}
                          onChange={(next) => updateField('isActive', next)}
                          aria-label={`Toggle active state for ${user.name}`}
                        />
                      </div>
                    </>
                  )}

                  {isDirty && (
                    <p className="text-caption text-text-tertiary" aria-live="polite">
                      You have unsaved changes.
                    </p>
                  )}

                  <div
                    className={clsx(
                      'flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3',
                      'sm:sticky sm:bottom-4 sm:rounded-lg sm:border sm:border-border-subtle sm:bg-bg-surface sm:p-3 sm:shadow-card',
                    )}
                  >
                    <PrimaryButton
                      type="submit"
                      fullWidth
                      disabled={!isDirty || saving}
                      aria-label="Save changes"
                    >
                      <Save className="h-5 w-5" aria-hidden="true" />
                      <span>{saving ? 'Saving…' : 'Save changes'}</span>
                    </PrimaryButton>
                    <GhostButton
                      type="button"
                      fullWidth
                      onClick={() => setConfirmReset(true)}
                      aria-label="Reset password"
                    >
                      <KeyRound className="h-5 w-5" aria-hidden="true" />
                      <span>Reset password</span>
                    </GhostButton>
                    <GhostButton
                      type="button"
                      fullWidth
                      onClick={() => navigate(`/admin/users/${user.id}/close-day`)}
                      aria-label="Close day on behalf"
                    >
                      <CalendarRange className="h-5 w-5" aria-hidden="true" />
                      <span>Close day on behalf</span>
                    </GhostButton>
                    <GhostButton
                      type="button"
                      fullWidth
                      onClick={() => navigate(`/admin/search?q=${encodeURIComponent(user.username)}`)}
                      aria-label="View transactions for this user"
                    >
                      <ListChecks className="h-5 w-5" aria-hidden="true" />
                      <span>View transactions</span>
                    </GhostButton>
                    <GhostButton
                      type="button"
                      onClick={handleDiscard}
                      disabled={!isDirty}
                      aria-label="Discard changes"
                    >
                      Discard
                    </GhostButton>
                    <PrimaryButton
                      type="button"
                      variant={deactivateVariant}
                      fullWidth
                      onClick={() => setConfirmDeactivate(true)}
                      aria-label={`${deactivateLabel} ${user.name}`}
                    >
                      <Power className="h-5 w-5" aria-hidden="true" />
                      <span>{deactivateLabel}</span>
                    </PrimaryButton>
                  </div>
                </Stack>
              </form>
            </Card>

            <Card padding="none">
              <button
                type="button"
                onClick={() => setAuditOpen((v) => !v)}
                aria-expanded={auditOpen}
                aria-controls="user-audit-panel"
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-border-focus"
              >
                <div>
                  <h3 className="text-h4 font-semibold text-text-primary">
                    Recent activity for this user
                  </h3>
                  <p className="text-caption text-text-tertiary">
                    Last {AUDIT_LIMIT} actions involving this user
                  </p>
                </div>
                <ChevronDown
                  className={clsx(
                    'h-5 w-5 shrink-0 text-text-tertiary transition-transform duration-150',
                    auditOpen && 'rotate-180',
                  )}
                  aria-hidden="true"
                />
              </button>

              {auditOpen && (
                <div id="user-audit-panel" className="border-t border-border-subtle">
                  {auditQ.loading && !auditQ.data ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (auditQ.data ?? []).length === 0 ? (
                    <EmptyState
                      icon={ListChecks}
                      title="No activity yet"
                      message="No recent audit entries for this user."
                    />
                  ) : (
                    <ul className="divide-y divide-border-subtle" aria-label="User activity log">
                      {(auditQ.data ?? []).map((row) => (
                        <li key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                          <span className="w-32 shrink-0 text-caption text-text-tertiary tabular-nums">
                            {formatDateMedium(row.occurredAt)}
                          </span>
                          <Badge variant={actionVariant(row.action)}>{row.action}</Badge>
                          <span className="flex-1 text-body-m text-text-secondary">
                            <span className="font-medium text-text-primary">
                              {row.actor?.name ?? row.actor?.username ?? '—'}
                            </span>
                            {' · '}
                            {row.entityType}
                            {row.entityId ? ` (${row.entityId})` : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </Stack>
        </Container>
      </main>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleConfirmResetPassword}
        title="Reset password?"
        message={
          user.email
            ? `Send password reset email to ${user.email}? They will receive a link to choose a new password.`
            : 'Send password reset email?'
        }
        confirmLabel="Send email"
        cancelLabel="Cancel"
      />

      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={handleConfirmDeactivate}
        title={user.isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`}
        message={
          user.isActive
            ? `${user.name} will not be able to sign in until reactivated.`
            : `${user.name} will be able to sign in again.`
        }
        confirmLabel={deactivateLabel}
        cancelLabel="Cancel"
        variant="danger"
        warning={
          user.role === 'ADMIN' && user.isActive ? (
            <InlineAlert variant="warning" title="Admin deactivation">
              Deactivating an admin will reduce the active admin count.
            </InlineAlert>
          ) : null
        }
      />

      <Modal
        open={Boolean(resetToast)}
        onClose={() => setResetToast(null)}
        title={resetToast?.kind === 'error' ? 'Reset failed' : 'Reset email sent'}
        size="sm"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Mail className="h-10 w-10 text-success-500" aria-hidden="true" />
          <p className="text-body-m text-text-primary">
            {resetToast?.kind === 'error'
              ? `Couldn\u2019t send reset email: ${resetToast.message}`
              : <>Reset email sent to <span className="font-semibold">{resetToast?.email}</span></>
            }
          </p>
          <PrimaryButton type="button" onClick={() => setResetToast(null)} fullWidth>
            Done
          </PrimaryButton>
        </div>
      </Modal>
    </div>
  )
}