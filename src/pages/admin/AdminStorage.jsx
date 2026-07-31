// AdminStorage — wired to /api/admin/storage/stats + /api/admin/storage/prune.
// Per docs/pages/25-admin-storage.md.

import { useEffect, useState } from 'react'
import {
  Trash2, HardDrive, Files, FileCheck2, FileX2,
  CalendarClock, CalendarDays,
} from 'lucide-react'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { StatCard } from '../../components/ui/StatCard.jsx'
import { ProgressBar } from '../../components/ui/ProgressBar.jsx'
import { PrimaryButton } from '../../components/ui/PrimaryButton.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { storageStats, pruneStorage } from '../../lib/api/admin-storage.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatDateMedium } from '../../lib/format.js'

const countFmt = new Intl.NumberFormat('en-PK')

function bannerFor(percent) {
  if (percent >= 100) return { variant: 'danger',  title: 'Storage full',         role: 'alert' }
  if (percent >= 95)  return { variant: 'danger',  title: 'Storage nearly full',  role: 'alert' }
  if (percent >= 80)  return { variant: 'warning', title: 'Storage warning',      role: 'alert' }
  return null
}

function progressVariantFor(percent) {
  if (percent >= 95) return 'expense'
  if (percent >= 80) return 'info'
  return 'intake'
}

function gb(b) { return (b / (1024 * 1024 * 1024)).toFixed(2) }
function mb(b) { return Math.round(b / (1024 * 1024)) }

export default function AdminStorage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const statsQ = useQuery(() => storageStats(), [refreshKey])

  const stats = statsQ.data

  const [pruneOpen, setPruneOpen] = useState(false)
  const [pruning, setPruning] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)
  const [pruneError, setPruneError] = useState(null)
  const [pruneAlreadyRunning, setPruneAlreadyRunning] = useState(false)

  useEffect(() => {
    if (!successMsg) return undefined
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  const banner = stats ? bannerFor(stats.usagePercent) : null
  const remainingGB = stats ? Math.max(0, stats.maxBytes / (1024 ** 3) - stats.totalBytes / (1024 ** 3)) : 0

  const handleConfirmPrune = async () => {
    if (pruning) return
    setPruning(true)
    setPruneError(null)
    setPruneAlreadyRunning(false)
    try {
      const result = await pruneStorage({ dryRun: false })
      setSuccessMsg(
        `${countFmt.format(result.filesDeleted)} orphan files deleted, ${mb(result.bytesFreed)} MB freed`
      )
      setRefreshKey((k) => k + 1)
      setPruneOpen(false)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'prune_already_running') {
        setPruneAlreadyRunning(true)
      } else {
        setPruneError(err?.message || 'Couldn\u2019t prune storage.')
      }
    } finally {
      setPruning(false)
    }
  }

  const handleClosePrune = () => {
    if (pruning) return
    setPruneOpen(false)
    setPruneError(null)
    setPruneAlreadyRunning(false)
  }

  if (statsQ.error && !statsQ.loading) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
        <AdminTopBar title="Storage" />
        <main className="flex-1" aria-label="Admin storage">
          <Container variant="default" className="py-4">
            <ErrorState error={statsQ.error} onRetry={statsQ.run} />
          </Container>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page text-text-primary">
      <AdminTopBar title="Storage" />

      <main className="flex-1 pb-8" aria-label="Admin storage">
        <Container variant="default" className="py-4">
          <Stack gap={4}>
            {pruneAlreadyRunning && (
              <InlineAlert variant="warning" title="Prune already running">
                A prune is in progress on the server. Refresh in a moment to try again.
              </InlineAlert>
            )}
            {pruneError && (
              <InlineAlert variant="danger" title="Prune failed">
                {pruneError}
              </InlineAlert>
            )}
            {banner && stats && (
              <InlineAlert variant={banner.variant} role={banner.role} title={banner.title}>
                Storage at {stats.usagePercent}% ({gb(stats.totalBytes)} GB / {gb(stats.maxBytes)} GB)
              </InlineAlert>
            )}
            {successMsg && (
              <InlineAlert variant="success" role="status" title="Prune complete">
                {successMsg}
              </InlineAlert>
            )}

            {statsQ.loading && !statsQ.data ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
                <Skeleton className="h-32 w-full" />
              </>
            ) : stats && (
              <>
                <section aria-label="Storage statistics">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatCard
                      label="Total usage"
                      value={`${gb(stats.totalBytes)} GB of ${gb(stats.maxBytes)} GB`}
                      variant="neutral"
                      icon={HardDrive}
                    />
                    <StatCard
                      label="File count"
                      value={`${countFmt.format(stats.fileCount)} files`}
                      variant="info"
                      icon={Files}
                    />
                    <StatCard
                      label="Active files"
                      value={`${countFmt.format(stats.activeFileCount)} files`}
                      variant="intake"
                      icon={FileCheck2}
                    />
                    <StatCard
                      label="Orphan count"
                      value={
                        stats.orphanCount === 0
                          ? '0 files'
                          : `${countFmt.format(stats.orphanCount)} files`
                      }
                      variant={stats.orphanCount === 0 ? 'intake' : 'expense'}
                      icon={FileX2}
                    />
                    <StatCard
                      label="Oldest file"
                      value={stats.oldestFile ? formatDateMedium(stats.oldestFile) : '—'}
                      variant="neutral"
                      icon={CalendarClock}
                    />
                    <StatCard
                      label="Newest file"
                      value={stats.newestFile ? formatDateMedium(stats.newestFile) : '—'}
                      variant="neutral"
                      icon={CalendarDays}
                    />
                  </div>
                </section>

                <section aria-label="Disk capacity">
                  <Card padding="md">
                    <h2 className="mb-3 text-body-l font-semibold text-text-primary">Disk capacity</h2>
                    <ProgressBar
                      label="Disk usage"
                      value={Number(gb(stats.totalBytes))}
                      max={Number(gb(stats.maxBytes))}
                      trailing={`${gb(stats.totalBytes)} / ${gb(stats.maxBytes)} GB`}
                      variant={progressVariantFor(stats.usagePercent)}
                    />
                    <p className="mt-2 text-caption text-text-secondary">
                      {stats.usagePercent}% used — {remainingGB.toFixed(2)} GB remaining
                    </p>
                  </Card>
                </section>

                <section aria-label="Storage actions">
                  <Card padding="md">
                    <h2 className="mb-3 text-body-l font-semibold text-text-primary">Maintenance</h2>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-body-m text-text-secondary">
                        Remove orphan files that are not referenced by any active transaction.
                      </p>
                      <PrimaryButton
                        onClick={() => setPruneOpen(true)}
                        disabled={stats.orphanCount === 0 || pruning}
                        aria-label="Prune orphan files"
                        variant="expense"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        {pruning ? 'Pruning…' : 'Prune orphans'}
                      </PrimaryButton>
                    </div>
                    {stats.orphanCount === 0 && !pruning && (
                      <p className="mt-2 text-caption text-text-tertiary">
                        No orphan files. Prune is disabled.
                      </p>
                    )}
                  </Card>
                </section>
              </>
            )}
          </Stack>
        </Container>
      </main>

      <ConfirmDialog
        open={pruneOpen}
        onClose={handleClosePrune}
        onConfirm={handleConfirmPrune}
        title="Prune orphan files"
        message={
          stats && (
            <p className="text-body-m text-text-primary">
              Delete <strong>{countFmt.format(stats.orphanCount)}</strong> orphan files? They are not
              referenced by any active transaction.
            </p>
          )
        }
        confirmLabel={pruning ? 'Pruning…' : 'Delete orphans'}
        cancelLabel="Cancel"
        variant="danger"
      />
    </div>
  )
}