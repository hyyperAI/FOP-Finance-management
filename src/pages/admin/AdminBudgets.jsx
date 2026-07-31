/**
 * Admin Budgets — /admin/budgets
 * Wired to GET/POST/PATCH/DELETE /api/admin/budgets.
 * Per docs/pages/27-admin-budgets.md.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, CalendarRange, PiggyBank,
  TrendingDown, Wallet, Tags,
} from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { ProgressBar } from '../../components/ui/ProgressBar.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { AmountDisplay } from '../../components/ui/AmountDisplay.jsx'
import { Table } from '../../components/ui/Table.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import {
  listBudgets, createBudget, updateBudget, deleteBudget,
} from '../../lib/api/admin-budgets.js'
import { listCategories } from '../../lib/api/admin-categories.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { parseMoney, formatPKR } from '../../lib/format.js'

const TOAST_TIMEOUT_MS = 2000

const PERIOD_OPTIONS = [
  { value: 'this-month', label: 'This month', ariaLabel: 'This month' },
  { value: 'last-month', label: 'Last month', ariaLabel: 'Last month' },
  { value: 'custom',     label: 'Custom',     ariaLabel: 'Custom period' },
]

const CURRENT_ADMIN = { id: 'admin-1', name: 'Aisha' }

const EMPTY_FORM = { categoryId: '', amount: '' }

/** Map backend warningLevel → UI variant + label. */
function warningLevelToUi(level) {
  if (level === 'exceeded') return { variant: 'expense', label: 'Over' }
  if (level === 'warn')     return { variant: 'warning', label: 'Warning' }
  return { variant: 'intake', label: 'On track' }
}

function formatPeriodLabel(period) {
  if (!period) return ''
  const [y, m] = period.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function toPeriod(date) {
  const d = date || new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastMonthPeriod() {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return toPeriod(d)
}

export default function AdminBudgets() {
  const [period, setPeriod] = useState('this-month')
  const [customDate, setCustomDate] = useState('')

  const activePeriod = useMemo(() => {
    if (period === 'last-month') return lastMonthPeriod()
    if (period === 'custom')     return customDate ? customDate.slice(0, 7) : toPeriod(new Date())
    return toPeriod(new Date())
  }, [period, customDate])

  const [refreshKey, setRefreshKey] = useState(0)
  const listQ = useQuery(() => listBudgets({ period: activePeriod }), [activePeriod, refreshKey])
  const catQ  = useQuery(() => listCategories({ isActive: true }), [])

  const budgets = listQ.data?.budgets ?? []
  const categories = catQ.data?.categories ?? []

  const [modalMode, setModalMode] = useState(null)
  const [editingBudget, setEditingBudget] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, setToast] = useState(null)
  const [topError, setTopError] = useState(null)

  const showToast = (message) => setToast({ message })

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), TOAST_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [toast])

  // Summary stats
  const totalBudget   = budgets.reduce((s, b) => s + Number(b.amount ?? 0), 0)
  const totalSpent    = budgets.reduce((s, b) => s + Number(b.currentSpend ?? 0), 0)
  const totalRemaining = totalBudget - totalSpent
  const coveredCount   = budgets.length

  // Categories that need a budget — exclude any already with a budget for this period
  const usedCategoryIds = new Set(budgets.map((b) => b.categoryId))
  const categoriesNeedingBudget = categories.filter((c) => !usedCategoryIds.has(c.id))

  const openAdd = (presetCategoryId) => {
    setForm({ categoryId: presetCategoryId ?? '', amount: '' })
    setFormError('')
    setEditingBudget(null)
    setModalMode('add')
  }

  const openEdit = (budget) => {
    setForm({
      categoryId: budget.categoryId,
      amount: String(budget.amount ?? ''),
    })
    setFormError('')
    setEditingBudget(budget)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditingBudget(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setSubmitting(false)
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setFormError('')
    if (!form.categoryId) {
      setFormError('Category is required')
      return
    }
    const parsed = parseMoney(form.amount)
    if (parsed.error) {
      setFormError(parsed.error)
      return
    }
    setSubmitting(true)
    try {
      const amountStr = form.amount.replace(/,/g, '').trim()
      if (modalMode === 'edit' && editingBudget) {
        await updateBudget(editingBudget.id, { amount: amountStr })
        showToast('Budget updated')
      } else {
        await createBudget({
          categoryId: form.categoryId,
          periodKey: activePeriod,
          amount: amountStr,
        })
        showToast('Budget added')
      }
      setRefreshKey((k) => k + 1)
      closeModal()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'budget_already_exists') {
        setFormError('A budget for this category already exists for this period')
      } else if (err instanceof ApiError && err.code === 'category_not_found') {
        setFormError('Selected category does not exist')
      } else if (err instanceof ApiError && err.fields) {
        const firstField = Object.keys(err.fields)[0]
        setFormError(err.fields[firstField][0])
      } else {
        setFormError(err?.message || 'Couldn\u2019t save budget.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const requestDelete = (budget) => setConfirmDelete(budget)

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    setSubmitting(true)
    try {
      await deleteBudget(confirmDelete.id)
      showToast('Budget deleted')
      setRefreshKey((k) => k + 1)
      setConfirmDelete(null)
    } catch (err) {
      setTopError(err?.message || 'Couldn\u2019t delete budget.')
    } finally {
      setSubmitting(false)
    }
  }

  const categoryOptions = useMemo(() => {
    if (modalMode === 'edit') {
      return categories.map((c) => ({ value: c.id, label: c.name }))
    }
    return categoriesNeedingBudget.map((c) => ({ value: c.id, label: c.name }))
  }, [modalMode, categories, categoriesNeedingBudget])

  const categoryNameById = useMemo(() => {
    const m = new Map()
    for (const c of categories) m.set(c.id, c.name)
    return m
  }, [categories])

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title="Budgets"
        currentAdmin={CURRENT_ADMIN}
        rightAction={
          <PrimaryButton onClick={() => openAdd()} disabled={categoriesNeedingBudget.length === 0 && modalMode !== 'edit'}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span>New budget</span>
          </PrimaryButton>
        }
      />

      <main className="flex-1 pb-12" aria-label="Admin budgets">
        <Container variant="default" className="py-4">
          <Stack gap={4}>
            {toast && (
              <InlineAlert variant="success" role="status" title={toast.message} />
            )}
            {topError && (
              <InlineAlert variant="danger" title="Action failed">
                {topError}
              </InlineAlert>
            )}

            <Card variant="default" padding="md">
              <Stack gap={3}>
                <div className="flex items-center gap-2 text-text-secondary">
                  <CalendarRange className="h-5 w-5" aria-hidden="true" />
                  <p className="text-body-m">
                    Showing budgets for{' '}
                    <span className="font-semibold text-text-primary">
                      {formatPeriodLabel(activePeriod)}
                    </span>
                  </p>
                </div>
                <SegmentedControl
                  options={PERIOD_OPTIONS}
                  value={period}
                  onChange={setPeriod}
                  ariaLabel="Budget period"
                />
                {period === 'custom' && (
                  <DatePicker
                    label="Period"
                    required
                    type="month"
                    value={customDate.slice(0, 7)}
                    onChange={(e) => {
                      const v = e.target.value
                      if (!v) return
                      setCustomDate(`${v}-01`)
                    }}
                  />
                )}
              </Stack>
            </Card>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total budget"     value={formatPKR(totalBudget)}     variant="neutral" icon={PiggyBank} />
              <StatCard label="Total spent"      value={formatPKR(totalSpent)}      variant="expense"  icon={TrendingDown} />
              <StatCard
                label="Total remaining"
                value={formatPKR(totalRemaining)}
                variant={totalRemaining < 0 ? 'expense' : 'intake'}
                icon={Wallet}
              />
              <StatCard
                label="Categories covered"
                value={`${coveredCount} / ${categories.length}`}
                variant="info"
                icon={Tags}
              />
            </div>

            {listQ.error && !listQ.loading && (
              <ErrorState error={listQ.error} onRetry={listQ.run} />
            )}

            {listQ.loading && !listQ.data ? (
              <Stack gap={3}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </Stack>
            ) : budgets.length === 0 && categoriesNeedingBudget.length === categories.length ? (
              <Card variant="default" padding="md">
                <EmptyState
                  icon={PiggyBank}
                  title="No budgets set"
                  message={`Set budgets for ${formatPeriodLabel(activePeriod)} to track spending per category.`}
                />
              </Card>
            ) : budgets.length === 0 ? (
              <Card variant="default" padding="md">
                <EmptyState
                  icon={PiggyBank}
                  title={`No budgets for ${formatPeriodLabel(activePeriod)}`}
                  message="Use “New budget” above to add one for this period."
                />
              </Card>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table
                    columns={[
                      {
                        key: 'category',
                        label: 'Category',
                        render: (b) => (
                          <span className="font-semibold text-text-primary">
                            {b.categoryName ?? categoryNameById.get(b.categoryId) ?? '—'}
                          </span>
                        ),
                      },
                      {
                        key: 'type',
                        label: 'Type',
                        render: (b) => {
                          const cat = categories.find((c) => c.id === b.categoryId)
                          return (
                            <Badge variant={cat?.type ?? 'default'}>
                              {cat?.type ?? 'expense'}
                            </Badge>
                          )
                        },
                      },
                      {
                        key: 'budget',
                        label: 'Budget',
                        align: 'right',
                        render: (b) => <AmountDisplay amountPkr={Number(b.amount)} variant="neutral" size="sm" />,
                      },
                      {
                        key: 'spent',
                        label: 'Spent',
                        align: 'right',
                        render: (b) => <AmountDisplay amountPkr={Number(b.currentSpend ?? 0)} variant="expense" size="sm" />,
                      },
                      {
                        key: 'remaining',
                        label: 'Remaining',
                        align: 'right',
                        render: (b) => {
                          const remaining = Number(b.amount) - Number(b.currentSpend ?? 0)
                          return (
                            <AmountDisplay
                              amountPkr={remaining}
                              variant={remaining < 0 ? 'expense' : 'intake'}
                              size="sm"
                            />
                          )
                        },
                      },
                      {
                        key: 'progress',
                        label: '% used',
                        render: (b) => {
                          const max = Number(b.amount)
                          const value = Number(b.currentSpend ?? 0)
                          const status = warningLevelToUi(b.warningLevel)
                          return (
                            <ProgressBar
                              value={value}
                              max={max}
                              trailing={`${Math.round(b.percentUsed ?? 0)}%`}
                              variant={status.variant}
                            />
                          )
                        },
                      },
                      {
                        key: 'status',
                        label: 'Status',
                        render: (b) => {
                          const status = warningLevelToUi(b.warningLevel)
                          return <Badge variant={status.variant}>{status.label}</Badge>
                        },
                      },
                      {
                        key: 'actions',
                        label: 'Actions',
                        align: 'right',
                        render: (b) => (
                          <div className="flex items-center justify-end gap-1">
                            <IconButton
                              aria-label={`Edit budget for ${b.categoryName ?? categoryNameById.get(b.categoryId)}`}
                              onClick={() => openEdit(b)}
                            >
                              <Pencil className="h-5 w-5" aria-hidden="true" />
                            </IconButton>
                            <IconButton
                              aria-label={`Delete budget for ${b.categoryName ?? categoryNameById.get(b.categoryId)}`}
                              onClick={() => requestDelete(b)}
                            >
                              <Trash2 className="h-5 w-5" aria-hidden="true" />
                            </IconButton>
                          </div>
                        ),
                      },
                    ]}
                    rows={budgets}
                  />
                </div>

                {/* Mobile cards */}
                <div className="grid grid-cols-1 gap-3 sm:hidden">
                  {budgets.map((b) => {
                    const cat = categories.find((c) => c.id === b.categoryId)
                    const remaining = Number(b.amount) - Number(b.currentSpend ?? 0)
                    const status = warningLevelToUi(b.warningLevel)
                    return (
                      <Card key={b.id} variant="default" padding="md">
                        <Stack gap={3}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-body-l font-semibold text-text-primary">
                                {b.categoryName ?? categoryNameById.get(b.categoryId) ?? '—'}
                              </p>
                              <Badge variant={cat?.type ?? 'default'}>{cat?.type ?? 'expense'}</Badge>
                            </div>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-caption text-text-tertiary">
                            <div>
                              <p className="uppercase tracking-wide">Budget</p>
                              <AmountDisplay amountPkr={Number(b.amount)} variant="neutral" size="sm" />
                            </div>
                            <div>
                              <p className="uppercase tracking-wide">Spent</p>
                              <AmountDisplay amountPkr={Number(b.currentSpend ?? 0)} variant="expense" size="sm" />
                            </div>
                            <div>
                              <p className="uppercase tracking-wide">Remaining</p>
                              <AmountDisplay
                                amountPkr={remaining}
                                variant={remaining < 0 ? 'expense' : 'intake'}
                                size="sm"
                              />
                            </div>
                          </div>

                          <ProgressBar
                            value={Number(b.currentSpend ?? 0)}
                            max={Number(b.amount)}
                            trailing={`${Math.round(b.percentUsed ?? 0)}%`}
                            variant={status.variant}
                          />

                          <div className="flex items-center gap-2">
                            <GhostButton
                              fullWidth
                              onClick={() => openEdit(b)}
                              aria-label={`Edit budget for ${b.categoryName ?? categoryNameById.get(b.categoryId)}`}
                            >
                              Edit
                            </GhostButton>
                            <IconButton
                              aria-label={`Delete budget for ${b.categoryName ?? categoryNameById.get(b.categoryId)}`}
                              onClick={() => requestDelete(b)}
                            >
                              <Trash2 className="h-5 w-5" aria-hidden="true" />
                            </IconButton>
                          </div>
                        </Stack>
                      </Card>
                    )
                  })}
                </div>
              </>
            )}

            {categoriesNeedingBudget.length > 0 && (
              <Stack gap={3}>
                <p className="text-caption font-semibold uppercase tracking-wide text-text-tertiary">
                  Categories without a budget
                </p>
                <Card variant="default" padding="md">
                  <ul className="divide-y divide-border-subtle">
                    {categoriesNeedingBudget.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-body-m font-semibold text-text-primary">{c.name}</span>
                          <Badge variant={c.type}>{c.type}</Badge>
                          <span className="text-caption text-text-tertiary">Not set</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openAdd(c.id)}
                          className="self-start rounded-md text-body-m font-semibold text-brand-600 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus sm:self-auto"
                        >
                          Add budget
                        </button>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Stack>
            )}
          </Stack>
        </Container>
      </main>

      {/* Add / Edit modal */}
      <Modal
        open={modalMode !== null}
        onClose={closeModal}
        title={modalMode === 'edit' ? 'Edit budget' : 'New budget'}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap={4}>
            <SelectDropdown
              label="Category"
              required
              value={form.categoryId}
              onChange={(e) => {
                setForm((f) => ({ ...f, categoryId: e.target.value }))
                if (formError) setFormError('')
              }}
              options={categoryOptions}
              disabled={modalMode === 'edit'}
              placeholder="Select a category"
            />
            <NumberInput
              label="Amount"
              required
              value={form.amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                setForm((f) => ({ ...f, amount: v }))
                if (formError) setFormError('')
              }}
              placeholder="0"
              inputMode="decimal"
              variant="default"
            />
            {formError && (
              <p className="text-caption text-danger-700" role="alert">
                {formError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <GhostButton type="button" onClick={closeModal} disabled={submitting}>
                Cancel
              </GhostButton>
              <PrimaryButton type="submit" disabled={submitting}>
                {submitting
                  ? 'Saving…'
                  : modalMode === 'edit' ? 'Save changes' : 'Add budget'}
              </PrimaryButton>
            </div>
          </Stack>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => {
          if (!submitting) setConfirmDelete(null)
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete budget?"
        message={
          confirmDelete
            ? `Delete budget for ${confirmDelete.categoryName ?? categoryNameById.get(confirmDelete.categoryId)}? Existing transactions keep their values.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  )
}