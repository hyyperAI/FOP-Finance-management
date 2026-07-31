// AdminUsers — wired to GET /api/admin/users.
// Per docs/pages/14-admin-users-list.md.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, UserX } from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { Pagination } from '../../components/ui/Pagination.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { RoleBadge } from '../../components/ui/RoleBadge.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Switch } from '../../components/ui/Switch.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { listUsers, updateUser } from '../../lib/api/admin-users.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { useAuth } from '../../lib/auth.jsx'
import { ApiError } from '../../lib/api.js'
import { formatDateTime } from '../../lib/format.js'

const ROLE_OPTIONS = [
  { value: 'all',   label: 'All' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'USER',  label: 'User' },
]

const STATUS_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'active',   label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

const PAGE_SIZE = 25

export default function AdminUsers() {
  const navigate = useNavigate()
  const { user: sessionUser } = useAuth()

  // Server-backed query
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const q = useQuery(
    () => listUsers({
      q: searchInput.trim() || undefined,
      role: roleFilter === 'all' ? undefined : roleFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      page,
      pageSize: PAGE_SIZE,
    }),
    [searchInput, roleFilter, statusFilter, page, refreshKey],
  )

  const users = q.data?.users ?? []
  const total = q.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  const [confirmDeactivate, setConfirmDeactivate] = useState(null)
  const [errorToast, setErrorToast] = useState(null)
  const [pendingToggleId, setPendingToggleId] = useState(null)

  // Activate immediately (optimistic); defer on deactivate (needs confirm).
  const handleToggle = async (u, next) => {
    if (u.isActive && !next) {
      setConfirmDeactivate({ user: u })
      return
    }
    if (!u.isActive && next) {
      setPendingToggleId(u.id)
      try {
        await updateUser(u.id, { isActive: true })
        setRefreshKey((k) => k + 1)
      } catch (err) {
        setErrorToast(err?.message || 'Couldn\u2019t activate user.')
      } finally {
        setPendingToggleId(null)
      }
    }
  }

  // Confirm dialog → call backend with the precise error-code mapping from G3.
  const handleConfirmDeactivate = async () => {
    const target = confirmDeactivate?.user
    if (!target) return
    setConfirmDeactivate(null)
    setPendingToggleId(target.id)
    try {
      await updateUser(target.id, { isActive: false })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'last_admin_guard') {
        setErrorToast('At least 2 admins must remain active.')
      } else if (err instanceof ApiError && err.code === 'cannot_demote_self') {
        setErrorToast('You cannot deactivate yourself.')
      } else {
        setErrorToast(err?.message || 'Couldn\u2019t deactivate user.')
      }
    } finally {
      setPendingToggleId(null)
    }
  }

  const activeAdminCount = users.filter((u) => u.role === 'ADMIN' && u.isActive).length
  const showMinAdminBanner = activeAdminCount === 1

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title="Users"
        rightAction={
          <PrimaryButton onClick={() => navigate('/admin/users/new')} aria-label="Create new user">
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span>New user</span>
          </PrimaryButton>
        }
      />

      <main aria-label="Users list" className="flex-1">
        <Container className="py-4 sm:py-6">
          <Stack gap={4}>
            {errorToast && (
              <InlineAlert
                variant="danger"
                title="Action blocked"
                onClose={() => setErrorToast(null)}
              >
                {errorToast}
              </InlineAlert>
            )}

            {showMinAdminBanner && (
              <InlineAlert variant="warning" title="Only 1 admin active">
                Only 1 admin active. Create another to maintain minimum.
              </InlineAlert>
            )}

            <div
              className="sticky top-[7.25rem] z-10 rounded-lg border border-border bg-bg-surface p-3 shadow-card sm:top-[7.5rem]"
              aria-label="Users filters"
            >
              <Stack gap={3}>
                <TextInput
                  type="search"
                  label="Search users"
                  placeholder="Search by name, email, or username"
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setPage(1) }}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SegmentedControl
                    ariaLabel="Filter by role"
                    options={ROLE_OPTIONS}
                    value={roleFilter}
                    onChange={(v) => { setRoleFilter(v); setPage(1) }}
                  />
                  <SegmentedControl
                    ariaLabel="Filter by status"
                    options={STATUS_OPTIONS}
                    value={statusFilter}
                    onChange={(v) => { setStatusFilter(v); setPage(1) }}
                  />
                </div>
              </Stack>
            </div>

            {q.error && !q.loading ? (
              <ErrorState error={q.error} onRetry={q.run} />
            ) : q.loading && !q.data ? (
              <Stack gap={3}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </Stack>
            ) : users.length === 0 ? (
              <Card padding="lg">
                <EmptyState
                  icon={UserX}
                  title="No users match"
                  message={
                    searchInput
                      ? `No users match "${searchInput}". Try a different search or clear filters.`
                      : 'No users match the selected filters.'
                  }
                />
              </Card>
            ) : (
              <Card padding="none" className="overflow-hidden">
                <ul className="flex flex-col gap-3 p-3 sm:hidden">
                  {users.map((u) => (
                    <li key={u.id}>
                      <Card padding="md" className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                          aria-label={`Open ${u.name}`}
                          className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-border-focus rounded-md"
                        >
                          <Avatar name={u.name} size="md" />
                          <div className="flex-1">
                            <p className="text-body-m font-semibold text-text-primary">{u.name}</p>
                            <p className="text-caption text-text-tertiary">@{u.username}</p>
                          </div>
                          <ChevronRight className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <RoleBadge role={u.role} />
                          <Badge variant={u.isActive ? 'intake' : 'expense'}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-caption">
                          <div>
                            <p className="text-text-tertiary">Email</p>
                            <p className="text-text-primary">{u.email}</p>
                          </div>
                          <div>
                            <p className="text-text-tertiary">Phone</p>
                            <p className="text-text-primary">{u.phone ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-text-tertiary">Categories</p>
                            <p className="text-text-primary">{u.categoryIds?.length ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-text-tertiary">Last login</p>
                            <p className="text-text-primary">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                          <span className="text-caption text-text-tertiary">Status</span>
                          <Switch
                            checked={u.isActive}
                            onChange={(next) => handleToggle(u, next)}
                            disabled={pendingToggleId === u.id}
                            aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.name}`}
                          />
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>

                <div className="hidden sm:block">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-bg-sunken text-caption uppercase tracking-wide text-text-tertiary">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-semibold">User</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Email</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Phone</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold">Categories</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                          <th scope="col" className="px-4 py-3 font-semibold">Last login</th>
                          <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {users.map((u) => (
                          <tr
                            key={u.id}
                            onClick={() => navigate(`/admin/users/${u.id}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                navigate(`/admin/users/${u.id}`)
                              }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-label={`Open ${u.name}`}
                            className="cursor-pointer hover:bg-bg-sunken focus:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-inset focus:ring-border-focus"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar name={u.name} size="sm" />
                                <div>
                                  <p className="text-body-m font-medium text-text-primary">{u.name}</p>
                                  <p className="text-caption text-text-tertiary">@{u.username}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-body-m text-text-secondary">{u.email}</td>
                            <td className="px-4 py-3 text-body-m text-text-secondary">{u.phone ?? '—'}</td>
                            <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                            <td className="px-4 py-3 text-right text-body-m text-text-secondary tabular-nums">
                              {u.categoryIds?.length ?? 0}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={u.isActive ? 'intake' : 'expense'}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-caption text-text-secondary whitespace-nowrap">
                              {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-3">
                                <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                  <Switch
                                    checked={u.isActive}
                                    onChange={(next) => handleToggle(u, next)}
                                    disabled={pendingToggleId === u.id}
                                    aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.name}`}
                                  />
                                </span>
                                <ChevronRight className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between gap-4">
              <p className="text-caption text-text-tertiary" aria-live="polite">
                Showing {users.length} of {total} users
              </p>
              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            </div>
          </Stack>
        </Container>
      </main>

      <ConfirmDialog
        open={Boolean(confirmDeactivate)}
        onClose={() => setConfirmDeactivate(null)}
        onConfirm={handleConfirmDeactivate}
        title="Deactivate user?"
        message={
          confirmDeactivate?.user
            ? `Deactivate ${confirmDeactivate.user.name}? They will not be able to sign in.`
            : ''
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        variant="danger"
        warning={
          confirmDeactivate?.user?.role === 'ADMIN' ? (
            <InlineAlert variant="warning" title="Admin deactivation">
              Deactivating an admin will reduce the active admin count.
            </InlineAlert>
          ) : null
        }
      />
    </div>
  )
}