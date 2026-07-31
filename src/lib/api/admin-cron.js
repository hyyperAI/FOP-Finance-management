/**
 * Admin — cron/job-run helpers.
 * API contract: docs/backend/api.md §17 Admin — Cron.
 */

import { get, post } from '../api.js'

/**
 * GET /api/admin/cron
 *
 * @param {Object} [params]
 * @param {number} [params.limit=50]  1-200
 * @param {string}  [params.since]     ISO datetime, default = now - 7 days
 *
 * @returns {Promise<{ jobs: CronJob[] }>}
 *
 * Each job includes recentRuns[].status: 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING'
 */
export function listCronJobs(params = {}) {
  const p = new URLSearchParams()
  if (params.limit != null) p.set('limit', String(params.limit))
  if (params.since)           p.set('since', params.since)
  const qs = p.toString()
  return get(`/api/admin/cron${qs ? `?${qs}` : ''}`)
}

/**
 * POST /api/admin/cron/:jobName/run
 *
 * @param {string} jobName
 * @returns {Promise<{ jobRun: JobRun }>}
 *
 * Throws ApiError with code:
 *   'job_not_found'     (404)
 *   'job_disabled'      (409)
 *   'job_already_running' (409)
 *   'HTTP 503'          (job ran but status === 'FAILED')
 */
export function runCronJob(jobName) {
  return post(`/api/admin/cron/${encodeURIComponent(jobName)}/run`)
}
