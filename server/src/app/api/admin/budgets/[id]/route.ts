// GET /api/admin/budgets/[id] — single budget with computed currentSpend
// PATCH /api/admin/budgets/[id] — update amount and/or isActive
// DELETE /api/admin/budgets/[id] — soft delete (isActive=false)
// Per docs/backend/features/15-budgets.md § 1.2.

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { parseDecimal } from '@/lib/money'
import { UpdateBudgetSchema } from '@/lib/validators/budget'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

function serialize(b: {
  id: string
  categoryId: string
  periodKey: string
  amount: { toFixed: (n: number) => string }
  currency: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: b.id,
    categoryId: b.categoryId,
    periodKey: b.periodKey,
    amount: b.amount.toFixed(2),
    currency: b.currency,
    isActive: b.isActive,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const budget = await db.budget.findUnique({
      where: { id: params.id },
      include: { category: { select: { id: true, name: true } } },
    })
    if (!budget) {
      return withCors(NextResponse.json({ error: 'budget_not_found' }, { status: 404 }))
    }

    const agg = await db.transaction.aggregate({
      where: {
        categoryId: budget.categoryId,
        periodKey: budget.periodKey,
        status: 'POSTED',
        type: 'EXPENSE',
        isDeleted: false,
      },
      _sum: { amount: true },
    })
    const spend = Number(agg._sum.amount ?? 0)
    const limit = Number(budget.amount)
    const percent = limit > 0 ? Math.round((spend / limit) * 100) : 0
    const warningLevel = percent >= 100 ? 'exceeded' : percent >= 80 ? 'warn' : 'none'

    return withCors(
      NextResponse.json({
        ...serialize(budget),
        categoryName: budget.category.name,
        currentSpend: spend.toFixed(2),
        percentUsed: percent,
        warningLevel,
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/budgets/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
      parsed = UpdateBudgetSchema.parse(body)
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

    const updated = await db.$transaction(async (tx) => {
      const before = await tx.budget.findUnique({ where: { id: params.id } })
      if (!before) {
        throw new HttpError(404, 'budget_not_found')
      }
      const data: { amount?: ReturnType<typeof parseDecimal>; isActive?: boolean } = {}
      if (parsed.amount !== undefined) data.amount = parseDecimal(parsed.amount)
      if (parsed.isActive !== undefined) data.isActive = parsed.isActive

      const after = await tx.budget.update({ where: { id: params.id }, data })

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'budget.update',
        entityType: 'Budget',
        entityId: params.id,
        before: { amount: before.amount.toFixed(2), isActive: before.isActive },
        after: { amount: after.amount.toFixed(2), isActive: after.isActive },
      })

      return after
    }).catch((err) => {
      if (err instanceof HttpError) {
        return { __httpError: err } as const
      }
      throw err
    })

    if ('__httpError' in updated) {
      return withCors(
        NextResponse.json({ error: updated.__httpError.message }, { status: updated.__httpError.status }),
      )
    }

    return withCors(NextResponse.json(serialize(updated)))
  } catch (err) {
    console.error('[PATCH /api/admin/budgets/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const result = await db.$transaction(async (tx) => {
      const before = await tx.budget.findUnique({ where: { id: params.id } })
      if (!before) {
        return { __httpError: new HttpError(404, 'budget_not_found') } as const
      }
      if (!before.isActive) {
        // Already soft-deleted — treat as success (idempotent)
        return { alreadyDeleted: true } as const
      }
      await tx.budget.update({
        where: { id: params.id },
        data: { isActive: false },
      })
      await recordAudit(tx, {
        actorId: admin.id,
        action: 'budget.soft_delete',
        entityType: 'Budget',
        entityId: params.id,
        before: { isActive: true },
        after: { isActive: false },
      })
      return { alreadyDeleted: false } as const
    })

    if ('__httpError' in result) {
      return withCors(NextResponse.json({ error: result.__httpError.message }, { status: result.__httpError.status }))
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[DELETE /api/admin/budgets/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}
