// Static UI — no real submit. Mocked per docs/pages/05-intake-new.md §13.
// Page: /intake/new — single-column income form.
// All values stay in local state; the 800ms "save" is a setTimeout and toast
// simulation is an inline success banner (no Toast component in shared lib).

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { FormError } from '../../components/ui/FormError.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { FileUpload } from '../../components/ui/FileUpload.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'

import { PAYMENT_METHODS } from '../../lib/fixtures/payment-methods.js'  // Phase J — extracted static UI enum from mock-data.js

import { useAuth } from '../../lib/auth.jsx'
import { useQuery } from '../../lib/hooks/useApi.js'
import { listSubCategories, listUserCategories } from '../../lib/api/categories.js'
import { createTransaction } from '../../lib/api/transactions.js'
import { uploadReceipt } from '../../lib/api/receipts.js'
import { parseMoney } from '../../lib/format.js'

const MAX_DESCRIPTION = 500
const MAX_NAME = 100
const MAX_FILE_AGE_DAYS = 30
const SUBMIT_DELAY_MS = 800

// YYYY-MM-DD in local timezone (matches <input type="date"> value format).
function toDateInputValue(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseAmount(raw) {
  // Reuse the shared helper from src/lib/format.js so the rules are
  // consistent across all money-entry forms.
  const result = parseMoney(raw)
  return { value: result.value, decimals: result.decimals, error: result.error }
}

function validateDate(raw, today) {
  if (!raw) return { ok: false, error: 'Date is required' }
  const picked = new Date(`${raw}T00:00:00`)
  if (Number.isNaN(picked.getTime())) return { ok: false, error: 'Invalid date' }
  const todayMidnight = new Date(today)
  todayMidnight.setHours(0, 0, 0, 0)
  if (picked > todayMidnight) return { ok: false, error: 'Date cannot be in the future' }
  const minDate = new Date(todayMidnight)
  minDate.setDate(minDate.getDate() - MAX_FILE_AGE_DAYS)
  if (picked < minDate) return { ok: false, error: 'Date too old — contact admin' }
  return { ok: true, error: null }
}

function buildErrors({ amount, subCategoryId, paymentMethod, personName, dateResult }) {
  const errs = {}
  if (amount.error) errs.amount = amount.error
  else if (amount.value == null) errs.amount = 'Amount is required'
  if (!subCategoryId) errs.subCategoryId = 'Sub-category is required'
  if (!paymentMethod) errs.paymentMethod = 'Payment method is required'
  if (!personName.trim()) errs.personName = 'Person name is required'
  else if (personName.length > MAX_NAME) errs.personName = `Max ${MAX_NAME} characters`
  if (!dateResult.ok) errs.date = dateResult.error
  return errs
}

export default function Intake() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const today = useMemo(() => new Date(), [])
  const minDateStr = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - MAX_FILE_AGE_DAYS)
    return toDateInputValue(d)
  }, [today])
  const maxDateStr = useMemo(() => toDateInputValue(today), [today])
  const initialDate = useMemo(() => toDateInputValue(today), [today])

  // Live sub-category list (user's own active sub-categories).
  // The legacy page has no category picker; until gap B2 (GET /api/categories)
  // ships, we load the user's full sub-cat list and filter client-side.
  const subCatQ = useQuery(
    () => listSubCategories({ mine: true, isActive: true }),
    [],
  )

  // User's assigned parent categories (used to know which sub-cats are valid)
  const parentCatQ = useQuery(() => listUserCategories(), [])

  const [amountRaw, setAmountRaw] = useState('')
  const [subCategoryId, setSubCategoryId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [personName, setPersonName] = useState(user?.name || user?.username || '')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(initialDate)
  const [receipt, setReceipt] = useState(null)

  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [topError, setTopError] = useState('')
  const [success, setSuccess] = useState('')

  // Auto-focus amount on mount.
  const amountRef = useRef(null)
  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  // Sync person-name default if session loads after mount.
  useEffect(() => {
    if (user && !personName) {
      setPersonName(user.name || user.username || '')
    }
  }, [user, personName])

  // Build the option list for the sub-category picker.
  // Only use real data from backend - no fallback with fake IDs.
  // Filter by parent type matching this transaction type (INTAKE).
  const subCategoryOptions = useMemo(() => {
    const live = subCatQ.data?.subCategories ?? []
    if (live.length > 0) {
      return live
        .filter((s) => {
          // Show only sub-categories whose parent is an INTAKE type
          // AND the user is assigned to that parent category.
          const parents = parentCatQ.data?.categories ?? []
          const isAssigned = parents.some((p) => p.id === s.parentId)
          return s.parent?.type === 'INTAKE' && isAssigned
        })
        .map((s) => ({
          value: s.id,
          label: `${s.parent?.name ?? ''} → ${s.name}`,
        }))
    }
    return []
  }, [subCatQ.data, parentCatQ.data])

  // Build a lookup map for resolving categoryId from subCategoryId
  const subCategoryLookup = useMemo(() => {
    const map = new Map()
    const live = subCatQ.data?.subCategories ?? []
    for (const s of live) {
      map.set(s.id, s.parentId)
    }
    return map
  }, [subCatQ.data])

  // Show loading or empty state if no sub-categories
  const hasSubCategories = subCategoryOptions.length > 0

  const amountParsed = useMemo(() => parseAmount(amountRaw), [amountRaw])
  const dateResult = useMemo(() => validateDate(date, today), [date, today])
  const allErrors = useMemo(
    () =>
      buildErrors({
        amount: amountParsed,
        subCategoryId,
        paymentMethod,
        personName,
        dateResult,
      }),
    [amountParsed, subCategoryId, paymentMethod, personName, dateResult],
  )

  const showError = (field) => (touched[field] ? allErrors[field] : undefined)

  const resetForm = () => {
    setAmountRaw('')
    setSubCategoryId('')
    setPaymentMethod('CASH')
    setPersonName(user?.name || user?.username || '')
    setDescription('')
    setReceipt(null)
    // Keep date + payment method per spec §5 "Save & add another".
    setTouched({})
    setTopError('')
    // Re-focus amount for the next entry.
    setTimeout(() => amountRef.current?.focus(), 0)
  }

  const handleSubmit = async (mode /* 'save' | 'addAnother' */) => {
    setTouched({
      amount: true,
      subCategoryId: true,
      paymentMethod: true,
      personName: true,
      date: true,
    })
    if (Object.keys(allErrors).length > 0) {
      setTopError('Please fix the highlighted fields and try again.')
      return
    }
    setTopError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      // 1. Upload receipt first (if attached)
      // FileUpload component stores { name, size, previewUrl } - we need to get the actual file
      let receiptUrl
      if (receipt?.previewUrl) {
        // receipt is { name, size, previewUrl } from FileUpload component
        // We need to fetch the file from the previewUrl (blob URL) to upload it
        const response = await fetch(receipt.previewUrl)
        const blob = await response.blob()
        const file = new File([blob], receipt.name, { type: blob.type })
        const { key } = await uploadReceipt(file)
        receiptUrl = key
      }

      // 2. Find the parent categoryId for the selected sub-category
      // (we need it because backend's createTransaction requires categoryId).
      const categoryId = subCategoryLookup.get(subCategoryId)

      if (!categoryId) {
        // No sub-categories available - redirect to categories page to create one
        throw new Error('No sub-categories available. Please create a sub-category first in the Categories page.')
      }

      // 3. Create transaction
      await createTransaction({
        type: 'INTAKE',
        amount: amountRaw,
        vendor: personName || undefined,
        description: description || undefined,
        paymentMethod,
        occurredAt: new Date(`${date}T00:00:00`).toISOString(),
        categoryId,
        subCategoryId,
        receiptUrl,
      })

      if (mode === 'addAnother') {
        setSuccess('Intake saved. Add another below.')
        resetForm()
      } else {
        navigate('/')
      }
    } catch (err) {
      console.error('Save intake failed:', err)
      setTopError(
        err?.message
          || (err?.fields?.amount ? err.fields.amount[0] : null)
          || 'Couldn\u2019t save intake. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader title="Intake" />

      <main className="flex-1 pb-32" aria-label="Log intake form">
        <Container variant="narrow" className="py-6">
          <Stack gap={6}>
            {topError && (
              <FormError title="Couldn't save" message={topError} />
            )}
            {success && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-start gap-3 rounded-lg border border-success-500 bg-success-50 p-4 text-success-700"
              >
                <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden="true" />
                <p className="text-body-m font-semibold">{success}</p>
              </div>
            )}

            <Card variant="default" padding="lg">
              <Stack gap={6}>
                <NumberInput
                  ref={amountRef}
                  label="Amount"
                  helperText="Numeric pad opens automatically. Use a positive number with up to 2 decimals."
                  error={showError('amount')}
                  required
                  autoComplete="off"
                  value={amountRaw}
                  onChange={(e) => setAmountRaw(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                  disabled={isSubmitting}
                />

                <SelectDropdown
                  label="Sub-category"
                  helperText={subCatQ.loading ? 'Loading...' : hasSubCategories ? 'Pick the sub-category this income belongs to.' : 'No INTAKE sub-categories available. Contact admin or create one under an INTAKE parent.'}
                  error={!hasSubCategories && !subCatQ.loading ? 'Create an INTAKE sub-category first' : showError('subCategoryId')}
                  required
                  placeholder={hasSubCategories ? 'Select a sub-category' : 'No INTAKE sub-categories available'}
                  options={subCategoryOptions}
                  value={subCategoryId}
                  onChange={(e) => {
                    setSubCategoryId(e.target.value)
                    setTouched((t) => ({ ...t, subCategoryId: true }))
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, subCategoryId: true }))}
                  disabled={isSubmitting || subCatQ.loading || !hasSubCategories}
                />
                {!hasSubCategories && !subCatQ.loading && (
                  <div className="flex flex-col gap-1">
                    <p className="text-caption text-text-secondary">
                      Intake transactions need sub-categories under an INTAKE parent category.
                    </p>
                    <p className="text-caption text-text-secondary">
                      <a href="/categories" className="text-brand-600 hover:underline">Go to Categories</a> to create one (only INTAKE parents will appear here).
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <p className="text-body-m font-semibold text-text-primary">
                    Payment method
                    <span className="ml-1 text-danger-500" aria-hidden="true">*</span>
                  </p>
                  <SegmentedControl
                    ariaLabel="Payment method"
                    options={PAYMENT_METHODS}
                    value={paymentMethod}
                    onChange={(v) => {
                      setPaymentMethod(v)
                      setTouched((t) => ({ ...t, paymentMethod: true }))
                    }}
                    disabled={isSubmitting}
                  />
                  {showError('paymentMethod') && (
                    <p className="text-caption text-danger-700" role="alert">
                      {allErrors.paymentMethod}
                    </p>
                  )}
                </div>

                <TextInput
                  label="Person name"
                  helperText="Defaults to the logged-in user. Edit if needed."
                  error={showError('personName')}
                  required
                  maxLength={MAX_NAME}
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, personName: true }))}
                  disabled={isSubmitting}
                />

                <Textarea
                  label="Description"
                  helperText="Optional — what was this intake for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={MAX_DESCRIPTION}
                  rows={3}
                  disabled={isSubmitting}
                />

                <DatePicker
                  label="Date"
                  helperText="Defaults to today. Cannot be in the future or older than 30 days."
                  error={showError('date')}
                  required
                  min={minDateStr}
                  max={maxDateStr}
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value)
                    setTouched((t) => ({ ...t, date: true }))
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                  disabled={isSubmitting}
                />

                <FileUpload
                  label="Receipt"
                  helperText="Optional. JPG or PNG, up to 5 MB."
                  value={receipt}
                  onChange={setReceipt}
                  disabled={isSubmitting}
                />
              </Stack>
            </Card>
          </Stack>
        </Container>
      </main>

      {/* Sticky submit area, sits above the bottom tab bar. */}
      <div
        className="sticky bottom-16 z-sticky border-t border-border bg-bg-surface"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Container variant="narrow" className="py-3">
          <Stack gap={2}>
            <PrimaryButton
              variant="intake"
              type="button"
              fullWidth
              disabled={isSubmitting}
              onClick={() => handleSubmit('save')}
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" label="Saving" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save intake</span>
              )}
            </PrimaryButton>
            <GhostButton
              type="button"
              fullWidth
              disabled={isSubmitting}
              onClick={() => handleSubmit('addAnother')}
              className="w-full"
            >
              Save &amp; add another
            </GhostButton>
          </Stack>
        </Container>
      </div>

      <BottomTabBar />
    </div>
  )
}
