// Transaction detail — wired to live API.
// Per docs/pages/08-transaction-detail.md. The backend doesn't yet expose
// GET /api/transactions/:id (gap B1), so we use the list endpoint with a
// pageSize=200 filter and find by id client-side. Acceptable for v1.

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil, Receipt, SearchX } from 'lucide-react'

import { PageHeader } from '../../components/layout/PageHeader.jsx'
import { BottomTabBar } from '../../components/layout/BottomTabBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { AmountDisplay } from '../../components/ui/AmountDisplay.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { KeyValueRow } from '../../components/ui/KeyValueRow.jsx'
import { IconButton } from '../../components/ui/IconButton.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { Modal } from '../../components/ui/Modal.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { listTransactions } from '../../lib/api/transactions.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { formatPKR, formatDateMedium, formatDateTime } from '../../lib/format.js'

// Receipt images are served from the same origin via the Vite proxy,
// so a relative path works in both dev and prod.
export default function TransactionDetail() {
  const { id } = useParams()
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Gap workaround: list-and-find. Replace with GET /api/transactions/:id
  // once backend gap B1 is closed.
  const q = useQuery(
    () => listTransactions({ page: 1, pageSize: 200 }),
    [],
  )

  if (q.loading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <PageHeader title="Back" />
        <main className="flex-1 px-4 py-6 sm:px-6" aria-label="Transaction detail">
          <Stack gap={4}>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </Stack>
        </main>
        <BottomTabBar />
      </div>
    )
  }

  if (q.error) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <PageHeader title="Back" />
        <main className="flex-1 px-4 py-6 sm:px-6" aria-label="Transaction detail">
          <ErrorState error={q.error} onRetry={q.run} />
        </main>
        <BottomTabBar />
      </div>
    )
  }

  const tx = q.data?.transactions?.find((t) => t.id === id)

  if (!tx) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <PageHeader title="Back" />
        <Container variant="narrow" className="flex-1 py-6">
          <EmptyState
            icon={SearchX}
            title="Transaction not found"
            message="This transaction does not exist or has been deleted."
          />
          <div className="mt-6 flex justify-center">
            <Link
              to="/transactions"
              className="text-body-m font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus rounded-md"
            >
              ← Back to transactions
            </Link>
          </div>
        </Container>
        <BottomTabBar />
      </div>
    )
  }

  const kindVariant = tx.type.toLowerCase() // 'intake' | 'expense'
  const signedAmount = tx.type === 'INTAKE' ? Number(tx.amount) : -Number(tx.amount)
  const receiptUrl = tx.receiptUrl
    ? `/api/receipt/${encodeURIComponent(tx.receiptUrl)}`
    : null

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <PageHeader
        title="Back"
        rightAction={
          <Link
            to={`/transactions/${id}/edit`}
            aria-label="Edit transaction"
            className="inline-flex"
          >
            <IconButton aria-label="Edit transaction">
              <Pencil className="h-5 w-5" aria-hidden="true" />
            </IconButton>
          </Link>
        }
      />

      <main className="flex-1" aria-label="Transaction detail">
        <Container variant="narrow" className="py-4 sm:py-6">
          <Stack gap={4}>
            {/* Hero card */}
            <Card padding="lg" className="sm:mx-auto sm:max-w-[600px]">
              <Stack gap={3}>
                <Badge variant={kindVariant}>{tx.type}</Badge>
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
              <dl className="divide-y divide-border-subtle">
                <div className="px-1">
                  <KeyValueRow label="Amount" value={formatPKR(tx.amount)} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Date" value={formatDateMedium(tx.occurredAt)} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Category" value={tx.category?.name ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Sub-category" value={tx.subCategory?.name ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Payment method" value={tx.paymentMethod} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Vendor" value={tx.vendor ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Description" value={tx.description ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow label="Notes" value={tx.notes ?? '—'} />
                </div>
                <div className="px-1">
                  <KeyValueRow
                    label="Posted by"
                    value={tx.postedBy?.name ?? tx.postedBy?.username ?? '—'}
                  />
                </div>
                <div className="px-1">
                  <KeyValueRow
                    label="Created at"
                    value={formatDateTime(tx.createdAt)}
                  />
                </div>
                {tx.version > 1 && (
                  <div className="px-1">
                    <KeyValueRow
                      label="Version"
                      value={`v${tx.version} (edited)`}
                    />
                  </div>
                )}
              </dl>
            </Card>

            {/* Receipt section */}
            <Card padding="md">
              <Stack gap={3}>
                <h2 className="text-h4 font-semibold text-text-primary">Receipt</h2>
                {receiptUrl ? (
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    aria-label="View receipt"
                    className="block w-full overflow-hidden rounded-md border border-border transition-transform hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-border-focus"
                  >
                    <img
                      src={receiptUrl}
                      alt="Receipt"
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ) : (
                  <p className="text-body-m text-text-tertiary">
                    No receipt attached.
                  </p>
                )}
              </Stack>
            </Card>

            {/* Footer action */}
            <Link to={`/transactions/${id}/edit`} className="block">
              <PrimaryButton variant="primary" fullWidth>
                Edit transaction
              </PrimaryButton>
            </Link>
          </Stack>
        </Container>
      </main>

      <Modal
        open={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        title="Receipt"
        size="lg"
      >
        {receiptUrl ? (
          <img
            src={receiptUrl}
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

      <BottomTabBar />
    </div>
  )
}