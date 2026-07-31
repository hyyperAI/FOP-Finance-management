// GET /api/admin/budgets — list budgets for a period (default current month)
// POST /api/admin/budgets — create a new budget
// Per docs/backend/features/15-budgets.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { parseDecimal } from '@/lib/money'
import { currentPeriodKey } from '@/lib/period'
import { CreateBudgetSchema, ListBudgetsQuerySchema } from '@/lib/validators/budget'
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
      const obj: Record<string, unknown> = {}
      for (const [key, raw] of url.searchParams) {
        obj[key] = raw
      }
      q = ListBudgetsQuerySchema.parse(obj)
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

    const period = q.period ?? currentPeriodKey()
    const budgets = await db.budget.findMany({
      where: {
        periodKey: period,
        ...(q.includeInactive ? {} : { isActive: true }),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const result = await Promise.all(
      budgets.map(async (b) => {
        const agg = await db.transaction.aggregate({
          where: {
            categoryId: b.categoryId,
            periodKey: period,
            status: 'POSTED',
            type: 'EXPENSE',
            isDeleted: false,
          },
          _sum: { amount: true },
        })
        const spend = Number(agg._sum.amount ?? 0)
        const limit = Number(b.amount)
        const percent = limit > 0 ? Math.round((spend / limit) * 100) : 0
        const warningLevel = percent >= 100 ? 'exceeded' : percent >= 80 ? 'warn' : 'none'
        return {
          id: b.id,
          categoryId: b.categoryId,
          categoryName: b.category.name,
          periodKey: b.periodKey,
          amount: b.amount.toFixed(2),
          currency: b.currency,
          currentSpend: spend.toFixed(2),
          percentUsed: percent,
          warningLevel,
          isActive: b.isActive,
          createdAt: b.createdAt.toISOString(),
        }
      }),
    )

    return withCors(NextResponse.json({ period, budgets: result }))
  } catch (err) {
    console.error('[GET /api/admin/budgets] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }

    let parsed
    try {
      parsed = CreateBudgetSchema.parse(body)
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

    // Verify category exists
    const category = await db.category.findUnique({ where: { id: parsed.categoryId } })
    if (!category) {
      return withCors(
        NextResponse.json({ error: 'category_not_found' }, { status: 404 }),
      )
    }

    try {
      const created = await db.$transaction(async (tx) => {
        const budget = await tx.budget.create({
          data: {
            categoryId: parsed.categoryId,
            periodKey: parsed.periodKey,
            amount: parseDecimal(parsed.amount),
            currency: parsed.currency,
          },
        })
        await recordAudit(tx, {
          actorId: admin.id,
          action: 'budget.create',
          entityType: 'Budget',
          entityId: budget.id,
          after: {
            categoryId: budget.categoryId,
            periodKey: budget.periodKey,
            amount: parsed.amount,
            currency: budget.currency,
          },
        })
        return budget
      })

      return withCors(
        NextResponse.json(
          {
            id: created.id,
            categoryId: created.categoryId,
            periodKey: created.periodKey,
            amount: created.amount.toFixed(2),
            currency: created.currency,
            isActive: created.isActive,
            createdAt: created.createdAt.toISOString(),
          },
          { status: 201 },
        ),
      )
    } catch (err) {
      // Prisma unique-constraint violation code
      const code = (err as { code?: string }).code
      if (code === 'P2002') {
        return withCors(
          NextResponse.json({ error: 'budget_already_exists' }, { status: 409 }),
        )
      }
      throw err
    }
  } catch (err) {
    console.error('[POST /api/admin/budgets] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
