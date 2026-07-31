// /api/admin/categories — GET (list) + POST (create)
// Per docs/backend/features/03-categories-admin.md § 1.2.

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-guards'
import { CreateCategorySchema, ListCategoriesQuerySchema } from '@/lib/validators/category'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/admin/categories ---
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const url = new URL(req.url)
    // Build a plain object from searchParams, then let Zod coerce
    const raw: Record<string, string> = {}
    url.searchParams.forEach((v, k) => {
      raw[k] = v
    })
    const parsed = ListCategoriesQuerySchema.safeParse(raw)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    const where: Prisma.CategoryWhereInput = {
      ...(parsed.data.type && { type: parsed.data.type }),
      ...(typeof parsed.data.isActive === 'boolean' && { isActive: parsed.data.isActive }),
      ...(parsed.data.departmentId && { departmentId: parsed.data.departmentId }),
    }

    const categories = await db.category.findMany({
      where,
      include: {
        _count: {
          select: {
            // We use the `isActive` filter directly on the relation count.
            // Prisma's _count with where requires Prisma 4.3+; this works
            // on 5.20+. Falls back to manual count via Promise.all if not.
            subCategories: { where: { isActive: true } },
            userCategories: true,
          },
        },
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })

    return withCors(
      NextResponse.json({
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          type: c.type,
          color: c.color,
          icon: c.icon,
          description: c.description,
          isDefault: c.isDefault,
          isActive: c.isActive,
          departmentId: c.departmentId,
          department: c.department,
          subCategoryCount: c._count.subCategories,
          assignedUserCount: c._count.userCategories,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/categories] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- POST /api/admin/categories ---
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
    const parsed = CreateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    // Verify departmentId if provided
    if (parsed.data.departmentId) {
      const dept = await db.department.findUnique({
        where: { id: parsed.data.departmentId },
      })
      if (!dept) {
        return withCors(
          NextResponse.json({ error: 'invalid_department_id' }, { status: 400 }),
        )
      }
    }

    // Uniqueness check (separate query, not inside a tx — spec gotcha #5 from
    // Feature 02 applies: don't waste a DB connection by using a tx for this)
    const existing = await db.category.findFirst({
      where: {
        name: parsed.data.name,
        type: parsed.data.type,
        departmentId: parsed.data.departmentId ?? null,
      },
    })
    if (existing) {
      return withCors(
        NextResponse.json({ error: 'duplicate_name_in_scope' }, { status: 409 }),
      )
    }

    const category = await db.$transaction(async (tx) => {
      const c = await tx.category.create({
        data: {
          name: parsed.data.name,
          type: parsed.data.type,
          color: parsed.data.color,
          icon: parsed.data.icon,
          description: parsed.data.description,
          isDefault: parsed.data.isDefault,
          departmentId: parsed.data.departmentId ?? null,
        },
      })

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'category.create',
        entityType: 'Category',
        entityId: c.id,
        after: c,
      })

      return c
    })

    return withCors(NextResponse.json(category, { status: 201 }))
  } catch (err) {
    console.error('[POST /api/admin/categories] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
