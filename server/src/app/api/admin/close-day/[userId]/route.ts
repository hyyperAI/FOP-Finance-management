// POST /api/admin/close-day/[userId] — admin closes on behalf
// Per docs/backend/features/06-close-day.md § 1.2.
//
// Critical: `reason` is REQUIRED, min 20 chars (spec gotcha #6).

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-guards'
import {
  calculateExpected,
  calculateVariance,
  totalOf,
} from '@/lib/reconciliation'
import { AdminCreateDayCloseSchema } from '@/lib/validators/close-day'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: Request, { params }: { params: { userId: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }
    const parsed = AdminCreateDayCloseSchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }
    const data = parsed.data

    // Date validation (admin gets extended 365-day window)
    const closeDate = new Date(`${data.closeDate}T00:00:00.000Z`)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (closeDate.getTime() > today.getTime()) {
      return withCors(NextResponse.json({ error: 'date_in_future' }, { status: 400 }))
    }
    const daysSince = Math.floor(
      (today.getTime() - closeDate.getTime()) / (24 * 60 * 60 * 1000),
    )
    if (daysSince > 365) {
      return withCors(
        NextResponse.json({ error: 'date_too_old', maxDays: 365 }, { status: 400 }),
      )
    }

    // Target user must exist and be active
    const target = await db.user.findUnique({ where: { id: params.userId } })
    if (!target || !target.isActive) {
      return withCors(NextResponse.json({ error: 'user_not_found' }, { status: 404 }))
    }

    // Duplicate check
    const existing = await db.dayClose.findUnique({
      where: { userId_closeDate: { userId: params.userId, closeDate } },
    })
    if (existing) {
      return withCors(NextResponse.json({ error: 'day_already_closed' }, { status: 409 }))
    }

    // Compute expected for the TARGET user, not the admin
    const expectedByMethod = await calculateExpected(params.userId, data.closeDate)
    const { varianceByMethod, hasVariance } = calculateVariance(
      data.countedByMethod,
      expectedByMethod,
    )
    const totalCounted = totalOf(data.countedByMethod)
    const totalExpected = totalOf(expectedByMethod)
    const totalVariance = round2(totalCounted - totalExpected)

    const dayClose = await db.$transaction(async (tx) => {
      const dc = await tx.dayClose.create({
        data: {
          userId: params.userId,
          closeDate,
          countedByMethod: JSON.stringify(data.countedByMethod),
          expectedByMethod: JSON.stringify(expectedByMethod),
          varianceByMethod: JSON.stringify(varianceByMethod),
          totalCounted: new Prisma.Decimal(totalCounted),
          totalExpected: new Prisma.Decimal(totalExpected),
          totalVariance: new Prisma.Decimal(totalVariance),
          hasVariance,
          notes: data.notes ?? null,
          closedById: admin.id,
          reason: data.reason,
        },
      })

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'dayclose.create_by_admin',
        entityType: 'DayClose',
        entityId: dc.id,
        after: {
          ...dc,
          totalCounted: dc.totalCounted.toString(),
          totalExpected: dc.totalExpected.toString(),
          totalVariance: dc.totalVariance.toString(),
          reason: data.reason,
        },
      })

      return dc
    })

    return withCors(NextResponse.json(serializeDayClose(dayClose), { status: 201 }))
  } catch (err) {
    console.error('[POST /api/admin/close-day/[userId]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

function serializeDayClose(dc: {
  id: string
  userId: string
  closeDate: Date
  countedByMethod: string
  expectedByMethod: string
  varianceByMethod: string
  totalCounted: { toString: () => string }
  totalExpected: { toString: () => string }
  totalVariance: { toString: () => string }
  hasVariance: boolean
  notes: string | null
  closedById: string | null
  reason: string | null
  closedAt: Date
}) {
  return {
    id: dc.id,
    userId: dc.userId,
    closeDate: dc.closeDate.toISOString().slice(0, 10),
    countedByMethod: JSON.parse(dc.countedByMethod),
    expectedByMethod: JSON.parse(dc.expectedByMethod),
    varianceByMethod: JSON.parse(dc.varianceByMethod),
    totalCounted: dc.totalCounted.toString(),
    totalExpected: dc.totalExpected.toString(),
    totalVariance: dc.totalVariance.toString(),
    hasVariance: dc.hasVariance,
    notes: dc.notes,
    closedById: dc.closedById,
    reason: dc.reason,
    closedAt: dc.closedAt.toISOString(),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
