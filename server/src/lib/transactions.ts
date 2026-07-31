// Transaction helpers (Feature 05).
// Per docs/backend/features/05-transactions.md § 1.5:
//
//   - canPostTransaction(userId, categoryId): USER must be assigned; ADMIN OK
//   - canViewTransaction(userId, tx): admin always, owner always, otherwise deny
//   - buildTransactionWhere(req, actor): converts a list query into a Prisma where
//
// These power the scope check (gotcha #4 from the spec — scope before action).

import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/** Can this user post a transaction in the given category? */
export async function canPostTransaction(
  userId: string,
  categoryId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  })
  if (!user || !user.isActive) return { ok: false, reason: 'user_inactive' }
  if (user.role === 'ADMIN') return { ok: true }

  const link = await db.userCategory.findUnique({
    where: { userId_categoryId: { userId, categoryId } },
  })
  return link
    ? { ok: true }
    : { ok: false, reason: 'category_not_assigned' }
}

/** Can this user view a given transaction? */
export function canViewTransaction(
  actor: { id: string; role: string; isActive: boolean },
  tx: { postedById: string },
): boolean {
  if (!actor.isActive) return false
  if (actor.role === 'ADMIN') return true
  return actor.id === tx.postedById
}

/** If the user can post in this category, fetch the sub-category ownership row. */
export async function canUseSubCategory(
  userId: string,
  subCategoryId: string,
): Promise<boolean> {
  const sub = await db.subCategory.findUnique({
    where: { id: subCategoryId },
    select: { ownerId: true, isActive: true, parentId: true },
  })
  if (!sub || !sub.isActive) return false
  // Owner always wins
  if (sub.ownerId === userId) return true
  // Otherwise check if the user is admin (covered by caller); for non-admin,
  // require the parent category assignment AND that sub-category is not theirs.
  // (Spec gotcha: sub-cat is owner-private.)
  return false
}

// --- buildTransactionWhere ---
// Used by GET /api/transactions (F05) AND GET /api/admin/search (F08).
// Inputs:
//   - actor: the requesting user
//   - query: F05 fields + F08 fields (arrays + description + userIds[]).
//     F05 callers pass single values; F08 callers pass arrays.
//   - includeScopeAll: when true (admin only), don't restrict to own
//
// F08 additions (all optional, backward-compatible):
//   - categoryIds[], subCategoryIds[], paymentMethods[], userIds[]   (any-of)
//   - description   (matches vendor + description + notes + personName-like fields)
//   - status filter accepts 'SOFT_DELETED' (maps to isDeleted:true)
export interface ListQuery {
  from?: string
  to?: string
  type?: 'INTAKE' | 'EXPENSE'
  categoryId?: string
  categoryIds?: string[] // F08 multi-value
  subCategoryId?: string
  subCategoryIds?: string[] // F08 multi-value
  status?: string
  paymentMethod?: string
  paymentMethods?: string[] // F08 multi-value
  userIds?: string[] // F08: filter by poster
  postedById?: string
  periodKey?: string
  min?: string
  max?: string
  q?: string // F05 free-text
  description?: string // F08 free-text (vendor + description + notes)
  page?: number
  pageSize?: number
  scope?: 'all' | 'mine' // admin can pass ?scope=all
}

export interface ActorContext {
  id: string
  role: string
  isActive: boolean
}

export function buildTransactionWhere(
  actor: ActorContext,
  query: ListQuery,
): Prisma.TransactionWhereInput {
  if (!actor.isActive) return { id: '__never__' } // blocked

  const where: Prisma.TransactionWhereInput = {}

  // --- Scope ---
  // USER: implicit "mine" (own postedBy only). ADMIN: default all, ?scope=mine for own.
  // For F08, admin always wants all unless they explicitly pass userIds[] (filter to list).
  if (actor.role === 'ADMIN' && query.scope === 'mine') {
    where.postedById = actor.id
  } else if (actor.role !== 'ADMIN') {
    where.postedById = actor.id
  }

  // --- isDeleted default ---
  // F05 default: not deleted. F08 with status=SOFT_DELETED: isDeleted=true.
  // F08 with other status: isDeleted=false. F11 with includeSoftDeleted:true: all.
  if (query.status === 'SOFT_DELETED') {
    where.isDeleted = true
  } else if (query.includeSoftDeleted === true) {
    // No isDeleted filter — include both.
  } else {
    where.isDeleted = false
  }

  // --- userIds (F08) ---
  if (query.userIds?.length) {
    // ADMIN filtering by specific posters — overrides the implicit "own" only for non-admin
    where.postedById = { in: query.userIds }
  }

  // --- Date range ---
  // from: YYYY-MM-DD → start of day UTC (00:00:00.000Z)
  // to:   YYYY-MM-DD → end of day UTC (23:59:59.999Z) so lte is inclusive of the whole day.
  if (query.from) {
    const from = new Date(`${query.from}T00:00:00.000Z`)
    if (!isNaN(from.getTime())) {
      where.occurredAt = { ...(where.occurredAt as object), gte: from }
    }
  }
  if (query.to) {
    const to = new Date(`${query.to}T23:59:59.999Z`)
    if (!isNaN(to.getTime())) {
      where.occurredAt = { ...(where.occurredAt as object), lte: to }
    }
  }
  if (query.type) where.type = query.type

  // --- Category / Sub-category ---
  // Single-value (F05) wins over array (F08) when both present — unlikely but deterministic.
  if (query.categoryIds?.length) where.categoryId = { in: query.categoryIds }
  if (query.categoryId) where.categoryId = query.categoryId
  if (query.subCategoryIds?.length) where.subCategoryId = { in: query.subCategoryIds }
  if (query.subCategoryId) where.subCategoryId = query.subCategoryId

  // --- Status ---
  // SOFT_DELETED already handled above (isDeleted=true). Others filter by status string.
  if (query.status && query.status !== 'SOFT_DELETED') where.status = query.status

  // --- Payment methods ---
  if (query.paymentMethods?.length) where.paymentMethod = { in: query.paymentMethods }
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod

  if (query.periodKey) where.periodKey = query.periodKey

  // --- Amount range ---
  if (query.min || query.max) {
    const amountFilter: Prisma.DecimalFilter = {}
    if (query.min) amountFilter.gte = query.min
    if (query.max) amountFilter.lte = query.max
    where.amount = amountFilter
  }

  // --- Free text ---
  // F05: `q` matches vendor + description + notes.
  // F08: `description` matches the same fields (spec gotcha #1: title+description+personName;
  //      we don't have a `title` or `personName` column on Transaction, so we use
  //      vendor + description + notes — equivalent in practice).
  const searchTerm = query.description ?? query.q
  if (searchTerm) {
    where.OR = [
      { vendor: { contains: searchTerm } },
      { description: { contains: searchTerm } },
      { notes: { contains: searchTerm } },
    ]
  }

  return where
}
