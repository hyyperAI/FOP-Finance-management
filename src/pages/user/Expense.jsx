// Static UI — no real submit. Mocked per docs/pages/06-expense-new.md §13.
// Form for creating an EXPENSE transaction. Title is REQUIRED (Feature 3 lock).
// All other fields, validation, and behavior mirror the intake form except:
//   - Submit button variant = "expense" (red)
//   - "Add another" submits and clears (stays on form)

import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { NumberInput } from '../../components/ui/NumberInput.jsx'
import { TextInput } from '../../components/ui/TextInput.jsx'
import { SelectDropdown } from '../../components/ui/SelectDropdown.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { DatePicker } from '../../components/ui/DatePicker.jsx'
import { FileUpload } from '../../components/ui/FileUpload.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { FormError } from '../../components/ui/FormError.jsx'
import { PAYMENT_METHODS } from '../../lib/fixtures/payment-methods.js'  // Phase J — extracted static UI enum from mock-data.js

import { useAuth } from '../../lib/auth.jsx'
import { useQuery } from '../../lib/hooks/useApi.js'
import { listSubCategories, listUserCategories } from '../../lib/api/categories.js'
import { createTransaction } from '../../lib/api/transactions.js'
import { uploadReceipt } from '../../lib/api/receipts.js'

// Date helpers — derived once per render from local "today".
function todayIso() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - days)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const TITLE_MAX = 100
const DESCRIPTION_MAX = 500

function validate(values) {
  const errors = {}

  // Amount: required, > 0, ≤ 2 decimals
  const raw = String(values.amount ?? '').trim()
  if (!raw) {
    errors.amount = 'Amount is required'
  } else {
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      errors.amount = 'Enter a valid number'
    } else if (n <= 0) {
      errors.amount = 'Amount must be greater than 0'
    } else {
      const [, dec = ''] = raw.split('.')
      if (dec.length > 2) {
        errors.amount = 'At most 2 decimal places'
      }
    }
  }

  // Title: REQUIRED for expenses
  const title = (values.title ?? '').trim()
  if (!title) {
    errors.title = 'Title is required for expenses'
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title must be ${TITLE_MAX} characters or fewer`
  }

  // Sub-category
  if (!values.subCategoryId) {
    errors.subCategoryId = 'Sub-category is required'
  }

  // Payment method
  if (!values.paymentMethod) {
    errors.paymentMethod = 'Payment method is required'
  }

  // Person name
  if (!values.personName?.trim()) {
    errors.personName = 'Person name is required'
  }

  // Date: not future, not older than 30 days
  if (!values.date) {
    errors.date = 'Date is required'
  } else {
    const today = todayIso()
    const minDate = isoMinusDays(today, 30)
    if (values.date > today) {
      errors.date = 'Date cannot be in the future'
    } else if (values.date < minDate) {
      errors.date = 'Date cannot be more than 30 days ago'
    }
  }

  return errors
}

export default function Expense() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const amountRef = useRef(null)

  // Live sub-category list (user's own active sub-categories).
  // Until backend ships `GET /api/categories` (gap B2), we load the user's
  // full sub-cat list and resolve categoryId from the parent.
  const subCatQ = useQuery(
    () => listSubCategories({ mine: true, isActive: true }),
    [],
  )

  // User's assigned parent categories
  const parentCatQ = useQuery(() => listUserCategories(), [])

  const subCategoryOptions = useMemo(() => {
    const live = subCatQ.data?.subCategories ?? []
    if (live.length > 0) {
      // Filter by parent type matching this transaction type (EXPENSE)
      // AND the user is assigned to that parent category.
      return live
        .filter((s) => {
          const parents = parentCatQ.data?.categories ?? []
          const isAssigned = parents.some((p) => p.id === s.parentId)
          return s.parent?.type === 'EXPENSE' && isAssigned
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

  // Shared save routine (real network call).
  // Returns true on success, false on failure (caller decides nav vs retry).
  const performSave = async (vals) => {
    let receiptUrl
    // FileUpload stores { name, size, previewUrl } - fetch blob and re-create File for upload
    if (vals.receipt?.previewUrl) {
      const response = await fetch(vals.receipt.previewUrl)
      const blob = await response.blob()
      const file = new File([blob], vals.receipt.name, { type: blob.type })
      const { key } = await uploadReceipt(file)
      receiptUrl = key
    }

    // Resolve categoryId from the lookup map.
    const categoryId = subCategoryLookup.get(vals.subCategoryId)
    if (!categoryId) {
      // No sub-categories available
      throw new Error('No sub-categories available. Please create a sub-category first in the Categories page.')
    }

    await createTransaction({
      type: 'EXPENSE',
      amount: vals.amount,
      vendor: vals.personName || undefined,
      description: vals.description || vals.title || undefined,
      paymentMethod: vals.paymentMethod,
      occurredAt: new Date(`${vals.date}T00:00:00`).toISOString(),
      categoryId,
      subCategoryId: vals.subCategoryId,
      receiptUrl,
    })
  }

  const today = useMemo(() => todayIso(), [])
  const minDate = useMemo(() => isoMinusDays(today, 30), [today])

  const [values, setValues] = useState({
    amount: '',
    title: '',
    subCategoryId: '',
    paymentMethod: 'CASH',
    personName: user?.name || user?.username || '',
    description: '',
    date: today,
    receipt: null,
  })

  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const setField = (field) => (eOrValue) => {
    const value = eOrValue?.target ? eOrValue.target.value : eOrValue
    setValues((prev) => ({ ...prev, [field]: value }))
    // Clear field-level error as user edits
    setErrors((prev) => {
      if (!prev[field]) return prev
      const { [field]: _omit, ...rest } = prev
      return rest
    })
    setSuccessMsg('')
  }

  const setReceipt = (value) => {
    setValues((prev) => ({ ...prev, receipt: value }))
    setSuccessMsg('')
  }

  const runMockSubmit = () => {
    const v = validate(values)
    setErrors(v)
    if (Object.keys(v).length > 0) {
      // Move focus to first invalid field for accessibility
      const order = ['amount', 'title', 'subCategoryId', 'paymentMethod', 'personName', 'date']
      const firstInvalid = order.find((k) => v[k])
      if (firstInvalid === 'amount') amountRef.current?.focus()
      return
    }
    setSubmitting(true)
    setSuccessMsg('')
    // Mocked save per §13
    window.setTimeout(() => {
      setSubmitting(false)
      // 1) navigate home (Save expense)
      // 2) clear form (Add another) — caller decides
      return undefined
    }, 800)
  }

  const handleSave = async () => {
    const v = validate(values)
    if (Object.keys(v).length > 0) {
      setErrors(v)
      const order = ['amount', 'title', 'subCategoryId', 'paymentMethod', 'personName', 'date']
      const firstInvalid = order.find((k) => v[k])
      if (firstInvalid === 'amount') amountRef.current?.focus()
      return
    }
    setSubmitting(true)
    setSuccessMsg('')
    try {
      await performSave(values)
      setSuccessMsg('Expense saved')
      navigate('/')
    } catch (err) {
      console.error('Save expense failed:', err)
      setErrors({ _form: err?.message || 'Couldn\u2019t save expense. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddAnother = async () => {
    const v = validate(values)
    if (Object.keys(v).length > 0) {
      setErrors(v)
      const order = ['amount', 'title', 'subCategoryId', 'paymentMethod', 'personName', 'date']
      const firstInvalid = order.find((k) => v[k])
      if (firstInvalid === 'amount') amountRef.current?.focus()
      return
    }
    setSubmitting(true)
    setSuccessMsg('')
    try {
      await performSave(values)
      setSuccessMsg('Expense saved — add another')
      // Clear form and refocus amount for next entry
      setValues({
        amount: '',
        title: '',
        subCategoryId: '',
        paymentMethod: 'CASH',
        personName: user?.name || user?.username || '',
        description: '',
        date: today,
        receipt: null,
      })
      setErrors({})
      amountRef.current?.focus()
    } catch (err) {
      console.error('Save expense failed:', err)
      setErrors({ _form: err?.message || 'Couldn\u2019t save expense. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader title="Expense" />

      <main aria-label="Expense form" className="flex-1 pb-32">
        <Container variant="narrow" className="py-6">
          <Stack gap={6} as="form" onSubmit={(e) => e.preventDefault()}>
            {Object.keys(errors).length > 0 && (
              <FormError
                title="Please fix the errors below"
                message={`${Object.keys(errors).length} field${Object.keys(errors).length > 1 ? 's' : ''} need attention`}
              />
            )}

            {successMsg && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-lg border border-success-500 bg-success-50 p-3 text-success-700"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                <span className="text-body-m font-medium">{successMsg}</span>
              </div>
            )}

            <Card>
              <Stack gap={5}>
                {/* 1. Amount (PKR) */}
                <NumberInput
                  ref={amountRef}
                  label="Amount (PKR)"
                  required
                  autoFocus
                  inputMode="decimal"
                  placeholder="0.00"
                  value={values.amount}
                  onChange={setField('amount')}
                  error={errors.amount}
                />

                {/* 2. Title — REQUIRED for expenses (Feature 3 lock) */}
                <TextInput
                  label="Title"
                  required
                  maxLength={TITLE_MAX}
                  placeholder="e.g. Uber to client meeting"
                  value={values.title}
                  onChange={setField('title')}
                  error={errors.title}
                  helperText="A short description of this expense"
                />

                {/* 3. Sub-category */}
                <SelectDropdown
                  label="Sub-category"
                  required
                  helperText={subCatQ.loading ? 'Loading...' : hasSubCategories ? undefined : undefined}
                  error={!hasSubCategories && !subCatQ.loading ? 'Create a sub-category first' : errors.subCategoryId}
                  options={subCategoryOptions}
                  value={values.subCategoryId}
                  onChange={setField('subCategoryId')}
                  placeholder={hasSubCategories ? 'Select a sub-category' : 'No sub-categories available'}
                  disabled={submitting || subCatQ.loading || !hasSubCategories}
                />
                {!hasSubCategories && !subCatQ.loading && (
                  <p className="text-caption text-text-secondary">
                    <a href="/categories" className="text-brand-600 hover:underline">Go to Categories</a> to create a sub-category first.
                  </p>
                )}

                {/* 4. Payment method */}
                <div className="flex flex-col gap-2">
                  <span className="text-body-m font-semibold text-text-primary">
                    Payment method<span className="ml-1 text-danger-500" aria-hidden="true">*</span>
                  </span>
                  <SegmentedControl
                    ariaLabel="Payment method"
                    options={PAYMENT_METHODS}
                    value={values.paymentMethod}
                    onChange={(v) => setField('paymentMethod')(v)}
                  />
                  {errors.paymentMethod && (
                    <p className="text-caption text-danger-700" role="alert">
                      {errors.paymentMethod}
                    </p>
                  )}
                </div>

                {/* 5. Person name */}
                <TextInput
                  label="Person name"
                  required
                  value={values.personName}
                  onChange={setField('personName')}
                  error={errors.personName}
                />

                {/* 6. Description */}
                <Textarea
                  label="Description"
                  maxLength={DESCRIPTION_MAX}
                  value={values.description}
                  onChange={setField('description')}
                  helperText="Optional notes"
                  placeholder="Add any extra detail"
                />

                {/* 7. Date */}
                <DatePicker
                  label="Date"
                  required
                  min={minDate}
                  max={today}
                  value={values.date}
                  onChange={setField('date')}
                  error={errors.date}
                />

                {/* 8. Receipt upload */}
                <FileUpload
                  label="Receipt"
                  value={values.receipt}
                  onChange={setReceipt}
                  helperText="Optional — JPG or PNG, max 5 MB"
                />
              </Stack>
            </Card>
          </Stack>
        </Container>
      </main>

      {/* Sticky submit area at bottom */}
      <div
        className="sticky bottom-0 z-sticky border-t border-border bg-bg-surface px-4 py-3 shadow-card sm:px-6"
      >
        <Container variant="narrow">
          <Stack gap={2}>
            <PrimaryButton
              type="button"
              variant="expense"
              fullWidth
              disabled={submitting}
              onClick={handleSave}
              aria-label="Save expense"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" label="Saving" />
                  <span>Saving…</span>
                </>
              ) : (
                <span>Save expense</span>
              )}
            </PrimaryButton>
            <GhostButton
              type="button"
              fullWidth
              disabled={submitting}
              onClick={handleAddAnother}
              aria-label="Save and add another expense"
              className="border border-danger-500 text-danger-600 hover:bg-danger-50"
            >
              Add another
            </GhostButton>
          </Stack>
        </Container>
      </div>
    </div>
  )
}
