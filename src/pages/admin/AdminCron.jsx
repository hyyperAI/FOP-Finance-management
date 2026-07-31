// AdminCron — wired to /api/admin/cron + /api/admin/cron/:jobName/run.
// Per docs/pages/26-admin-cron.md.

import { useState } from 'react'
import { CalendarClock, ChevronDown, PlayCircle, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

import { AdminTopBar } from '../../components/layout/AdminTopBar.jsx'
import { Container } from '../../components/ui/Container.jsx'
import { Stack } from '../../components/ui/Stack.jsx'
import { Card } from '../../components/ui/Card.jsx'
import { Badge } from '../../components/ui/Badge.jsx'
import { GhostButton } from '../../components/ui/GhostButton.jsx'
import { Spinner } from '../../components/ui/Spinner.jsx'
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx'
import { InlineAlert } from '../../components/ui/InlineAlert.jsx'
import { EmptyState } from '../../components/ui/EmptyState.jsx'
import { Skeleton } from '../../components/ui/Skeleton.jsx'
import { ErrorState } from '../../components/feedback/ErrorState.jsx'

import { listCronJobs, runCronJob } from '../../lib/api/admin-cron.js'
import { useQuery } from '../../lib/hooks/useApi.js'
import { ApiError } from '../../lib/api.js'
import { formatDateMedium, formatDateTime, relativeTime } from '../../lib/format.js'

const FILTER_OPTIONS = [
  { value: 'all',     label: 'All'      },
  { value: 'success', label: 'Success'  },
  { value: 'failed',  label: 'Failed'   },
  { value: 'running', label: 'Running'  },
]

function badgeVariantFor(status) {
  switch (status) {
    case 'SUCCESS': return 'intake'
    case 'FAILED':  return 'expense'
    case 'RUNNING': return 'info'
    case 'PENDING': return 'neutral'
    default:        return 'neutral'
  }
}

function statusLabel(status) {
  return status ?? 'Unknown'
}

function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return `${minutes}m ${seconds}s`
}

export default function AdminCron() {
  const [filter, setFilter] = useState('all')
  const [confirmRun, setConfirmRun] = useState(null)
  const [running, setRunning] = useState(null)
  const [runAlert, setRunAlert] = useState(null)
  const [runError, setRunError] = useState(null)
  const [expandedJob, setExpandedJob] = useState(null)

  const q = useQuery(() => listCronJobs({ limit: 100 }), [])

  const jobs = q.data?.jobs ?? []

  const filteredJobs = filter === 'all'
    ? jobs
    : jobs.filter((j) => (j.lastRun?.status ?? '').toLowerCase() === filter)

  const handleRun = async (jobName) => {
    setConfirmRun(null)
    setRunning(jobName)
    setRunAlert(null)
    setRunError(null)
    try {
      const result = await runCronJob(jobName)
      if (result.jobRun?.status === 'FAILED') {
        setRunError({ jobName, message: result.jobRun.errorMessage ?? 'Job reported failure' })
      } else {
        setRunAlert({ jobName, message: 'Job started' })
      }
      q.run()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'job_not_found') {
          setRunError({ jobName, message: 'Job not found.' })
        } else if (err.code === 'job_disabled') {
          setRunError({ jobName, message: 'Job is disabled on the server.' })
        } else if (err.code === 'job_already_running') {
          setRunError({ jobName, message: 'Job is already running on the server.' })
        } else {
          setRunError({ jobName, message: err.message ?? 'Couldn\u2019t run job.' })
        }
      } else {
        setRunError({ jobName, message: err?.message ?? 'Couldn\u2019t run job.' })
      }
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <AdminTopBar title="Cron jobs" />

      <main className="flex-1 pb-8" aria-label="Cron jobs">
        <Container variant="default" className="py-4">
          <Stack gap={4}>
            {runAlert && (
              <InlineAlert variant="success" title={`${runAlert.jobName} started`}>
                {runAlert.message}
              </InlineAlert>
            )}
            {runError && (
              <InlineAlert variant="danger" title={`${runError.jobName} failed to start`} icon={AlertTriangle}>
                {runError.message}
              </InlineAlert>
            )}

            <Card padding="md" aria-label="Filter jobs">
              <SegmentedControl
                ariaLabel="Job status filter"
                options={FILTER_OPTIONS}
                value={filter}
                onChange={setFilter}
              />
            </Card>

            {q.error && !q.loading && (
              <ErrorState error={q.error} onRetry={q.run} />
            )}

            {q.loading && !q.data ? (
              <Stack gap={3}>
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </Stack>
            ) : filteredJobs.length === 0 ? (
              <Card padding="lg">
                <EmptyState
                  icon={CalendarClock}
                  title={jobs.length === 0 ? 'No cron jobs registered' : 'No jobs match this filter'}
                  message={
                    jobs.length === 0
                      ? 'Once jobs are registered with the registry, they will appear here.'
                      : 'Switch the filter to see other jobs.'
                  }
                />
              </Card>
            ) : (
              <Stack gap={3}>
                {filteredJobs.map((job) => {
                  const isExpanded = expandedJob === job.name
                  const isRunning = running === job.name
                  const lastRun = job.lastRun ?? null

                  return (
                    <Card key={job.name} padding="md">
                      <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-body-l font-semibold text-text-primary">{job.name}</h3>
                              {job.enabled === false && (
                                <Badge variant="neutral">Disabled</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-caption text-text-tertiary">
                              <code className="font-mono">{job.file ?? job.source ?? 'unknown source'}</code>
                            </p>
                            <p className="mt-2 text-body-m text-text-secondary">
                              {job.scheduleHuman ?? job.schedule ?? 'manual / cron schedule'}
                            </p>
                          </div>
                          <div className="flex flex-row items-center gap-2">
                            {lastRun && (
                              <Badge variant={badgeVariantFor(lastRun.status)}>
                                {statusLabel(lastRun.status)}
                              </Badge>
                            )}
                            <GhostButton
                              onClick={() => setConfirmRun(job)}
                              disabled={isRunning || job.enabled === false}
                              aria-label={`Run ${job.name} now`}
                            >
                              {isRunning ? (
                                <>
                                  <Spinner size="sm" label={`Running ${job.name}`} />
                                  <span>Running…</span>
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="h-4 w-4" aria-hidden="true" />
                                  <span>Run now</span>
                                </>
                              )}
                            </GhostButton>
                          </div>
                        </div>

                        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-caption sm:grid-cols-3">
                          <dt className="text-text-tertiary">Last run</dt>
                          <dd className="text-text-primary sm:col-span-2">
                            {lastRun
                              ? <>{formatDateTime(lastRun.startedAt)} · {relativeTime(lastRun.startedAt)}</>
                              : '—'}
                          </dd>
                          <dt className="text-text-tertiary">Items processed</dt>
                          <dd className="text-text-primary sm:col-span-2">
                            {lastRun?.itemsProcessed ?? '—'}
                          </dd>
                          {lastRun?.errorMessage && (
                            <>
                              <dt className="text-danger-700">Last error</dt>
                              <dd className="text-danger-700 sm:col-span-2">{lastRun.errorMessage}</dd>
                            </>
                          )}
                        </dl>

                        {(job.recentRuns?.length ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => setExpandedJob(isExpanded ? null : job.name)}
                            aria-expanded={isExpanded}
                            className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-caption font-medium text-brand-600 hover:underline focus:outline-none focus:ring-2 focus:ring-border-focus"
                          >
                            <ChevronDown
                              className={clsx('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                              aria-hidden="true"
                            />
                            {isExpanded ? 'Hide recent runs' : `Show last ${job.recentRuns.length} runs`}
                          </button>
                        )}

                        {isExpanded && (
                          <div className="border-t border-border-subtle pt-3">
                            <ul className="flex flex-col gap-2">
                              {job.recentRuns.map((run) => (
                                <li
                                  key={run.id}
                                  className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-sunken px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
                                >
                                  <Badge variant={badgeVariantFor(run.status)}>{statusLabel(run.status)}</Badge>
                                  <span className="text-caption tabular-nums text-text-secondary">
                                    {formatDateMedium(run.startedAt)}
                                  </span>
                                  <span className="text-body-m text-text-primary">
                                    {run.itemsProcessed} items · {formatDuration(run.durationMs)}
                                  </span>
                                  {run.errorMessage && (
                                    <span className="text-caption text-danger-700">{run.errorMessage}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </Stack>
            )}
          </Stack>
        </Container>
      </main>

      <ConfirmDialog
        open={Boolean(confirmRun)}
        onClose={() => setConfirmRun(null)}
        onConfirm={() => confirmRun && handleRun(confirmRun.name)}
        title={`Run ${confirmRun?.name ?? ''} now?`}
        message={
          confirmRun
            ? `Manually trigger ${confirmRun.name}? The audit log will record the run.`
            : ''
        }
        confirmLabel={running ? 'Running…' : 'Run now'}
        cancelLabel="Cancel"
      />
    </div>
  )
}