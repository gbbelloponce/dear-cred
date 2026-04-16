# CLAUDE.md — apps/api

> See root `CLAUDE.md` for business logic (loan creation, partial payments, overdue/freeze/nullify rules), DB schema, all API routes, and the full datetime/timezone strategy. Consult it before implementing any domain logic or adding a new route.

---

## Commands

```bash
bun run dev            # start dev server with hot reload (--hot)
bun test               # run all tests
bun test <path>        # run a single test file
bun run typecheck      # TypeScript type-check without emitting

# Database (run from apps/api/)
bun run db:migrate:dev    # create migration SQL file only — never touches the DB
bun run db:migrate:prod   # apply pending migrations to production (uses .env.prod)
bun run db:generate       # regenerate Prisma client after schema changes
bun run db:studio         # open Prisma Studio
```

> **Migration rules — read carefully:**
> - Never run `prisma migrate dev` (without `--create-only`), `prisma db execute`, or `prisma db push` directly — these hit the production Supabase DB and can prompt a destructive reset.
> - Never manually patch the `_prisma_migrations` table.
> - Always use the two-step workflow: `db:migrate:dev` to create the SQL file, then `db:migrate:prod` to apply it.
> - After any schema change, run `db:generate` to regenerate the Prisma client.

---

## Env Files

- `.env` — development credentials (gitignored)
- `.env.prod` — production credentials (gitignored); used exclusively by `db:migrate:prod`
- Never commit either file

**Required variables:**
```
DATABASE_URL=postgresql://...          # Supabase pooler URL (port 6543) — runtime queries
DIRECT_URL=postgresql://...            # Supabase direct URL (port 5432) — migrations only
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_CRON_SECRET=...               # validates x-internal-secret header on /internal/process-overdue
PORT=3000
```

**Prisma `schema.prisma` must declare both URLs:**
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## Code Architecture

### Entry Point

`src/index.ts` — creates the Hono app, applies CORS, registers all route modules, attaches the global error handler from `middleware/error.ts`. All routes except `/auth` and `/internal` are protected by `authMiddleware`.

### Prisma Schema

Lives in `src/shared/db/` split across multiple `.prisma` files under `models/` (clients, loans, installments, payments, enums). The main `schema.prisma` uses the `prismaSchemaFolder` preview feature to pull them all in. Generated client is at `src/shared/db/generated/`.

### Library Utilities

**`src/lib/dateUtils.ts`** — all due-date math. Dates are stored at `02:55 UTC` (= `23:55 ARG`). `computeDueDates` generates all installment due dates and handles Sunday avoidance. For `DAILY`, Sunday shifts cascade; for other frequencies each date is evaluated independently. `computeNextDueDate` appends penalty installments one at a time.

**`src/lib/paymentUtils.ts`** — two pure functions with no DB calls:
- `determinePaymentStatus(amount, installmentAmount, effectiveDate, dueDate)` → `PAID`, `LATE_PAID`, or `PARTIALLY_PAID`. Partial check runs first.
- `recalculateStatusAfterVoid(payments, voidedId, installmentAmount, dueDate, now)` → filters out the voided payment and re-derives status from remaining payments. Returns `PENDING`, `OVERDUE`, `PARTIALLY_PAID`, `PAID`, or `LATE_PAID`.

**`src/lib/loanService.ts`** — side-effectful helpers that run DB operations:
- `appendPenaltyInstallment(tx, ...)` — appends one penalty installment; always takes a Prisma transaction handle.
- `checkLoanCompletion(loanId)` — reads all installments; marks loan `COMPLETED` if all are `PAID` or `LATE_PAID`.
- `restoreActiveLoanStatus(loanId)` — if a loan is `OVERDUE` but has no remaining `OVERDUE` installments, reverts it to `ACTIVE`. Called after voiding a payment.

**`src/lib/types.ts`** — defines `AppEnv` (Hono context type with `user` from Supabase), used in every route and middleware file.

### Route Pattern

Routes use `app.use('path/*', authMiddleware)` to protect a path prefix, then `app.get/post/patch/delete(...)` for individual handlers. Validation uses Zod inline within each handler — no shared schema files. Prisma calls are made directly in route handlers; only logic reused across routes is extracted into `lib/`.

### Error Handling

`middleware/error.ts` maps Prisma error codes to HTTP status codes (P2002 → 409, P2025 → 404) and catches Hono `HTTPException`. Unknown errors log to console and return 500.

---

## Scheduled Job

**Service:** cron-job.org (free tier)
**Schedule:** Daily at 02:58 UTC (23:58 ARG)
**Endpoint:** `POST /internal/process-overdue`
**Auth:** `x-internal-secret` header validated against `INTERNAL_CRON_SECRET` — return 401 immediately if mismatch
**Optional body:** `{ "asOf": "<ISO datetime>" }` — overrides `now()` for manual testing without waiting for 02:58 UTC

**cron-job.org config:**
- URL: `https://api-production-e92a.up.railway.app/internal/process-overdue`
- Method: `POST`
- Custom header: `x-internal-secret: <your secret>`
- Schedule: daily at 02:58 UTC

---

## Tests

Tests live in `src/__tests__/` and use Bun's native test runner (`bun:test`). All existing tests cover pure functions in `lib/` — no DB or HTTP mocking. When adding tests, follow the same pattern: test pure utility functions, not HTTP handlers.