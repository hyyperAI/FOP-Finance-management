// GET /api/admin/dashboard — org-wide aggregations + MoM + runningBalance.
// Per docs/backend/features/09-dashboard.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { requireAdmin } from '@/lib/auth-guards'
import { resolvePeriod } from '@/lib/period'
import {
  sumIncome,
  sumExpense,
  sumByCategory,
  sumByCategoryIntake,
  runningBalance,
  momChange,
} from '@/lib/aggregations'
import { DashboardQuerySchema } from '@/lib/validators/dashboard'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

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

    // No postedById filter — org-wide.
    const filters = { fromDate: startDate, toDate: endDate }

    const [intake, expense, allTimeBalance, expenseCategories, intakeCategories, mom] = await Promise.all([
      sumIncome(filters),
      sumExpense(filters),
      runningBalance(),
      sumByCategory(filters, 5),
      sumByCategoryIntake(filters, 5),
      momChange(filters),
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
        momChange: mom,
        runningBalance: allTimeBalance,
        topCategories: expenseCategories,
        topIntakeCategories: intakeCategories,
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/dashboard] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}