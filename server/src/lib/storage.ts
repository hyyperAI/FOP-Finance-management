// Storage adapter. Per docs/backend/features/07-receipts.md § 1.2 + 13-storage.md § 1.5.
//
// Stage 1 = local FS at public/uploads/receipts/{YYYY}/{MM}/. Feature 13 adds
// the `listAll()` method so the storage-stats + prune endpoints can enumerate
// every file and diff them against live Transaction.receiptUrl references.

import { promises as fs } from 'fs'
import path from 'path'

export interface StorageFileEntry {
  /** Storage key (relative path under public/uploads/). */
  key: string
  /** File size in bytes. */
  sizeBytes: number
  /** Last-modified timestamp (mtime). */
  mtime: Date
}

export interface StorageAdapter {
  /** Save a buffer. Returns a stable key (relative path) used to look it up later. */
  save(buffer: Buffer, filename: string, contentType: string): Promise<string>
  /** URL the frontend should use to fetch the file (private, authenticated). */
  getUrl(key: string): Promise<string>
  /** Delete by key. Idempotent (no-throw on ENOENT). */
  delete(key: string): Promise<void>
  /** Total bytes used by the receipts tree. */
  getUsage(): Promise<number>
  /** Recursively list every file in the receipts tree. Used by F13 stats + prune. */
  listAll(): Promise<StorageFileEntry[]>
}

class LocalStorageAdapter implements StorageAdapter {
  private readonly baseDir = path.join(process.cwd(), 'public', 'uploads')

  async save(buffer: Buffer, filename: string, _contentType: string): Promise<string> {
    const key = `uploads/receipts/${this.yearMonth()}/${filename}`
    const fullPath = path.join(process.cwd(), 'public', key)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    return key
  }

  async getUrl(key: string): Promise<string> {
    // v1: receipts are private. Served via /api/receipt/[key] with auth check
    // (not directly via /public/uploads/...). Never expose the absolute path.
    return `/api/receipt/${encodeURIComponent(key)}`
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(process.cwd(), 'public', key)
    try {
      await fs.unlink(fullPath)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') throw err
    }
  }

  async getUsage(): Promise<number> {
    let total = 0
    await this.walk(async (fullPath) => {
      const stat = await fs.stat(fullPath)
      total += stat.size
    })
    return total
  }

  async listAll(): Promise<StorageFileEntry[]> {
    const out: StorageFileEntry[] = []
    await this.walk(async (fullPath, relKey) => {
      const stat = await fs.stat(fullPath)
      out.push({ key: relKey, sizeBytes: stat.size, mtime: stat.mtime })
    })
    return out
  }

  /**
   * Walk the receipts tree, calling `visit(fullPath, relKey)` for each file.
   * Resilient to missing root (returns empty when public/uploads/ doesn't exist).
   */
  private async walk(visit: (fullPath: string, relKey: string) => Promise<void>): Promise<void> {
    const root = path.join(this.baseDir, 'receipts')
    const stack: string[] = [root]
    while (stack.length > 0) {
      const dir = stack.pop() as string
      let entries: Awaited<ReturnType<typeof fs.readdir>>
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return
        throw err
      }
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          stack.push(fullPath)
        } else {
          // fullPath is under {cwd}/public/uploads/receipts/... → key is everything after `public/`
          const relKey = path.relative(path.join(process.cwd(), 'public'), fullPath).split(path.sep).join('/')
          await visit(fullPath, relKey)
        }
      }
    }
  }

  private yearMonth(): string {
    const now = new Date()
    const y = now.getUTCFullYear()
    const m = String(now.getUTCMonth() + 1).padStart(2, '0')
    return `${y}/${m}`
  }
}

// Stage 1: always local FS. env-driven swap (supabase/s3) is deferred until needed.
let _instance: StorageAdapter | null = null
export function getStorage(): StorageAdapter {
  if (!_instance) _instance = new LocalStorageAdapter()
  return _instance
}
