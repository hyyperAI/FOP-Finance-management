# FOP Server — Feature 01 (auth)

Separate Next.js API server for the FOP Financial Management system.
The Vite frontend (port **5173**) calls this server (port **3000**) for
real authentication. Until this server is wired, the Vite app uses its
built-in mock auth — no change is required to the existing frontend.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node 20+, Next.js 14 (App Router, API-only) |
| Database | SQLite (dev) — switch to Postgres in prod by editing `prisma/schema.prisma` |
| ORM | Prisma 5 |
| Auth | NextAuth 4 (Credentials provider) |
| Hashing | bcryptjs (cost 12) |
| Validation | Zod |
| Email | Resend — **disabled in dev**, prints the reset URL to the terminal |

## First-time setup

```bash
cd server
cp .env.example .env
pnpm install
pnpm db:push          # creates server/dev.db + applies schema
pnpm db:seed          # creates a bootstrap admin (aisha / ChangeMe123)
pnpm dev              # starts http://localhost:3000
```

Smoke test:
```bash
curl http://localhost:3000/api/health
# → { "status": "healthy", "checks": { "db": "ok" }, ... }
```

## Endpoints implemented (Feature 01 + 02 + 03 + 04)

### Feature 01 — auth

| Method | Path | Purpose |
|---|---|---|
| POST/GET | `/api/auth/[...nextauth]` | NextAuth (sign-in / sign-out / callback) |
| GET | `/api/auth/session` | Current session JSON |
| POST | `/api/auth/forgot-password` | Generate token + email |
| GET | `/api/auth/reset-password/[token]` | Validate token |
| POST | `/api/auth/reset-password` | Update password |
| GET | `/api/health` | DB + server status |

### Feature 02 — users-admin (admin only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | List users (q, role, status, page, pageSize) |
| POST | `/api/admin/users` | Create user (validates categoryIds, dup email/username) |
| GET | `/api/admin/users/[id]` | Get user + categories |
| PATCH | `/api/admin/users/[id]` | Update / deactivate / reassign categories (min-2-admin guard) |
| POST | `/api/admin/users/[id]/reset-password` | Admin-initiated reset |

### Feature 03 — categories-admin (admin only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/categories` | List (filters: type, isActive, departmentId) |
| POST | `/api/admin/categories` | Create (hex color, optional dept) |
| GET | `/api/admin/categories/[id]` | Detail (with subCategories + dept + assignedUserCount) |
| PATCH | `/api/admin/categories/[id]` | Update (incl. type swap INTAKE↔EXPENSE) |
| DELETE | `/api/admin/categories/[id]` | Soft delete (idempotent) |

### Feature 04 — sub-categories (any auth, owner-only for write)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sub-categories` | List (USER: own only; ADMIN: all or `?mine=true` for own) |
| POST | `/api/sub-categories` | Create (USER: parent must be assigned; ADMIN: any active) |
| PATCH | `/api/sub-categories/[id]` | **Rename only** — owner only. `.strict()` rejects other fields. |
| DELETE | `/api/sub-categories/[id]` | Soft delete — owner only (idempotent). Admin cannot delete user sub-cats. |

### Feature 05 — transactions (any auth; USERs see own only)

Per user request, **section 3 (PATCH with optimistic concurrency) is deferred**. The 2 endpoints below are implemented.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/transactions` | List (USER: own only; ADMIN: all / `?scope=all` / `?scope=mine`). Filters: from, to, type, categoryId, subCategoryId, status, paymentMethod, periodKey, postedById, min, max, q, page, pageSize |
| POST | `/api/transactions` | Create (idempotencyKey, scope check, type-match, budget alerts, M5 best-effort hooks) |

The schema and helper layer are M5-ready: `evaluateBudget` is a stub, `checkFuzzyDuplicate` + `checkAnomaly` are no-op stubs. When M5 lands, drop in the real implementations without changing the routes.

### Feature 06 — close-day (USER: own; ADMIN: any with reason)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/close-day?date=YYYY-MM-DD` | Check if day is closed for user (USER: own; ADMIN: any with `?userId=`) |
| POST | `/api/close-day` | User closes own day (backdating: 7 days USER / 365 days ADMIN) |
| POST | `/api/admin/close-day/[userId]` | Admin closes on behalf — `reason` field required (≥20 chars) |

All 5 payment methods (CASH, BANK, JAZZCASH, EASYPAISA, CARD) are required in `countedByMethod` (strict schema). Closing a day does NOT lock transactions (period lock is M5).

### Feature 07 — receipts (any auth; all upload + serve)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload/receipt` | Multipart upload (field `receipt`). sharp pipeline: auto-rotate EXIF, resize ≤ 2000px, JPEG q80, strip EXIF, save under `public/uploads/receipts/{YYYY}/{MM}/{uuid}.jpg` |
| GET | `/api/receipt/[key]` | Authenticated serve (private, `Cache-Control: private, max-age=86400`). v1: any auth. M5: restrict to transaction owner + admin |

Receipts are stored locally under `public/uploads/` (ignored by git). The same `StorageAdapter` interface can be swapped for S3/Supabase in Feature 13.

### Feature 08 — admin search (ADMIN only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/search` | Admin transaction search with 9 filters (date range, categoryIds[], subCategoryIds[], description, paymentMethods[], userIds[], type, amount range, status) + pagination |

Uses the **shared** `buildTransactionWhere` from `src/lib/transactions.ts` — same builder powers F05's GET and F08's search. F08 adds: multi-value arrays, SOFT_DELETED status (maps to `isDeleted: true`), and the `description` free-text search.

Spec's POST `/api/admin/search/export` is **intentionally omitted** — F11 (exports-csv) will serve the same need. UI will call `/api/admin/exports/csv` directly when F11 lands.

### Feature 09 — dashboard (USER + ADMIN)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/dashboard?period=...` | Personal dashboard (USER or ADMIN — implicit `postedById = self`). Returns summary + topCategories + recentCloses (last 5) |
| GET | `/api/admin/dashboard?period=...` | Org-wide dashboard (ADMIN only). Adds runningBalance (all-time) + momChange (current vs same-length previous period) |

`period` ∈ {`day`, `week`, `month`, `quarter`, `year`, `custom`}. `custom` requires `startDate` + `endDate`. Calendar boundaries per spec gotcha #2 (same-length previous period, not 30-day normalized). Soft-deleted + reversed transactions excluded from all aggregations.

### Feature 10 — reports (PDF) — ADMIN only

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/reports/pdf` | Generate bank-statement PDF for the org (org-wide by default; `userIds[]` for narrow). Returns `application/pdf` with `Content-Disposition: attachment` |

**Deviation from spec**: `@react-pdf/renderer` was deferred (per [M2.md](file:///e:/usman%20opensource/financial%20management/docs/backend/features/M2.md)). Uses a hand-rolled minimal PDF generator (`src/lib/pdf.ts`) — one A4 page, ASCII streams, Helvetica only. Reuses `buildTransactionWhere` (F05/F08) + `recordAudit`. Route handler is library-agnostic — swap the generator when admin UI lands and the heavier library is acceptable.

Filters: `from` + `to` (required), `categoryIds[]`, `subCategoryIds[]`, `paymentMethods[]`, `userIds[]`, `type ∈ {all, INTAKE, EXPENSE}`, `minAmount`, `maxAmount`. Audit `report.generate` BEFORE generation (gotcha #1).

### Feature 11 — exports (CSV) — ADMIN only

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/exports/csv` | Full CSV export. Body: `{ filters: { from, to, categoryIds[], ... }, includeSoftDeleted, includeEditHistory }`. Paginated 1000-row pages. RFC 4180 + CRLF. |
| GET | `/api/admin/exports/preview?from=&to=&...` | First 10 rows as JSON for UI preview. |

**Deviation from spec**: spec omits `vendor` from CSV headers; we added it (recorded in M2.md) — admin reconciliation exports need it.

Reuses `buildTransactionWhere` (F05/F08) with new `includeSoftDeleted` option. RFC 4180 quoting (commas, quotes, newlines). Decimal amounts preserved as strings (no float drift). Filename: `fop-transactions-YYYY-MM-DD-to-YYYY-MM-DD.csv`. `Cache-Control: no-store`. Audit `export.generate` BEFORE generation (gotcha #9).

### Feature 12 — audit log (ADMIN only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/audit` | List audit entries. Filters: date range, actorId, actions[], entityTypes[], entityId. Pagination: `pageSize ∈ {10, 25, 50, 100}` per gotcha #8. |
| GET | `/api/admin/audit/[id]` | Single entry with full before/after JSON. |
| POST | `/api/admin/audit/export` | CSV export (RFC 4180 + CRLF). |

**Security**: every audit `before`/`after` goes through `redactSecrets` — known secret field names (`password`, `passwordHash`, `token`, `secret`, `apiKey`, `privateKey`, `accessToken`, `refreshToken`) are replaced with `"[REDACTED]"` recursively in nested objects/arrays.

**Schema**: added `AuditLogArchive` for retention. `runAuditArchive()` in `src/server/cron/audit-archive.ts` moves rows older than `AUDIT_RETENTION_YEARS` (default 7) inside a transaction per gotcha #10 — no duplicate rows on crash. Callable directly today; **F14 wires it into the cron scheduler**.

### Feature 13 — storage (ADMIN only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/storage/stats` | Disk usage, file counts, oldest/newest, banner (green/yellow/red) |
| POST | `/api/admin/storage/prune` | Delete orphan receipt files. Body: `{ dryRun?: bool }`. Mutex + audit. |

**Matching strategy**: receiptUrl is a free-form URL — F13 matches disk files ↔ DB references by **basename** (UUID filenames make collisions unlikely). No constraints on URL form.

`STORAGE_CAP_BYTES` env var defaults to 10 GB. Banners: yellow at 80%, red at 95%. Local-only (no Supabase/S3 stubs per project state). Cron stub: `runStoragePrune()` in `src/server/cron/storage-prune.ts` callable directly; F14 wires the scheduler. Audit `storage.prune` is written on real delete (not on dry-run).

### Feature 14 — cron registry + scheduler (ADMIN only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/cron` | List all 9 registered jobs + their recent runs |
| POST | `/api/admin/cron/[jobName]/run` | Manually trigger a job (writes `JobRun` + audit row) |

**Scheduler**: `src/server/cron/index.ts` registers all enabled jobs via `node-cron` with `tz=Asia/Karachi`. On boot it sweeps stale RUNNING rows (>1h) to FAILED (per gotcha #2).

**Registry** (`src/server/cron/registry.ts`) holds the 9-job array:
- `recurring-post` (Hourly), `budget-check` (handler), `anomaly-detect` (handler), `missing-close-check` (Daily 23:30, **disabled**), `audit-archive` (Monthly 1st 03:00), `storage-prune` (Weekly Sun 03:00), `backup` (Daily 02:00), `backup-verify` (Weekly Sun 04:00), `period-lock` (Monthly 1st 00:00).

`audit-archive` + `storage-prune` are wired to real implementations; others are stubs until their feature ships.

### Feature 15 — budgets (ADMIN only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/budgets?period=YYYY-MM` | List budgets with computed `currentSpend`, `percentUsed`, `warningLevel` |
| POST | `/api/admin/budgets` | Create one (unique on `(categoryId, periodKey)`) |
| GET | `/api/admin/budgets/[id]` | Single budget with computed fields |
| PATCH | `/api/admin/budgets/[id]` | Update `amount` and/or `isActive` (categoryId + periodKey immutable) |
| DELETE | `/api/admin/budgets/[id]` | Soft delete (reversible via PATCH) |

**Helpers**:
- `currentPeriodKey()` in `src/lib/period.ts` — `"YYYY-MM"` in `Asia/Karachi` tz
- `parseDecimal()` in `src/lib/money.ts` — strict 2-decimal enforcement
- `evaluateBudget(tx, categoryId, periodKey, newAmount)` in `src/lib/budgets.ts` — sums EXPENSE spend, fires `BUDGET_THRESHOLD_80` / `BUDGET_EXCEEDED_100` Alerts (idempotent per gotcha #4)

**Schema**: 2 new tables — `Budget` (unique on `(categoryId, periodKey)`), `Alert` (idempotency index on `(categoryId, periodKey, type, isRead)`). F15 ships the API + helper, ready for F05 (transaction create) to call `evaluateBudget` as a hook. Audit actions: `budget.create`, `budget.update`, `budget.soft_delete`.

### Feature 18 — notifications (USER + ADMIN)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/notifications` | Current user's alerts (paginated, filterable by `isRead` + `type`) |
| GET | `/api/notifications/unread-count` | Bell badge count |
| PATCH | `/api/notifications/[id]` | Mark one alert read/unread (with ownership check) |
| POST | `/api/notifications/read-all` | Bulk-mark all current user's unread as read |

**Auth**: `requireSession` — any logged-in user, but only sees their own alerts (`recipientId` filter, per spec gotcha #1).

**Schema**: `Alert` extended with `recipientId` (FK → User, Cascade). 5 supported types: `BUDGET_THRESHOLD_80`, `BUDGET_EXCEEDED_100`, `ANOMALY_AMOUNT`, `MISSING_DAILY_CLOSE`, `PERIOD_NOT_CLOSED`. First 2 are fired by F15's `evaluateBudget` (fans out one Alert per category owner via `UserCategory`).

**F18 also wired F15**:
- `evaluateBudget` accepts both signatures: legacy F05 form `({categoryId, amount, occurredAt, postedById})` and the new 4-arg form `(tx, categoryId, periodKey, amount)`.
- Payload now includes `categoryName` for `deriveTitle`/`deriveMessage` in the serializer.
- F05's stale `Array.isArray(j.alerts)` test assertion updated to `j.alerts !== undefined` (evaluateBudget now returns `{percentUsed, warningLevel, budgetId}` not array).

### Feature 19 — health checks (public)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Uptime/load-balancer probe — 3 parallel checks |

**3 checks** (all run in `Promise.all` per gotcha #7 < 500ms):
1. **db** — `SELECT 1` (cheapest possible ping, gotcha #2)
2. **storage** — write+delete `.health-check` file in `public/uploads/` (gotcha #3)
3. **lastBackupAge** — query `JobRun` for last `backup` job's `startedAt`. Returns `"never"` if none, `"N hours"`/`"N days"` if recent, `"error"` if >48h

**Status logic** (per spec):
- 0 errors → `healthy` (200)
- 1 error → `degraded` (503)
- 2+ errors → `unhealthy` (503)

**No auth** (gotcha #1). `Cache-Control: no-store` via `dynamic = 'force-dynamic'` (gotcha #5). No sensitive info leaked (gotcha #8).

**Deviation from spec §1.2**: uses `JobRun` table instead of `BACKUP_DIR` filesystem scan — because F14's `backup` cron is still a stub and never writes files. When F14 becomes real, swap the query source.

| Action | When |
|---|---|
| `auth.login` | Successful NextAuth sign-in |
| `auth.logout` | NextAuth signout |
| `auth.password_reset_request` | User or admin-initiated reset |
| `auth.password_reset_complete` | `POST /reset-password` success |
| `user.create` / `user.update` / `user.deactivate` | `/api/admin/users` |
| `category.assign` | `PATCH` when categoryIds change |
| `category.create` / `category.update` / `category.soft_delete` | `/api/admin/categories` |
| `subcategory.create` / `subcategory.rename` / `subcategory.soft_delete` | `/api/sub-categories` |
| `transaction.create` | `POST /api/transactions` |
| `dayclose.create` | `POST /api/close-day` (user) |
| `dayclose.create_by_admin` | `POST /api/admin/close-day/[userId]` |
| `report.generate` | `POST /api/admin/reports/pdf` (audit BEFORE generation) |
| `export.generate` | `POST /api/admin/exports/csv` (audit BEFORE generation) |

Feature 07 (receipts) deliberately emits no audit log per spec § 1.6 — the
`transaction.create` audit row already covers the use of any receipt key.

All audit rows are written **inside the same DB transaction** as the mutation.
Summary: `pnpm exec tsx audit-summary.ts`.

## Smoke tests

There are two ways to run the smoke tests:

### A) Run them all (recommended)

```bash
# Start dev server (must include RATE_LIMIT_DISABLED=1 — see server/.env)
cd server && pnpm dev

# In another terminal, run every feature test
cd server && pnpm test:all
# → 463/463 across all 12 features, in ~78s
```

The orchestrator (`server/tests/_run-all.mjs`):
- Cleans the DB + resets the admin password between tests
- Runs each feature's test in order (01 → 12)
- Warms up routes (hits each one once to absorb Next.js dev-mode cold-compile)
- Retries up to 3× on cold-compile failures
- Prints a per-file pass/fail summary
- Exits non-zero if any test fails

### B) Run them individually

```bash
# Each test needs a clean DB first:
pnpm exec tsx clean-test-categories.ts
pnpm exec tsx clean-test-users.ts
pnpm exec tsx clean-test-transactions.ts
pnpm exec tsx reset-admin.ts

# Then run one test:
node server/test-api.mjs                  # → 18/18   (auth)
node server/test-users-api.mjs            # → 36/36   (users-admin)
node server/test-categories-api.mjs       # → 41/41   (categories-admin)
node server/test-subcategories-api.mjs    # → 48/48   (sub-categories)
node server/test-transactions-api.mjs     # → 42/42   (transactions)

# Feature 06
node server/test-close-day-api.mjs        # → 37/37   (close-day)

# Feature 07
node server/test-receipts-api.mjs         # → 35/35   (receipts)

# Feature 08
node server/test-search-api.mjs           # → 35/35   (admin search)

# Feature 09
node server/test-dashboard-api.mjs        # → 39/39   (dashboard)

# Feature 10
node server/test-pdf-api.mjs              # → 31/31   (reports PDF)

# Feature 11
node server/test-exports-api.mjs          # → 46/46   (exports CSV + preview)

# Feature 12
node server/test-audit-api.mjs            # → 55/55   (audit log admin + redaction + archive)

# Feature 13
node server/test-storage-api.mjs          # → 47/47   (storage stats + prune + cron stub)

# Feature 14
node server/test-cron-api.mjs             # → 45/45   (cron registry + manual run + scheduler)

# Feature 15
node server/test-budget-api.mjs            # → 46/46   (budgets admin + evaluateBudget + alerts)

# Feature 18
node server/test-notification-api.mjs        # → 48/48   (notifications admin + recipientId isolation)

# Feature 19
node server/test-health-api.mjs               # → 38/38   (health: db + storage + lastBackupAge)
```

**Total: 648/648 across all seventeen features.**

The numbered copies in `server/tests/NN-name.mjs` are the same files; either path works.

### Why the rate-limit env var matters

The in-memory rate limiter is per-process. When running the tests sequentially, the failed-login counters from one test would block logins in the next. The `RATE_LIMIT_DISABLED=1` env var (already set in `server/.env`) makes the limiter a no-op, giving the tests a clean slate.

## Schema summary

- `User` — admin / regular user
- `Department` — 5 seeded: PRIVATE, FINANCIAL, EATING, KITCHEN, CAFE
- `Category` — top-level, (name, type, departmentId) unique
- `SubCategory` — placeholder (Feature 04 will own)
- `UserCategory` — which categories a USER can post under
- `PasswordResetToken` — 1h expiry, single-use
- `AuditLog` — immutable

## Rate limiting

In-memory, 5 failed logins per 15 min per IP. Swap `src/lib/rate-limit.ts` to
Redis for multi-instance prod.

## CORS

`VITE_ORIGIN` (default `http://localhost:5173`) is the only allowed origin.

## Next steps (Feature 04)

When you confirm Feature 03 passes, the next step is
`docs/backend/features/04-sub-categories.md` — sub-category CRUD per user.
