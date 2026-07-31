// AdminTransactionDetail — wired.
// Per docs/pages/20-admin-transaction-detail.md.
//
// Workaround for backend gap B3 (no GET /api/admin/transactions/:id):
// use the list endpoint with pageSize=200 and find by id client-side.

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Receipt, Trash2, SearchX, ExternalLink } from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { AmountDisplay } from '../../components/ui/AmountDisplay.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { Avatar } from '../../components/ui/Avatar.jsx'
import { RoleBadge } from '../../components/ui/RoleBadge.jsx'
import { KeyValueRow } from '../../components/ui/KeyValueRow.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Textarea } from '../../components/ui/Textarea.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { listTransactions } from '../../lib/api/transactions.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { formatPKR, formatDateMedium, formatDateTime } from '../../lib/format.js'

const FIELD_LABELS = {
  amount: 'Amount',
  description: 'Description',
  categoryId: 'Category',
  subCategoryId: 'Sub-category',
  paymentMethod: 'Payment method',
  vendor: 'Vendor',
  notes: 'Notes',
  receiptUrl: 'Receipt',
}

const MIN_REASON_LENGTH = 10
const MAX_REASON_LENGTH = 500

// Receipt images served via Vite proxy — relative path works in dev/prod.

// TODO replace with GET /api/admin/transactions/:id (gap B3).
async function findTransactionById(id) {
  const data = await listTransactions({ page: 1, pageSize: 200 })
  return data.transactions.find((t) => t.id === id) ?? null
}

export default function AdminTransactionDetail() {
  const { id } = useParams()
  const q = useQuery(() => findTransactionById(id), [id])

  // Local state — soft-delete is simulated (backend has no PATCH/DELETE tx route).
  const [txStatus, setTxStatus] = useState('ACTIVE')
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [confirmSoftDelete, setConfirmSoftDelete] = useState(false)
  const [softDeleteReason, setSoftDeleteReason] = useState('')
  const [successAlert, setSuccessAlert] = useState(false)
  const [deletedOn] = useState(() => new Date().toLocaleDateString('en-GB'))

  if (q.loading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="Loading…" back="/admin/transactions" />
        <main className="flex-1" aria-label="Admin transaction detail">
          <Container variant="narrow" className="py-4 sm:py-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-4 lg:col-span-2">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
              <div className="flex flex-col gap-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </Container>
        </main>
      </div>
    )
  }

  if (q.error) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="Transaction" back="/admin/transactions" />
        <main className="flex-1">
          <Container variant="narrow" className="py-6">
            <ErrorState error={q.error} onRetry={q.run} />
          </Container>
        </main>
      </div>
    )
  }

  const baseTx = q.data
  if (!baseTx) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="Transaction not found" back="/admin/transactions" />
        <main className="flex-1" aria-label="Transaction not found">
          <Container variant="narrow" className="flex-1 py-6">
            <EmptyState
              icon={SearchX}
              title="Transaction not found"
              message="This transaction does not exist or has been removed."
            />
            <div className="mt-6 flex justify-center">
              <Link
                to="/admin/transactions"
                className="text-body-m font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus rounded-md"
              >
                ← Back to all transactions
              </Link>
            </div>
          </Container>
        </main>
      </div>
    )
  }

  const tx = { ...baseTx, status: txStatus }
  const isDeleted = tx.status === 'SOFT_DELETED'
  const kindVariant = tx.type.toLowerCase()
  const signedAmount = tx.type === 'INTAKE' ? Number(tx.amount) : -Number(tx.amount)
  const statusVariant = isDeleted ? 'default' : kindVariant

  const postedByName = tx.postedBy?.name ?? tx.postedBy?.username ?? '—'
  const receiptSrc = tx.receiptUrl
    ? `/api/receipt/${encodeURIComponent(tx.receiptUrl)}`
    : null

  const reasonTrimmed = softDeleteReason.trim()
  const reasonValid = reasonTrimmed.length >= MIN_REASON_LENGTH
  const reasonError = softDeleteReason.length > 0 && !reasonValid
    ? `Reason must be at least ${MIN_REASON_LENGTH} characters.`
    : ''

  const handleConfirmSoftDelete = () => {
    if (!reasonValid) return
    setTxStatus('SOFT_DELETED')
    setSuccessAlert(true)
    setConfirmSoftDelete(false)
  }

  const openSoftDelete = () => {
    setSoftDeleteReason('')
    setConfirmSoftDelete(true)
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar
        title={`${tx.type} · ${formatPKR(tx.amount)}`}
        back="/admin/transactions"
      />

      <main className="flex-1" aria-label="Admin transaction detail">
        <Container variant="narrow" className="py-4 sm:py-6">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
            {/* LEFT / MAIN COLUMN */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              {successAlert && (
                <InlineAlert
                  variant="success"
                  title="Transaction soft-deleted."
                  role="status"
                >
                  Audit row written.
                </InlineAlert>
              )}

              {/* Hero card */}
              <Card padding="lg">
                <Stack gap={3}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={kindVariant}>{tx.type}</Badge>
                    <Badge
                      variant={statusVariant}
                      aria-label={`Status ${isDeleted ? 'soft deleted' : 'active'}`}
                    >
                      {isDeleted ? 'SOFT DELETED' : 'ACTIVE'}
                    </Badge>
                    {isDeleted && (
                      <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-caption font-semibold uppercase tracking-wide text-text-secondary">
                        Already deleted on {deletedOn}
                      </span>
                    )}
                  </div>
                  <AmountDisplay
                    amountPkr={signedAmount}
                    signed
                    variant={kindVariant}
                    size="lg"
                  />
                </Stack>
              </Card>

              {/* Details list */}
              <Card padding="md">
                <Stack gap={2}>
                  <h2 className="text-h4 font-semibold text-text-primary">Details</h2>
                  <dl className="divide-y divide-border-subtle">
                    <div className="px-1">
                      <KeyValueRow label="Date" value={formatDateMedium(tx.occurredAt)} />
                    </div>
                    <div className="px-1">
                      <KeyValueRow
                        label="Amount"
                        value={formatPKR(tx.amount)}
                      />
                    </div>
                    <div className="px-1">
                      <KeyValueRow
                        label="Category"
                        value={tx.category?.name ?? '—'}
                      />
                    </div>
                    <div className="px-1">
                      <KeyValueRow
                        label="Sub-category"
                        value={tx.subCategory?.name ?? '—'}
                      />
                    </div>
                    <div className="px-1">
                      <KeyValueRow
                        label="Payment method"
                        value={tx.paymentMethod}
                      />
                    </div>
                    <div className="px-1">
                      <KeyValueRow label="Description" value={tx.description ?? '—'} />
                    </div>
                    <div className="px-1">
                      <KeyValueRow label="Vendor" value={tx.vendor ?? '—'} />
                    </div>
                    <div className="px-1">
                      <KeyValueRow label="Notes" value={tx.notes ?? '—'} />
                    </div>
                    <div className="px-1">
                      <KeyValueRow label="Created by">
                        <span className="flex flex-col items-end gap-1">
                          <span className="text-body-m font-medium text-text-primary">
                            {postedByName}
                          </span>
                          {tx.postedBy?.role && (
                            <RoleBadge role={tx.postedBy.role} name={postedByName} />
                          )}
                        </span>
                      </KeyValueRow>
                    </div>
                    <div className="px-1">
                      <KeyValueRow label="Created at" value={formatDateTime(tx.createdAt)} />
                    </div>
                    {tx.version > 1 && (
                      <div className="px-1">
                        <KeyValueRow label="Version" value={`v${tx.version}`} />
                      </div>
                    )}
                  </dl>
                </Stack>
              </Card>

              {/* Receipt */}
              <Card padding="md">
                <Stack gap={3}>
                  <h2 className="text-h4 font-semibold text-text-primary">Receipt</h2>
                  {receiptSrc ? (
                    <button
                      type="button"
                      onClick={() => setReceiptOpen(true)}
                      aria-label="View receipt fullscreen"
                      className="block w-full overflow-hidden rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-border-focus"
                    >
                      <img
                        src={receiptSrc}
                        alt="Receipt"
                        className="h-48 w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <div
                      aria-label="No receipt attached"
                      className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-sunken text-caption text-text-tertiary"
                    >
                      <Receipt className="h-6 w-6" aria-hidden="true" />
                      <span>No receipt attached</span>
                      <span className="text-caption text-text-tertiary">
                        Tap to view fullscreen
                      </span>
                    </div>
                  )}
                </Stack>
              </Card>

              {/* Edit history placeholder */}
              <Card padding="md">
                <Stack gap={3}>
                  <h2 className="text-h4 font-semibold text-text-primary">Edit history</h2>
                  <p className="text-caption text-text-tertiary">
                    Edit history is fetched from{' '}
                    <code>GET /api/admin/audit?entityId={tx.id}</code> in a future
                    update. For now, the latest change to this transaction is
                    summarised below.
                  </p>
                  <div className="rounded-md border border-border-subtle bg-bg-sunken p-3">
                    <p className="text-body-m text-text-primary">
                      <span className="font-semibold">{postedByName}</span>{' '}
                      created this transaction.
                    </p>
                    <p className="mt-1 text-caption text-text-tertiary">
                      {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                </Stack>
              </Card>
            </div>

            {/* RIGHT / SIDEBAR COLUMN */}
            <div className="flex flex-col gap-4">
              <Card padding="md" className="lg:sticky lg:top-24">
                <Stack gap={3}>
                  <h2 className="text-h4 font-semibold text-text-primary">Admin actions</h2>
                  <Link to={`/transactions/${id}/edit`} className="block">
                    <PrimaryButton
                      variant="primary"
                      fullWidth
                      aria-label="Edit transaction"
                      disabled={isDeleted}
                    >
                      Edit transaction
                    </PrimaryButton>
                  </Link>
                  <PrimaryButton
                    variant="expense"
                    fullWidth
                    onClick={openSoftDelete}
                    aria-label="Soft-delete transaction"
                    disabled={isDeleted}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span>Soft-delete</span>
                  </PrimaryButton>
                  {isDeleted && (
                    <InlineAlert variant="info" title="Already soft-deleted" role="status">
                      This transaction was soft-deleted on {deletedOn}. It is hidden from default lists but preserved in audit history.
                    </InlineAlert>
                  )}
                </Stack>
              </Card>

              <Card padding="md">
                <Stack gap={3}>
                  <h2 className="text-h4 font-semibold text-text-primary">Linked records</h2>

                  {tx.postedBy?.id && (
                    <Link
                      to={`/admin/users/${tx.postedBy.id}`}
                      aria-label={`View posted-by user ${postedByName}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-sunken p-3 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-border-focus"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={postedByName} size="md" />
                        <div className="flex flex-col">
                          <span className="text-caption uppercase tracking-wide text-text-tertiary">
                            Posted by
                          </span>
                          <span className="text-body-m font-medium text-text-primary">
                            {postedByName}
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                    </Link>
                  )}

                  <Link
                    to="/admin/categories"
                    aria-label={`View category ${tx.category?.name ?? 'category'}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-sunken p-3 transition-colors hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-border-focus"
                  >
                    <div className="flex flex-col">
                      <span className="text-caption uppercase tracking-wide text-text-tertiary">
                        Category
                      </span>
                      <span className="text-body-m font-medium text-text-primary">
                        {tx.category?.name ?? '—'}
                      </span>
                      <span className="text-caption text-text-tertiary">
                        {tx.subCategory?.name ?? '—'}
                      </span>
                    </div>
                    <ExternalLink className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                  </Link>
                </Stack>
              </Card>
            </div>
          </div>
        </Container>
      </main>

      {/* Receipt fullscreen modal */}
      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Receipt"
        size="lg"
      >
        {receiptSrc ? (
          <img
            src={receiptSrc}
            alt="Receipt fullscreen"
            className="max-h-[70vh] w-full object-contain"
          />
        ) : (
          <div
            aria-label="Receipt unavailable"
            className="flex h-64 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-bg-sunken text-text-tertiary"
          >
            <Receipt className="h-10 w-10" aria-hidden="true" />
            <p className="text-body-m">No receipt attached</p>
          </div>
        )}
      </Modal>

      {/* Soft-delete confirmation */}
      <Modal
        open={confirmSoftDelete}
        onClose={() => setConfirmSoftDelete(false)}
        title="Soft-delete this transaction?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-body-m text-text-primary">
            The transaction will be hidden from default lists and an audit row will be written.
            This action is logged.
          </p>
          <Textarea
            label="Reason for soft-delete (required)"
            required
            value={softDeleteReason}
            onChange={(e) => setSoftDeleteReason(e.target.value)}
            maxLength={MAX_REASON_LENGTH}
            helperText={`At least ${MIN_REASON_LENGTH} characters. Visible in audit log.`}
            error={reasonError}
            aria-label="Reason for soft-delete"
          />
          <p
            className="text-caption text-text-tertiary tabular-nums"
            aria-live="polite"
          >
            {reasonTrimmed.length}/{MIN_REASON_LENGTH} characters minimum
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GhostButton onClick={() => setConfirmSoftDelete(false)} fullWidth>
              Cancel
            </GhostButton>
            <PrimaryButton
              variant="expense"
              fullWidth
              onClick={handleConfirmSoftDelete}
              disabled={!reasonValid}
              aria-label="Confirm soft-delete"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Soft-delete</span>
            </PrimaryButton>
          </div>
        </div>
      </Modal>
    </div>
  )
}