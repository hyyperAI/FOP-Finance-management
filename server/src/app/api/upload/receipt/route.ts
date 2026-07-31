// POST /api/upload/receipt — multipart upload of a receipt image.
// Per docs/backend/features/07-receipts.md § 1.2.
//
// Pipeline: MIME/size validation → storage cap check → sharp pipeline (auto-
// rotate + resize + JPEG q80 + strip EXIF) → save under date prefix → return key.

import { NextResponse } from 'next/server'

import { requireSession } from '@/lib/auth-guards'
import { getStorage } from '@/lib/storage'
import { processReceipt } from '@/lib/image'
import { cuid } from '@/lib/cuid'
import {
  RECEIPT_MAX_SIZE_MB,
  RECEIPT_MAX_SIZE_BYTES,
  RECEIPT_ACCEPTED_MIME,
  MAX_STORAGE_BYTES,
} from '@/lib/constants'
import { withCors, preflight } from '@/lib/cors'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return preflight()
}

export async function POST(req: Request) {
  try {
    const user = await requireSession()
    if (user instanceof NextResponse) return user

    // Multipart form parsing. Per spec gotcha #5, Next.js route handlers
    // using the native Request API (req.formData()) don't have an internal
    // body size limit; the explicit check below is the canonical limit.
    const formData = await req.formData()
    const file = formData.get('receipt')

    if (!file || !(file instanceof File)) {
      return withCors(NextResponse.json({ error: 'no_file' }, { status: 400 }))
    }

    // MIME validation
    if (!RECEIPT_ACCEPTED_MIME.includes(file.type as 'image/jpeg' | 'image/png')) {
      return withCors(
        NextResponse.json(
          { error: 'invalid_mime', expected: RECEIPT_ACCEPTED_MIME, got: file.type },
          { status: 400 },
        ),
      )
    }

    // Size validation (before processing)
    if (file.size > RECEIPT_MAX_SIZE_BYTES) {
      return withCors(
        NextResponse.json(
          {
            error: 'file_too_large',
            maxMb: RECEIPT_MAX_SIZE_MB,
            sizeMb: Math.round((file.size / 1024 / 1024) * 10) / 10,
          },
          { status: 400 },
        ),
      )
    }

    // Storage cap check (before save — gotcha #7)
    const storage = getStorage()
    const currentUsage = await storage.getUsage()
    if (currentUsage >= MAX_STORAGE_BYTES) {
      return withCors(
        NextResponse.json(
          {
            error: 'storage_cap_exceeded',
            usedBytes: currentUsage,
            maxBytes: MAX_STORAGE_BYTES,
          },
          { status: 507 },
        ),
      )
    }

    // Read + process
    const buffer = Buffer.from(await file.arrayBuffer())
    const processed = await processReceipt(buffer)

    // Post-processing size check (gotcha #4 — compression may not be enough)
    if (processed.length > RECEIPT_MAX_SIZE_BYTES) {
      return withCors(
        NextResponse.json({ error: 'file_too_large_after_compression' }, { status: 400 }),
      )
    }

    // Save
    const filename = `${cuid()}.jpg`
    const key = await storage.save(processed, filename, 'image/jpeg')

    return withCors(NextResponse.json({ key }))
  } catch (err) {
    console.error('[POST /api/upload/receipt] error:', err)
    return withCors(
      NextResponse.json(
        { error: 'internal_error', message: (err as Error).message },
        { status: 500 },
      ),
    )
  }
}
