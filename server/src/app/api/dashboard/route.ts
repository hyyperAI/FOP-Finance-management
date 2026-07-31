// GET /api/dashboard — user/admin self-scoped aggregations.
// Per docs/backend/features/09-dashboard.md § 1.2.
//
// Scope: USER → own transactions only. ADMIN → own (since this is the
// personal dashboard). For org-wide, use /api/admin/dashboard.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth-guards'
import { resolvePeriod } from '@/lib/period'
import { sumIncome, sumExpense, sumByCategory } from '@/lib/aggregations'
import { DashboardQuerySchema } from '@/lib/validators/dashboard'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    const url = new URL(req.url)
    let q
    try {
      q = DashboardQuerySchema.parse({
        period: url.searchParams.get('period') ?? undefined,
        startDate: url.searchParams.get('startDate') ?? undefined,
        endDate: url.searchParams.get('endDate') ?? undefined,
      })
    } catch (err) {
      if (err instanceof ZodError) {
        return withCors(
          NextResponse.json(
            { error: 'validation_error', fields: err.flatten().fieldErrors },
            { status: 400 },
          ),
        )
      }
      throw err
    }

    const { startDate, endDate } = resolvePeriod(
      q.period,
      q.startDate ?? null,
      q.endDate ?? null,
    )

    const filters = {
      postedById: user.id,
      fromDate: startDate,
      toDate: endDate,
    }

    const [intake, expense, topCategories, recentCloses] = await Promise.all([
      sumIncome(filters),
      sumExpense(filters),
      sumByCategory(filters, 5),
      db.dayClose.findMany({
        where: {
          userId: user.id,
          closeDate: { gte: startDate, lte: endDate },
        },
        orderBy: { closeDate: 'desc' },
        take: 5,
      }),
    ])

    return withCors(
      NextResponse.json({
        period: q.period,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
        summary: {
          intake,
          expense,
          net: round2(intake - expense),
        },
        topCategories,
        recentCloses: recentCloses.map(serializeClose),
      }),
    )
  } catch (err) {
    console.error('[GET /api/dashboard] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function serializeClose(dc: {
  id: string
  closeDate: Date
  totalVariance: { toString: () => string }
  hasVariance: boolean
}) {
  return {
    id: dc.id,
    closeDate: dc.closeDate.toISOString().slice(0, 10),
    totalVariance: dc.totalVariance.toString(),
    hasVariance: dc.hasVariance,
    status: dc.hasVariance ? 'CLOSED_WITH_VARIANCE' : 'CLOSED_OK',
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}