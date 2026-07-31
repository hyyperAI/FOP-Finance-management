// /api/sub-categories/[id] — PATCH (rename) + DELETE (soft delete)
// Per docs/backend/features/04-sub-categories.md § 1.2.
//
// Critical:
//   - PATCH is OWNER ONLY. Admin CANNOT edit user sub-categories (spec § 1.2 + § 5.gotcha #2).
//   - PATCH only accepts `name` (validator is .strict() — anything else → 400).
//   - DELETE is OWNER ONLY (same reason).
//   - DELETE is idempotent: second call returns `alreadyDeleted: true`.

import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guards'
import { RenameSubCategorySchema } from '@/lib/validators/subcategory'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return withCors(NextResponse.json({ error: 'invalid_json' }, { status: 400 }))
    }
    const parsed = RenameSubCategorySchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    const existing = await db.subCategory.findUnique({ where: { id: params.id } })
    if (!existing) {
      return withCors(
        NextResponse.json({ error: 'subcategory_not_found' }, { status: 404 }),
      )
    }

    // OWNERSHIP CHECK — admin CANNOT edit user sub-categories.
    // Even if the actor is an ADMIN, the row belongs to a specific user and
    // that user is the only one allowed to rename it. (Spec § 1.7 + gotcha #2.)
    if (existing.ownerId !== user.id) {
      return withCors(
        NextResponse.json({ error: 'not_owner' }, { status: 403 }),
      )
    }

    // Uniqueness check on the new name (in case of conflict with another sub-cat
    // under the same parent)
    const conflict = await db.subCategory.findFirst({
      where: {
        id: { not: params.id },
        ownerId: existing.ownerId,
        parentId: existing.parentId,
        name: parsed.data.name,
        isActive: true,
      },
    })
    if (conflict) {
      return withCors(
        NextResponse.json({ error: 'duplicate_name_in_parent' }, { status: 409 }),
      )
    }

    const updated = await db.$transaction(async (tx) => {
      const s = await tx.subCategory.update({
        where: { id: params.id },
        data: { name: parsed.data.name },
      })
      await recordAudit(tx, {
        actorId: user.id,
        action: 'subcategory.rename',
        entityType: 'SubCategory',
        entityId: params.id,
        before: existing,
        after: s,
      })
      return s
    })

    return withCors(NextResponse.json(updated))
  } catch (err) {
    console.error('[PATCH /api/sub-categories/[id]] error:', err)
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
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    const existing = await db.subCategory.findUnique({ where: { id: params.id } })
    if (!existing) {
      return withCors(
        NextResponse.json({ error: 'subcategory_not_found' }, { status: 404 }),
      )
    }

    // OWNERSHIP CHECK (same as PATCH)
    if (existing.ownerId !== user.id) {
      return withCors(
        NextResponse.json({ error: 'not_owner' }, { status: 403 }),
      )
    }

    if (!existing.isActive) {
      return withCors(NextResponse.json({ ok: true, alreadyDeleted: true }))
    }

    await db.$transaction(async (tx) => {
      await tx.subCategory.update({
        where: { id: params.id },
        data: { isActive: false },
      })
      await recordAudit(tx, {
        actorId: user.id,
        action: 'subcategory.soft_delete',
        entityType: 'SubCategory',
        entityId: params.id,
        before: existing,
        after: { ...existing, isActive: false },
      })
    })

    return withCors(NextResponse.json({ ok: true }))
  } catch (err) {
    console.error('[DELETE /api/sub-categories/[id]] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
