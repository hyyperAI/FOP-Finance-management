// /api/sub-categories — GET (list) + POST (create)
// Per docs/backend/features/04-sub-categories.md § 1.2.

import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { requireSession } from '@/lib/auth-guards'
import { canCreateSubCategory } from '@/lib/permissions'
import {
  CreateSubCategorySchema,
  ListSubCategoriesQuerySchema,
} from '@/lib/validators/subcategory'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

// --- GET /api/sub-categories ---
// USER: implicit mine=true (always filter to own)
// ADMIN: returns all unless mine=true is explicit
export async function GET(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    const url = new URL(req.url)
    const raw: Record<string, string> = {}
    url.searchParams.forEach((v, k) => {
      raw[k] = v
    })
    const parsed = ListSubCategoriesQuerySchema.safeParse(raw)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    const mine = user.role === 'USER' || parsed.data.mine === true
    const where: Prisma.SubCategoryWhereInput = {
      ...(mine && { ownerId: user.id }),
      ...(parsed.data.parentId && { parentId: parsed.data.parentId }),
      ...(typeof parsed.data.isActive === 'boolean' && {
        isActive: parsed.data.isActive,
      }),
    }

    const subCategories = await db.subCategory.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true, type: true, color: true } },
      },
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    })

    return withCors(NextResponse.json({ subCategories }))
  } catch (err) {
    console.error('[GET /api/sub-categories] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}

// --- POST /api/sub-categories ---
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
    const parsed = CreateSubCategorySchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }

    // Verify parent exists and is active (spec gotcha)
    const parent = await db.category.findUnique({
      where: { id: parsed.data.parentId },
    })
    if (!parent || !parent.isActive) {
      return withCors(
        NextResponse.json({ error: 'parent_not_found' }, { status: 404 }),
      )
    }

    // Scope check: USER must be assigned to parent
    const can = await canCreateSubCategory(user.id, parsed.data.parentId)
    if (!can) {
      return withCors(
        NextResponse.json({ error: 'parent_not_assigned' }, { status: 403 }),
      )
    }

    // Uniqueness check — look up the (ownerId, parentId, name) unique row.
    // Note: the spec uses `findUnique` with the named composite key
    // `ownerId_parentId_name`. In our schema the unique is `(ownerId, parentId,
    // name)` and the implicit key is `ownerId_parentId_name`.
    const existing = await db.subCategory.findUnique({
      where: {
        ownerId_parentId_name: {
          ownerId: user.id,
          parentId: parsed.data.parentId,
          name: parsed.data.name,
        },
      },
    })
    if (existing && existing.isActive) {
      return withCors(
        NextResponse.json({ error: 'duplicate_name_in_parent' }, { status: 409 }),
      )
    }

    const subCategory = await db.$transaction(async (tx) => {
      // If a soft-deleted row with the same key exists, restore it (spec gotcha #3)
      if (existing && !existing.isActive) {
        const restored = await tx.subCategory.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            color: parsed.data.color ?? null,
            icon: parsed.data.icon ?? null,
            notes: parsed.data.notes ?? null,
          },
        })
        await recordAudit(tx, {
          actorId: user.id,
          action: 'subcategory.create',
          entityType: 'SubCategory',
          entityId: restored.id,
          before: existing,
          after: restored,
          reason: 'Restored from soft-delete (same name)',
        })
        return restored
      }

      const created = await tx.subCategory.create({
        data: {
          name: parsed.data.name,
          ownerId: user.id,
          parentId: parsed.data.parentId,
          color: parsed.data.color ?? null,
          icon: parsed.data.icon ?? null,
          notes: parsed.data.notes ?? null,
        },
      })
      await recordAudit(tx, {
        actorId: user.id,
        action: 'subcategory.create',
        entityType: 'SubCategory',
        entityId: created.id,
        after: created,
      })
      return created
    })

    return withCors(NextResponse.json(subCategory, { status: 201 }))
  } catch (err) {
    console.error('[POST /api/sub-categories] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
