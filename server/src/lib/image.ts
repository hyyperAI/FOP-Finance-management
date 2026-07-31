// Image processing for uploaded receipts.
// Per docs/backend/features/07-receipts.md § 1.2 — sharp pipeline.

import sharp from 'sharp'

/**
 * Process a receipt image:
 *   1. Auto-rotate based on EXIF orientation (then strip EXIF)
 *   2. Resize so longest edge ≤ 2000 px (preserves aspect, no enlargement)
 *   3. Convert to JPEG with quality 80 (mozjpeg for better compression)
 *   4. Strip all EXIF metadata
 *
 * Returns a JPEG buffer.
 */
export async function processReceipt(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .rotate() // auto-rotate based on EXIF orientation
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .withMetadata({}) // strip EXIF
    .toBuffer()
}
