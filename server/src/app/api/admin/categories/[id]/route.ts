// /api/admin/categories/[id] — GET (detail) + PATCH (update) + DELETE (soft delete)
// Per docs/backend/features/03-categories-admin.md § 1.2.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth-guards'
import { UpdateCategorySchema } from '@/lib/validators/category'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/admin/categories/[id] ---
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const category = await db.category.findUnique({
      where: { id: params.id },
      include: {
        subCategories: {
          where: { isActive: true },
          // SubCategory has `ownerId` (a User FK). Feature 04 will own the
          // relation; for now we just return the ownerId — the frontend can
          // join to /api/admin/users/[ownerId] if it needs the name.
          orderBy: { name: 'asc' },
        },
        department: { select: { id: true, name: true } },
        _count: { select: { userCategories: true } },
      },
    })

    if (!category) {
      return withCors(NextResponse.json({ error: 'category_not_found' }, { status: 404 }))
    }

    return withCors(
      NextResponse.json({
        ...category,
        assignedUserCount: category._count.userCategories,
      }),
    )
  } catch (err) {
    console.error('[GET /api/admin/categories/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- PATCH /api/admin/categories/[id] ---
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
    const parsed = UpdateCategorySchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    const existing = await db.category.findUnique({ where: { id: params.id } })
    if (!existing) {
      return withCors(NextResponse.json({ error: 'category_not_found' }, { status: 404 }))
    }

    // Verify departmentId if it's being changed
    if (
      parsed.data.departmentId !== undefined &&
      parsed.data.departmentId !== null
    ) {
      const dept = await db.department.findUnique({
        where: { id: parsed.data.departmentId },
      })
      if (!dept) {
        return withCors(
          NextResponse.json({ error: 'invalid_department_id' }, { status: 400 }),
        )
      }
    }

    // Uniqueness check if any of name/type/dept changed
    if (parsed.data.name || parsed.data.type || parsed.data.departmentId !== undefined) {
      const conflict = await db.category.findFirst({
        where: {
          id: { not: params.id },
          name: parsed.data.name ?? existing.name,
          type: parsed.data.type ?? existing.type,
          departmentId:
            parsed.data.departmentId !== undefined
              ? parsed.data.departmentId
              : existing.departmentId,
        },
      })
      if (conflict) {
        return withCors(
          NextResponse.json({ error: 'duplicate_name_in_scope' }, { status: 409 }),
        )
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const c = await tx.category.update({
        where: { id: params.id },
        data: {
          name: parsed.data.name,
          type: parsed.data.type,
          color: parsed.data.color,
          icon: parsed.data.icon,
          description: parsed.data.description,
          isActive: parsed.data.isActive,
          departmentId: parsed.data.departmentId,
        },
      })

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'category.update',
        entityType: 'Category',
        entityId: c.id,
        before: existing,
        after: c,
      })

      return c
    })

    return withCors(NextResponse.json(updated))
  } catch (err) {
    console.error('[PATCH /api/admin/categories/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- DELETE /api/admin/categories/[id] (soft delete) ---
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin()
    if (admin instanceof NextResponse) return admin

    const existing = await db.category.findUnique({ where: { id: params.id } })
    if (!existing) {
      return withCors(NextResponse.json({ error: 'category_not_found' }, { status: 404 }))
    }

    // Idempotent: a second delete returns `alreadyDeleted: true`
    if (!existing.isActive) {
      return withCors(NextResponse.json({ ok: true, alreadyDeleted: true }))
    }

    await db.$transaction(async (tx) => {
      await tx.category.update({
        where: { id: params.id },
        data: { isActive: false },
      })

      await recordAudit(tx, {
        actorId: admin.id,
        action: 'category.soft_delete',
        entityType: 'Category',
        entityId: params.id,
        before: existing,
        after: { ...existing, isActive: false },
      })
    })

    return withCors(NextResponse.json({ ok: true }))
  } catch (err) {
    console.error('[DELETE /api/admin/categories/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
