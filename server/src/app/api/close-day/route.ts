// /api/close-day — GET (check close status) + POST (user closes own day)
// Per docs/backend/features/06-close-day.md § 1.2.

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guards'
import {
  calculateExpected,
  calculateVariance,
  totalOf,
} from '@/lib/reconciliation'
import {
  CloseDayQuerySchema,
  CreateDayCloseSchema,
} from '@/lib/validators/close-day'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/close-day?date=YYYY-MM-DD&userId=... ---
export async function GET(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    const url = new URL(req.url)
    const raw: Record<string, string> = {}
    url.searchParams.forEach((v, k) => {
      raw[k] = v
    })
    const parsed = CloseDayQuerySchema.safeParse(raw)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    // Determine target user (gotcha: USER can only see own; ADMIN can see any)
    let targetUserId = user.id
    if (parsed.data.userId && parsed.data.userId !== user.id) {
      if (user.role !== 'ADMIN') {
        return withCors(NextResponse.json({ error: 'forbidden' }, { status: 403 }))
      }
      targetUserId = parsed.data.userId
    }

    // Always compute expected (whether or not already closed)
    const expectedByMethod = await calculateExpected(targetUserId, parsed.data.date)

    const dayClose = await db.dayClose.findUnique({
      where: {
        userId_closeDate: {
          userId: targetUserId,
          closeDate: new Date(`${parsed.data.date}T00:00:00.000Z`),
        },
      },
    })

    if (!dayClose) {
      return withCors(
        NextResponse.json({
          closed: false,
          expectedByMethod,
        }),
      )
    }

    return withCors(
      NextResponse.json({
        closed: true,
        dayClose: serializeDayClose(dayClose),
        expectedByMethod,
      }),
    )
  } catch (err) {
    console.error('[GET /api/close-day] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- POST /api/close-day (user closes own day) ---
export async function POST(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }
    const parsed = CreateDayCloseSchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }
    const data = parsed.data

    // Date validation (spec gotcha #8: future rejected; gotcha #7: backdating window)
    const closeDate = new Date(`${data.closeDate}T00:00:00.000Z`)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    if (closeDate.getTime() > today.getTime()) {
      return withCors(NextResponse.json({ error: 'date_in_future' }, { status: 400 }))
    }

    const daysSince = Math.floor(
      (today.getTime() - closeDate.getTime()) / (24 * 60 * 60 * 1000),
    )
    const maxBackdatingDays = user.role === 'ADMIN' ? 365 : 7
    if (daysSince > maxBackdatingDays) {
      return withCors(
        NextResponse.json(
          { error: 'date_too_old', maxDays: maxBackdatingDays },
          { status: 400 },
        ),
      )
    }

    // Duplicate check (gotcha #5 — UX first, DB constraint as backstop)
    const existing = await db.dayClose.findUnique({
      where: { userId_closeDate: { userId: user.id, closeDate } },
    })
    if (existing) {
      return withCors(NextResponse.json({ error: 'day_already_closed' }, { status: 409 }))
    }

    // Compute expected + variance
    const expectedByMethod = await calculateExpected(user.id, data.closeDate)
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
          userId: user.id,
          closeDate,
          countedByMethod: JSON.stringify(data.countedByMethod),
          expectedByMethod: JSON.stringify(expectedByMethod),
          varianceByMethod: JSON.stringify(varianceByMethod),
          totalCounted: new Prisma.Decimal(totalCounted),
          totalExpected: new Prisma.Decimal(totalExpected),
          totalVariance: new Prisma.Decimal(totalVariance),
          hasVariance,
          notes: data.notes ?? null,
          closedById: null, // user closes own day
        },
      })

      await recordAudit(tx, {
        actorId: user.id,
        action: 'dayclose.create',
        entityType: 'DayClose',
        entityId: dc.id,
        after: {
          ...dc,
          totalCounted: dc.totalCounted.toString(),
          totalExpected: dc.totalExpected.toString(),
          totalVariance: dc.totalVariance.toString(),
        },
      })

      return dc
    })

    return withCors(NextResponse.json(serializeDayClose(dayClose), { status: 201 }))
  } catch (err) {
    console.error('[POST /api/close-day] error:', err)
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
