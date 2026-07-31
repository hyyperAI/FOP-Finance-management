// AdminCategories — wired to /api/admin/categories (full CRUD).
// Per docs/pages/18-admin-categories.md.
//
// The "Sub-cats across users" expanded view remains a read-only mock — the
// admin backend does not expose cross-user sub-cat aggregation (and spec
// gotcha #2 says admin cannot edit user sub-cats).

import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import {
  Plus, Pencil, Power, ChevronDown, ChevronRight,
  ShoppingBag, Utensils, Plane, Home, Car, Heart, Briefcase,
  Coffee, Gift, BookOpen, Music, Phone, Wifi, Zap, Droplet,
  Wrench, Stethoscope, GraduationCap, Dumbbell, Baby,
} from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Switch } from '../../components/ui/Switch.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { ColorPicker } from '../../components/ui/ColorPicker.jsx'
import { IconPicker } from '../../components/ui/IconPicker.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

// Phase J — replaced mock-data SUB_CATEGORIES with a static UI fixture
// (only used for the read-only expanded demo table; real category CRUD uses
// `listCategories`).
import { SUB_CATEGORY_FIXTURES } from '../../lib/fixtures/subcategory-fixtures.js'
import {
  listCategories, createCategory, updateCategory, deleteCategory,
} from '../../lib/api/admin-categories.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'

const TOAST_TIMEOUT_MS = 2000

const ICON_MAP = {
  ShoppingBag, Utensils, Plane, Home, Car, Heart, Briefcase,
  Coffee, Gift, BookOpen, Music, Phone, Wifi, Zap, Droplet,
  Wrench, Stethoscope, GraduationCap, Dumbbell, Baby,
}

function CategoryIcon({ name, className }) {
  const Icon = ICON_MAP[name]
  if (!Icon) return null
  return <Icon className={className} aria-hidden="true" />
}

const DOT_CLASS = {
  Brand:   'bg-brand-500',
  Success: 'bg-success-500',
  Danger:  'bg-danger-500',
  Warning: 'bg-warning-500',
  Info:    'bg-info-500',
  Neutral: 'bg-neutral-500',
}

// Mock owners — still shown in the read-only expanded view.
const MOCK_OWNERS = ['Usman', 'Aisha', 'Bilal', 'Hira', 'Sami']

function buildExpandedSubCats(parentId) {
  const subs = SUB_CATEGORY_FIXTURES.filter((s) => s.parentId === parentId)
  const out = []
  subs.forEach((sub, i) => {
    const ownerCount = 2 + (i % 2)
    for (let j = 0; j < ownerCount; j++) {
      out.push({
        id: `${sub.value}--${j}`,
        owner: MOCK_OWNERS[j % MOCK_OWNERS.length],
        name: sub.label,
        color: ['Brand', 'Info', 'Success', 'Warning'][j % 4],
        notes: '',
        isActive: j % 4 !== 3,
      })
    }
  })
  return out
}

const EMPTY_FORM = {
  name: '',
  // Array of selected types — supports ['intake'], ['expense'], or ['intake','expense']
  // When both are selected, two Category rows are created (one per type).
  types: ['expense'],
  color: 'Brand',
  icon: 'ShoppingBag',
  description: '',
  isDefault: false,
}

const TYPE_OPTIONS = [
  { value: 'intake',  label: 'Intake'  },
  { value: 'expense', label: 'Expense' },
]

const CURRENT_ADMIN = { id: 'admin-1', name: 'Aisha' }

export default function AdminCategories() {
  const [refreshKey, setRefreshKey] = useState(0)
  const listQ = useQuery(() => listCategories({}), [refreshKey])
  const categories = listQ.data?.categories ?? []

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [confirmDisable, setConfirmDisable] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [toast, setToast] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), TOAST_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (message) => setToast({ kind: 'success', message })
  const setError = (message) => setFormError(message)

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setFormError('')
    setAddModalOpen(true)
  }

  const openEdit = (cat) => {
    setForm({
      name: cat.name,
      types: [cat.type.toLowerCase()],
      color: cat.color ?? 'Brand',
      icon: cat.icon ?? 'ShoppingBag',
      description: cat.description ?? '',
      isDefault: cat.isDefault ?? false,
    })
    setFormError('')
    setEditingCategory(cat)
  }

  const closeFormModal = useCallback(() => {
    setAddModalOpen(false)
    setEditingCategory(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }, [])

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const name = form.name.trim()
    if (!name) {
      setError('Name is required')
      return
    }
    if (name.length > 50) {
      setError('Name must be 50 characters or fewer')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const body = {
        name,
        color: form.color,
        icon: form.icon,
        description: form.description,
        isDefault: form.isDefault,
      }

      if (editingCategory) {
        // Editing existing single category — use its type directly
        await updateCategory(editingCategory.id, {
          ...body,
          type: form.types[0].toUpperCase(),
        })
        showToast('Category updated')
      } else {
        // New category — create one row per selected type
        // (e.g. selecting both creates an INTAKE and an EXPENSE row)
        const types = form.types.length > 0 ? form.types : ['expense']
        for (const t of types) {
          await createCategory({
            ...body,
            type: t.toUpperCase(),
          })
        }
        showToast(
          types.length > 1
            ? `Added ${types.length} categories (one per type)`
            : 'Category added',
        )
      }
      setRefreshKey((k) => k + 1)
      closeFormModal()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_name_in_scope') {
        setError('A category with this name already exists for this type')
      } else if (err instanceof ApiError && err.code === 'invalid_department_id') {
        setError('Selected department does not exist')
      } else if (err instanceof ApiError && err.fields) {
        const firstField = Object.keys(err.fields)[0]
        setError(err.fields[firstField][0])
      } else {
        setError(err?.message || 'Couldn\u2019t save category.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (cat) => {
    if (cat.isActive) {
      setConfirmDisable(cat)
    } else {
      try {
        await updateCategory(cat.id, { isActive: true })
        showToast(`Enabled "${cat.name}"`)
        setRefreshKey((k) => k + 1)
      } catch (err) {
        showToast(err?.message || 'Couldn\u2019t enable category.')
      }
    }
  }

  const handleDisableConfirm = async () => {
    if (!confirmDisable) return
    const name = confirmDisable.name
    try {
      await deleteCategory(confirmDisable.id)
      setConfirmDisable(null)
      showToast(`Disabled "${name}"`)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      showToast(err?.message || 'Couldn\u2019t disable category.')
      setConfirmDisable(null)
    }
  }

  const toggleExpand = (id) => setExpandedId((prev) => (prev === id ? null : id))

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title="Categories"
        currentAdmin={CURRENT_ADMIN}
        rightAction={
          <PrimaryButton onClick={openAdd}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span>New category</span>
          </PrimaryButton>
        }
      />

      <main className="flex-1 pb-12" aria-label="Admin categories">
        <Container variant="default" className="py-4">
          <Stack gap={4}>
            {toast && (
              <InlineAlert
                variant="success"
                role="status"
                title={toast.message}
              />
            )}

            {listQ.error && !listQ.loading && (
              <ErrorState error={listQ.error} onRetry={listQ.run} />
            )}

            {listQ.loading && !listQ.data ? (
              <Stack gap={3}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </Stack>
            ) : categories.length === 0 ? (
              <Card variant="default" padding="md">
                <EmptyState
                  title="No categories yet"
                  message="Create a top-level category to start organizing transactions."
                />
              </Card>
            ) : (
              <>
                {/* ── Desktop table (≥640px) ───────────────────────────────── */}
                <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
                  <div
                    role="table"
                    aria-label="Top-level categories"
                    className="w-full"
                  >
                    <div
                      role="row"
                      className="grid grid-cols-[auto_minmax(0,1.4fr)_90px_minmax(0,1.6fr)_70px_70px_100px_140px] items-center gap-3 bg-bg-sunken px-4 py-3"
                    >
                      <span role="columnheader" aria-hidden="true" />
                      <span role="columnheader" className="text-caption font-semibold uppercase tracking-wide text-text-secondary">Name</span>
                      <span role="columnheader" className="text-caption font-semibold uppercase tracking-wide text-text-secondary">Type</span>
                      <span role="columnheader" className="text-caption font-semibold uppercase tracking-wide text-text-secondary">Description</span>
                      <span role="columnheader" className="text-right text-caption font-semibold uppercase tracking-wide text-text-secondary">Sub-cats</span>
                      <span role="columnheader" className="text-right text-caption font-semibold uppercase tracking-wide text-text-secondary">Users</span>
                      <span role="columnheader" className="text-center text-caption font-semibold uppercase tracking-wide text-text-secondary">Status</span>
                      <span role="columnheader" className="text-right text-caption font-semibold uppercase tracking-wide text-text-secondary">Actions</span>
                    </div>

                    {categories.map((cat) => {
                      const isOpen = expandedId === cat.id
                      const dotClass = DOT_CLASS[cat.color] ?? 'bg-neutral-500'

                      return (
                        <div
                          key={cat.id}
                          role="row"
                          className={clsx(
                            'border-t border-border-subtle transition-colors',
                            !cat.isActive && 'opacity-60',
                          )}
                        >
                          <div className="grid grid-cols-[auto_minmax(0,1.4fr)_90px_minmax(0,1.6fr)_70px_70px_100px_140px] items-center gap-3 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => toggleExpand(cat.id)}
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? 'Collapse' : 'Expand'} sub-categories for ${cat.name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-bg-sunken focus:outline-none focus:ring-2 focus:ring-border-focus"
                            >
                              {isOpen
                                ? <ChevronDown className="h-5 w-5" aria-hidden="true" />
                                : <ChevronRight className="h-5 w-5" aria-hidden="true" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleExpand(cat.id)}
                              className="flex items-center gap-2 text-left focus:outline-none focus:ring-2 focus:ring-border-focus rounded-md"
                            >
                              <span className={clsx('inline-block h-3 w-3 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
                              <CategoryIcon name={cat.icon} className="h-4 w-4 shrink-0 text-text-secondary" />
                              <span className="truncate text-body-m font-semibold text-text-primary">
                                {cat.name}
                              </span>
                              {cat.isDefault && (
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                                  Default
                                </span>
                              )}
                            </button>

                            <div role="cell">
                              <Badge variant={cat.type}>{cat.type}</Badge>
                            </div>

                            <p role="cell" className="truncate text-body-m text-text-secondary">
                              {cat.description || <span className="text-text-tertiary">—</span>}
                            </p>

                            <span role="cell" className="text-right tabular-nums text-body-m text-text-primary">
                              {cat.subCategoryCount ?? 0}
                            </span>

                            <span role="cell" className="text-right tabular-nums text-body-m text-text-primary">
                              {cat.assignedUserCount ?? 0}
                            </span>

                            <div role="cell" className="flex items-center justify-center">
                              <Switch
                                checked={cat.isActive}
                                onChange={() => handleToggleActive(cat)}
                                aria-label={`${cat.isActive ? 'Disable' : 'Enable'} ${cat.name}`}
                                size="sm"
                              />
                            </div>

                            <div role="cell" className="flex items-center justify-end gap-1">
                              <IconButton
                                aria-label={`Edit ${cat.name}`}
                                onClick={() => openEdit(cat)}
                              >
                                <Pencil className="h-5 w-5" aria-hidden="true" />
                              </IconButton>
                              <IconButton
                                aria-label={`${cat.isActive ? 'Disable' : 'Enable'} ${cat.name}`}
                                onClick={() => handleToggleActive(cat)}
                              >
                                <Power className="h-5 w-5" aria-hidden="true" />
                              </IconButton>
                            </div>
                          </div>

                          {isOpen && (
                            <ExpandedSubCats parentId={cat.id} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── Mobile cards (<640px) ─────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {categories.map((cat) => {
                    const isOpen = expandedId === cat.id
                    const dotClass = DOT_CLASS[cat.color] ?? 'bg-neutral-500'
                    const subCount = cat.subCategoryCount ?? 0
                    return (
                      <Card key={cat.id} variant="default" padding="md">
                        <Stack gap={3}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className={clsx('inline-block h-3 w-3 shrink-0 rounded-full', dotClass)} aria-hidden="true" />
                              <CategoryIcon name={cat.icon} className="h-5 w-5 shrink-0 text-text-secondary" />
                              <span className="truncate text-body-l font-semibold text-text-primary">
                                {cat.name}
                              </span>
                              {cat.isDefault && (
                                <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                                  Default
                                </span>
                              )}
                            </div>
                            <Badge variant={cat.type}>{cat.type}</Badge>
                          </div>

                          {cat.description && (
                            <p className="text-body-m text-text-secondary">{cat.description}</p>
                          )}

                          <div className="flex items-center justify-between gap-3 text-caption text-text-tertiary">
                            <span>{subCount} sub-cat{subCount === 1 ? '' : 's'}</span>
                            <span className="flex items-center gap-2">
                              <span>Active</span>
                              <Switch
                                checked={cat.isActive}
                                onChange={() => handleToggleActive(cat)}
                                aria-label={`${cat.isActive ? 'Disable' : 'Enable'} ${cat.name}`}
                                size="sm"
                              />
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <GhostButton
                              fullWidth
                              onClick={() => toggleExpand(cat.id)}
                              aria-expanded={isOpen}
                            >
                              {isOpen ? 'Hide sub-categories' : 'View sub-categories'}
                            </GhostButton>
                            <IconButton aria-label={`Edit ${cat.name}`} onClick={() => openEdit(cat)}>
                              <Pencil className="h-5 w-5" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              aria-label={`${cat.isActive ? 'Disable' : 'Enable'} ${cat.name}`}
                              onClick={() => handleToggleActive(cat)}
                            >
                              <Power className="h-5 w-5" aria-hidden="true" />
                            </IconButton>
                          </div>

                          {isOpen && (
                            <div className="border-t border-border-subtle pt-3">
                              <ExpandedSubCats parentId={cat.id} compact />
                            </div>
                          )}
                        </Stack>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}
          </Stack>
        </Container>
      </main>

      {/* ── Add / Edit modal ──────────────────────────────────────────── */}
      <Modal
        open={addModalOpen || Boolean(editingCategory)}
        onClose={closeFormModal}
        title={editingCategory ? 'Edit category' : 'New category'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap={4}>
            <TextInput
              label="Name"
              required
              autoComplete="off"
              maxLength={50}
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }))
                if (formError) setFormError('')
              }}
              placeholder="e.g. Office supplies"
            />

            <div>
              <p className="mb-2 text-body-m font-semibold text-text-primary">
                Type
                <span className="ml-2 text-caption font-normal text-text-tertiary">
                  Select one or both — selecting both creates 2 categories
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const isSelected = form.types.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setForm((f) => {
                          const next = isSelected
                            ? f.types.filter((t) => t !== opt.value)
                            : [...f.types, opt.value]
                          // Always keep at least one type selected
                          return { ...f, types: next.length > 0 ? next : f.types }
                        })
                      }}
                      aria-pressed={isSelected}
                      className={clsx(
                        'rounded-md border px-3 py-1 text-body-m',
                        isSelected
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-border bg-bg-surface text-text-secondary'
                      )}
                    >
                      {isSelected ? '✓ ' : ''}{opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <ColorPicker
              label="Color"
              value={form.color}
              onChange={(c) => setForm((f) => ({ ...f, color: c }))}
            />

            <IconPicker
              label="Icon"
              value={form.icon}
              onChange={(i) => setForm((f) => ({ ...f, icon: i }))}
            />

            <Textarea
              label="Description"
              maxLength={200}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional — what this category is for."
            />

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-sunken px-4 py-3">
              <div>
                <p className="text-body-m font-semibold text-text-primary">Is default</p>
                <p className="text-caption text-text-tertiary">
                  New users start with this category assigned.
                </p>
              </div>
              <Switch
                checked={form.isDefault}
                onChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
                aria-label="Is default"
              />
            </div>

            {formError && (
              <p className="text-caption text-danger-700" role="alert">
                {formError}
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <GhostButton type="button" onClick={closeFormModal}>
                Cancel
              </GhostButton>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting
                  ? (editingCategory ? 'Saving…' : 'Adding…')
                  : (editingCategory ? 'Save' : 'Add category')}
              </PrimaryButton>
            </div>
          </Stack>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDisable)}
        onClose={() => setConfirmDisable(null)}
        onConfirm={handleDisableConfirm}
        title="Disable category?"
        message={
          confirmDisable
            ? `Disable '${confirmDisable.name}'? Existing transactions keep this label.`
            : ''
        }
        confirmLabel="Disable"
        variant="danger"
      />
    </div>
  )
}

function ExpandedSubCats({ parentId, compact = false }) {
  const rows = buildExpandedSubCats(parentId)
  if (rows.length === 0) {
    return (
      <p className={clsx('px-4 py-3 text-caption text-text-tertiary', compact && 'px-0')}>
        No sub-categories yet for this parent.
      </p>
    )
  }

  return (
    <div
      className={clsx(
        'bg-bg-sunken transition-all',
        compact ? 'px-1' : 'border-t border-border-subtle px-4 py-3',
      )}
    >
      <div className={clsx('mb-2 flex items-center justify-between', compact && 'px-2')}>
        <p className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">
          Sub-categories across users
        </p>
        <span className="text-caption text-text-tertiary">Read-only</span>
      </div>
      <div className={clsx('overflow-hidden rounded-md border border-border-subtle bg-bg-surface', compact && 'mx-0')}>
        <table className="w-full">
          <thead>
            <tr className="bg-bg-surface">
              <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Owner</th>
              <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Sub-category</th>
              <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Color</th>
              <th scope="col" className="px-3 py-2 text-left text-caption font-semibold uppercase tracking-wide text-text-secondary">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => {
              const dotClass = DOT_CLASS[row.color] ?? 'bg-neutral-500'
              return (
                <tr key={row.id}>
                  <td className="px-3 py-2 text-body-m text-text-primary">{row.owner}</td>
                  <td className="px-3 py-2 text-body-m text-text-primary">{row.name}</td>
                  <td className="px-3 py-2">
                    <span className={clsx('inline-block h-3 w-3 rounded-full', dotClass)} aria-hidden="true" />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-md px-2 py-0.5 text-caption font-semibold uppercase tracking-wide',
                        row.isActive ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-text-secondary',
                      )}
                    >
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}