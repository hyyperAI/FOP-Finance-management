// POST /api/admin/reports/pdf — admin-only PDF bank statement.
// Per docs/backend/features/10-reports-pdf.md § 1.2 (and M2.md deviation
// note: uses hand-rolled PDF, not @react-pdf/renderer).
//
// Single endpoint — the preview endpoint is deferred (M2.md).

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { z } from 'zod'

import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-guards'
import { recordAudit } from '@/lib/audit'
import { buildTransactionWhere, type ActorContext } from '@/lib/transactions'
import { generateStatementPdf } from '@/lib/pdf'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

const ReportFiltersSchema = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    categoryIds: z.array(z.string().min(20).max(40)).optional(),
    subCategoryIds: z.array(z.string().min(20).max(40)).optional(),
    paymentMethods: z
      .array(z.enum(['CASH', 'BANK', 'JAZZCASH', 'EASYPAISA', 'CARD']))
      .optional(),
    userIds: z.array(z.string().min(20).max(40)).optional(),
    type: z.enum(['all', 'INTAKE', 'EXPENSE']).default('all'),
    minAmount: z.number().nonnegative().optional(),
    maxAmount: z.number().nonnegative().optional(),
  })
  .refine((d) => new Date(d.from) <= new Date(d.to), {
    message: 'from must be ≤ to',
    path: ['from'],
  })

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
    const parsed = ReportFiltersSchema.safeParse(body)
    if (!parsed.success) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: parsed.error.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }
    const filters = parsed.data

    // Build where clause via the shared builder (F05/F08). Pass admin actor so
    // scope check resolves to "all".
    const actor: ActorContext = {
      id: admin.id,
      role: admin.role,
      isActive: admin.isActive,
    }
    const where = buildTransactionWhere(actor, {
      from: filters.from,
      to: filters.to,
      type: filters.type === 'all' ? undefined : filters.type,
      categoryIds: filters.categoryIds,
      subCategoryIds: filters.subCategoryIds,
      paymentMethods: filters.paymentMethods,
      userIds: filters.userIds,
      min:
        filters.minAmount !== undefined ? String(filters.minAmount) : undefined,
      max:
        filters.maxAmount !== undefined ? String(filters.maxAmount) : undefined,
    })

    const transactions = await db.transaction.findMany({
      where,
      include: {
        category: { select: { name: true } },
        subCategory: { select: { name: true } },
        postedBy: { select: { name: true } },
      },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    })

    // Audit BEFORE generation (spec gotcha #1).
    try {
      await recordAudit(db, {
        actorId: admin.id,
        action: 'report.generate',
        entityType: 'Report',
        entityId: `pdf-${filters.from}-${filters.to}`,
        after: {
          from: filters.from,
          to: filters.to,
          rowCount: transactions.length,
          filters,
        },
      })
    } catch (err) {
      console.error('[POST /api/admin/reports/pdf] audit failed:', err)
      // Continue — audit shouldn't block report generation.
    }

    // Generate PDF
    try {
      const pdfBuffer = generateStatementPdf({
        orgName: process.env.ORG_NAME || 'FOP Financial Management System',
        from: filters.from,
        to: filters.to,
        transactions: transactions.map((t) => ({
          occurredAt: t.occurredAt,
          type: t.type as 'INTAKE' | 'EXPENSE',
          amount: t.amount.toString(),
          vendor: t.vendor,
          description: t.description,
          paymentMethod: t.paymentMethod,
          category: t.category ?? { name: 'Unknown' },
          subCategory: t.subCategory ?? null,
          postedBy: t.postedBy ?? { name: 'Unknown' },
        })),
      })

      const filename = `fop-statement-${filters.from.slice(0, 7)}.pdf`
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Length': String(pdfBuffer.length),
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    } catch (err) {
      console.error('[POST /api/admin/reports/pdf] PDF generation failed:', err)
      return withCors(
        NextResponse.json({ error: 'pdf_generation_failed', message: (err as Error).message }, { status: 500 }),
      )
    }
  } catch (err) {
    if (err instanceof ZodError) {
      return withCors(
        NextResponse.json(
          { error: 'validation_error', fields: err.flatten().fieldErrors },
          { status: 400 },
        ),
      )
    }
    console.error('[POST /api/admin/reports/pdf] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}