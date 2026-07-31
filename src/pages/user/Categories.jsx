// User categories — wired to live API.
// Per docs/pages/10-categories-user.md.
//
// CRUD on sub-categories via `src/lib/queries/categories.js`.
//
// NOTE on backend gap B2: parent categories (`CATEGORIES` mock) do NOT yet have
// a user-side `GET /api/categories` endpoint. Until then we show a temporary
// hard-coded parent list — clearly marked as a fallback — and surface a
// hard-fail alert if the live sub-cat fetch returns 404 or 403.

import { useEffect, useMemo, useState } from 'react'
import { Info, Pencil, Plus, Trash2 } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import {
  listUserCategories,
  listSubCategories,
  createSubCategory,
  renameSubCategory,
  deleteSubCategory,
} from '../../lib/api/categories.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'

const TOAST_TIMEOUT_MS = 2000
const DOT_CLASSES = [
  'bg-brand-500',
  'bg-info-500',
  'bg-success-500',
  'bg-warning-500',
  'bg-danger-500',
]

export default function Categories() {
  const listQ = useQuery(
    () => listSubCategories({ mine: true, isActive: true }),
    [],
  )

  // Fetch parent categories the user is assigned to
  const parentQ = useQuery(() => listUserCategories(), [])

  // modal: { kind: 'add' | 'rename' | 'remove' | null, item?: any, parentId?: string }
  const [modal, setModal] = useState({ kind: null })
  const [toast, setToast] = useState(null)

  const [addForm, setAddForm] = useState({ name: '', parentId: '' })
  const [addError, setAddError] = useState('')
  const [renameValue, setRenameValue] = useState('')

  const closeModal = () => {
    setModal({ kind: null })
    setAddForm({ name: '', parentId: '' })
    setAddError('')
    setRenameValue('')
  }

  // Auto-dismiss toast after 2 seconds.
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), TOAST_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (message) => setToast({ kind: 'success', message })

  const subCategories = listQ.data?.subCategories ?? []

  const parentNamesByValue = useMemo(() => {
    const m = new Map()
    for (const sub of subCategories) {
      if (sub.parent) m.set(sub.parentId, sub.parent.name)
    }
    return m
  }, [subCategories])

  // Build parent options: prefer user's assigned categories, fallback to sub-cat parents
  const parentOptions = useMemo(() => {
    // First try user's assigned parent categories
    const assigned = parentQ.data?.categories ?? []
    if (assigned.length > 0) {
      return assigned.map((c) => ({ value: c.id, label: c.name }))
    }
    // Fallback to parents of existing sub-categories
    if (parentNamesByValue.size > 0) {
      return [...parentNamesByValue.entries()].map(([id, name]) => ({
        value: id,
        label: name,
      }))
    }
    return []
  }, [parentQ.data, parentNamesByValue])

  // Check if user has any categories assigned
  const hasParentCategories = parentOptions.length > 0
  const isLoading = listQ.loading || parentQ.loading

  const openAdd = (parentId) => {
    setAddForm({ name: '', parentId })
    setAddError('')
    setModal({ kind: 'add', parentId })
  }

  const openRename = (item) => {
    setRenameValue(item.name)
    setModal({ kind: 'rename', item })
  }

  const openRemove = (item) => setModal({ kind: 'remove', item })

  const handleAddSubmit = async (e) => {
    e?.preventDefault?.()
    const name = addForm.name.trim()
    if (!name) {
      setAddError('Name is required')
      return
    }
    if (!addForm.parentId) {
      setAddError('Parent category is required')
      return
    }
    try {
      await createSubCategory({
        name,
        parentId: addForm.parentId,
      })
      closeModal()
      showToast('Sub-category added')
      listQ.run()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_name_in_parent') {
        setAddError('Name already exists under this category')
      } else if (err instanceof ApiError && err.code === 'parent_not_found') {
        setAddError('Selected parent category does not exist')
      } else {
        setAddError(err?.message || 'Couldn\u2019t add sub-category')
      }
    }
  }

  const handleRenameSubmit = async (e) => {
    e?.preventDefault?.()
    const next = renameValue.trim()
    if (!next || !modal.item) return
    try {
      await renameSubCategory(modal.item.id, { name: next })
      closeModal()
      showToast('Renamed')
      listQ.run()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'duplicate_name_in_parent') {
        setAddError('Name already exists under this category')
        // Keep modal open by switching back to add — easier than building
        // an inline rename-error state. Page will refetch on close.
      } else {
        closeModal()
        showToast(err?.message || 'Rename failed')
      }
    }
  }

  const handleRemoveConfirm = async () => {
    if (!modal.item) return
    const removedName = modal.item.name
    try {
      await deleteSubCategory(modal.item.id)
      closeModal()
      showToast(`Removed "${removedName}"`)
      listQ.run()
    } catch (err) {
      closeModal()
      showToast(err?.message || 'Remove failed')
    }
  }

  // Group sub-categories by parent for rendering.
  const subsByParent = useMemo(() => {
    const m = new Map()
    for (const sub of subCategories) {
      const arr = m.get(sub.parentId) ?? []
      arr.push(sub)
      m.set(sub.parentId, arr)
    }
    return m
  }, [subCategories])

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader
        title="My Categories"
        rightAction={
          <IconButton
            aria-label="About sub-categories"
            title="Sub-categories are private to you. Admin manages top-level categories."
          >
            <Info className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        }
      />

      <main className="flex-1 pb-8" aria-label="My categories">
        <Container variant="default" className="py-4">
          <Stack gap={4}>
            {toast && (
              <InlineAlert
                variant="success"
                role="status"
                title={toast.message}
              />
            )}

            {listQ.error && !isLoading && (
              <ErrorState error={listQ.error} onRetry={listQ.run} />
            )}

            {isLoading ? (
              <Stack gap={4}>
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </Stack>
            ) : !hasParentCategories && !isLoading ? (
              // No categories assigned - show helpful message
              <Card variant="default" padding="lg">
                <Stack gap={4} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-sunken">
                    <Info className="h-6 w-6 text-text-tertiary" />
                  </div>
                  <div>
                    <h3 className="text-body-l font-semibold text-text-primary">
                      No Categories Assigned
                    </h3>
                    <p className="mt-1 text-body-m text-text-secondary">
                      Contact your administrator to assign you to some categories so you can create sub-categories.
                    </p>
                  </div>
                </Stack>
              </Card>
            ) : (
              (parentOptions).map((parent, idx) => {
                const subs = subsByParent.get(parent.value) ?? []
                const dotClass = DOT_CLASSES[idx % DOT_CLASSES.length]

                return (
                  <Card key={parent.value} variant="default" padding="md">
                    <Stack gap={3}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${dotClass}`}
                          aria-hidden="true"
                        />
                        <h2 className="text-body-l font-semibold text-text-primary">
                          {parent.label}
                        </h2>
                      </div>

                      {subs.length === 0 ? (
                        <p className="text-caption text-text-tertiary">
                          No sub-categories yet. Add one to start logging.
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {subs.map((sub) => (
                            <li
                              key={sub.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-surface px-3 py-2"
                            >
                              <span className="flex-1 text-body-m text-text-primary">
                                {sub.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <IconButton
                                  aria-label={`Edit sub-category ${sub.name}`}
                                  onClick={() => openRename(sub)}
                                >
                                  <Pencil className="h-5 w-5" aria-hidden="true" />
                                </IconButton>
                                <IconButton
                                  aria-label={`Remove sub-category ${sub.name}`}
                                  onClick={() => openRemove(sub)}
                                >
                                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                                </IconButton>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div>
                        <GhostButton
                          type="button"
                          onClick={() => openAdd(parent.value)}
                        >
                          <Plus className="h-5 w-5" aria-hidden="true" />
                          <span>Add sub-category</span>
                        </GhostButton>
                      </div>
                    </Stack>
                  </Card>
                )
              })
            )}
          </Stack>
        </Container>
      </main>

      <BottomTabBar />

      {/* Add modal */}
      <Modal
        open={modal.kind === 'add'}
        onClose={closeModal}
        title="Add sub-category"
        size="md"
      >
        <form onSubmit={handleAddSubmit}>
          <Stack gap={4}>
            <TextInput
              label="Name"
              required
              autoComplete="off"
              maxLength={50}
              value={addForm.name}
              onChange={(e) => {
                setAddForm((f) => ({ ...f, name: e.target.value }))
                if (addError) setAddError('')
              }}
              placeholder="e.g. Snacks"
            />
            <SelectDropdown
              label="Parent category"
              required
              options={parentOptions}
              value={addForm.parentId}
              onChange={(e) => {
                setAddForm((f) => ({ ...f, parentId: e.target.value }))
                if (addError) setAddError('')
              }}
            />
            {addError && (
              <p className="text-caption text-danger-700" role="alert">
                {addError}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <GhostButton type="button" onClick={closeModal}>
                Cancel
              </GhostButton>
              <PrimaryButton type="submit">Add</PrimaryButton>
            </div>
          </Stack>
        </form>
      </Modal>

      {/* Rename modal */}
      <Modal
        open={modal.kind === 'rename'}
        onClose={closeModal}
        title="Rename sub-category"
        size="md"
      >
        <form onSubmit={handleRenameSubmit}>
          <Stack gap={4}>
            <TextInput
              label="Name"
              required
              autoComplete="off"
              maxLength={50}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <GhostButton type="button" onClick={closeModal}>
                Cancel
              </GhostButton>
              <PrimaryButton type="submit">Save</PrimaryButton>
            </div>
          </Stack>
        </form>
      </Modal>

      {/* Remove confirmation */}
      <Modal
        open={modal.kind === 'remove'}
        onClose={closeModal}
        title="Remove sub-category?"
        size="md"
      >
        <Stack gap={4}>
          <p className="text-body-m text-text-primary">
            Soft-delete &ldquo;{modal.item?.name}&rdquo;? Existing transactions keep this label.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GhostButton type="button" onClick={closeModal}>
              Cancel
            </GhostButton>
            <PrimaryButton variant="expense" type="button" onClick={handleRemoveConfirm}>
              Remove
            </PrimaryButton>
          </div>
        </Stack>
      </Modal>
    </div>
  )
}