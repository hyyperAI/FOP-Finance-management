// /api/admin/users — GET (list) + POST (create)
// Per docs/backend/features/02-users-admin.md § 1.2.

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { recordAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-guards'
import { CreateUserSchema } from '@/lib/validators/user'
import { serializeUserListItem } from '@/lib/serializers/user'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/admin/users — list with filters, search, pagination ---
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const url = new URL(req.url)
    const q = url.searchParams.get('q') ?? undefined
    const role = url.searchParams.get('role') ?? undefined
    const status = url.searchParams.get('status') ?? undefined
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1)
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '25', 10) || 25),
    )

    // SQLite doesn't support Prisma's `mode: 'insensitive'` (Postgres-only).
    // SQLite's default LIKE is already case-insensitive for ASCII, so plain
    // `contains` works for the typical name/email/username search.
    const where: Prisma.UserWhereInput = {
      ...(q && {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { username: { contains: q } },
        ],
      }),
      ...(role === 'ADMIN' || role === 'USER' ? { role } : {}),
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        include: { categories: { select: { categoryId: true } } },
        orderBy: { createdAt: 'desc' },
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      db.user.count({ where }),
    ])

    return withCors(
      NextResponse.json({
        users: users.map(serializeUserListItem),
        total,
        page,
        pageSize,
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/users] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- POST /api/admin/users — create ---
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
    const parsed = CreateUserSchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    // Duplicate check (gotcha #5: separate query, not inside a tx)
    const existing = await db.user.findFirst({
      where: { OR: [{ email: parsed.data.email }, { username: parsed.data.username }] },
      select: { email: true, username: true },
    })
    if (existing) {
      if (existing.email === parsed.data.email) {
        return withCors(NextResponse.json({ error: 'duplicate_email' }, { status: 409 }))
      }
      return withCors(NextResponse.json({ error: 'duplicate_username' }, { status: 409 }))
    }

    // Verify categoryIds exist (only when provided + non-empty)
    if (parsed.data.categoryIds.length > 0) {
      const found = await db.category.count({
        where: { id: { in: parsed.data.categoryIds } },
      })
      if (found !== parsed.data.categoryIds.length) {
        return withCors(NextResponse.json({ error: 'invalid_category_ids' }, { status: 400 }))
      }
    }

    // Hash before the tx (gotcha #9: bcrypt is slow; offload from the tx window)
    const passwordHash = await hashPassword(parsed.data.password)

    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: parsed.data.email,
          username: parsed.data.username,
          name: parsed.data.name,
          phone: parsed.data.phone ?? null,
          passwordHash,
          role: parsed.data.role,
          isActive: parsed.data.isActive,
        },
      })

      if (parsed.data.categoryIds.length > 0) {
        await tx.userCategory.createMany({
          data: parsed.data.categoryIds.map((categoryId) => ({ userId: u.id, categoryId })),
        })
      }

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'user.create',
        entityType: 'User',
        entityId: u.id,
        after: { ...u, passwordHash: undefined, categoryIds: parsed.data.categoryIds },
      })

      return u
    })

    // Reload with categories for the response
    const withCats = await db.user.findUnique({
      where: { id: user.id },
      include: { categories: { select: { categoryId: true } } },
    })

    return withCors(NextResponse.json(serializeUserListItem(withCats!), { status: 201 }))
  } catch (err) {
    console.error('[POST /api/admin/users] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
