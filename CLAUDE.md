# Dear-Cred — Loan & Installment Management System

## Project Overview

Web app for managing personal loans and installment payments for a small lending business.
Single admin user (expandable in the future). ~30 active clients initially.
UI is in **Spanish**. Code (variables, functions, types, comments) is in **English**.

---

## Deployed URLs

| Service  | URL                                              |
|----------|--------------------------------------------------|
| Frontend | https://dear-cred-ui.vercel.app                  |
| API      | https://api-production-e92a.up.railway.app       |

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Runtime    | Bun                                               |
| Frontend   | React 19 + Vite + TypeScript                      |
| Routing    | React Router v7 (SPA mode, `createBrowserRouter`) |
| UI         | shadcn/ui (Maia style, Neutral theme)             |
| Icons      | hugeicons (`@hugeicons/react`)                    |
| Font       | Figtree (`@fontsource-variable/figtree`)          |
| Styling    | TailwindCSS v4 (via `@tailwindcss/vite`)          |
| Backend    | Hono + TypeScript (Bun runtime)                   |
| Database   | PostgreSQL via Supabase                           |
| ORM        | Prisma                                            |
| Auth       | Supabase Auth (email + password)                  |

---

## Monorepo Structure

```
dear-cred/
├── apps/
│   ├── ui/                        # React + Vite frontend
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/
│   │   │   │   ├── ui/             # shadcn/ui components (auto-generated, do not edit manually)
│   │   │   │   └── ...             # app-specific shared components
│   │   │   ├── lib/
│   │   │   │   └── utils.ts        # cn() helper and other utils
│   │   │   ├── hooks/              # custom React hooks
│   │   │   ├── services/           # fetch wrappers for API calls
│   │   │   ├── router.tsx          # createBrowserRouter + RouterProvider
│   │   │   ├── pages/              # one file per route
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Clientes.tsx
│   │   │   │   ├── ClienteDetalle.tsx
│   │   │   │   ├── ClienteNuevo.tsx
│   │   │   │   ├── PrestamoNuevo.tsx
│   │   │   │   └── Dashboard.tsx
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   ├── components.json         # shadcn config
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tsconfig.app.json
│   │   ├── tsconfig.node.json
│   │   └── package.json
│   └── api/                        # Hono backend (Bun runtime)
│       ├── src/
│       │   ├── routes/             # one file per resource
│       │   ├── middleware/         # auth middleware, error handler
│       │   ├── lib/                # Prisma client instance, utils
│       │   └── index.ts
│       └── package.json
└── packages/
    └── shared/                     # shared TypeScript types
        └── src/
            └── types.ts
```

---

## Frontend — Key Setup Details

**Initialized with:**
```bash
bunx --bun shadcn@latest create --preset "https://ui.shadcn.com/init?base=radix&style=maia&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=figtree&menuAccent=subtle&menuColor=default&radius=default&template=vite&rtl=false" --template vite
```

**Path alias:** `@/` maps to `./src/` (configured in `vite.config.ts` and both `tsconfig.json` files)

**Styling:** TailwindCSS v4 — no `tailwind.config.js` file exists or should be created. All theme customization lives in `index.css`.

**shadcn/ui:**
- Style: Maia / Neutral theme
- Components live in `src/components/ui/` — never edit these manually, always use `bunx shadcn@latest add <component>`
- `components.json` at project root controls shadcn config
- Uses `@base-ui/react` and `radix-ui` as primitive layers

**Icons:** `@hugeicons/react` — use HugeIcons throughout the app, not lucide-react
```tsx
import { Home01Icon } from '@hugeicons/react'
<Home01Icon size={20} />
```

**Font:** Figtree variable font via `@fontsource-variable/figtree` — already imported in `index.css`

**Key installed packages:**
```
react 19, react-dom 19
@tailwindcss/vite, tailwindcss v4
shadcn, radix-ui, @base-ui/react
class-variance-authority, clsx, tailwind-merge
tw-animate-css
@hugeicons/react, @hugeicons/core-free-icons
@fontsource-variable/figtree
```

**vite.config.ts:**
```typescript
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
```

**Routing (React Router v7, SPA classic mode):**
```tsx
// src/router.tsx
import { createBrowserRouter, RouterProvider } from 'react-router'
// Define routes here with createBrowserRouter, export RouterProvider
```
- All routes are defined programmatically in `src/router.tsx`
- No file-based routing
- Auth guard: protected routes check Supabase session, redirect to `/login` if unauthenticated

---

## Backend — Key Setup Details

**Runtime:** Bun
**Framework:** Hono
**Entry point:** `src/index.ts`

**Env variables (`apps/api/.env`):**
```
DATABASE_URL=postgresql://...          # Supabase pooler URL (port 6543) for queries
DIRECT_URL=postgresql://...            # Supabase direct URL (port 5432) for migrations
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
INTERNAL_CRON_SECRET=...               # Secret for /internal/process-overdue
PORT=3000
```

**Env variables (`apps/web/.env`):**
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

**Prisma note:** requires both `DATABASE_URL` (pooler, port 6543) and `DIRECT_URL` (direct, port 5432) in `schema.prisma`:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## Database Schema (Prisma)

```prisma
model Client {
  id        String    @id @default(cuid())
  firstName String
  lastName  String
  phone     String
  address   String
  dni       String    @unique
  notes     String?
  createdAt DateTime  @default(now())
  deletedAt DateTime?            // null = active; set = soft-deleted
  loans     Loan[]
}

model Loan {
  id                String        @id @default(cuid())
  clientId          String
  principal         Float
  interestRate      Float
  totalAmount       Float         // principal * (1 + interestRate / 100)
  installmentAmount Float         // totalAmount / installmentCount
  installmentCount  Int           // original count, does not change when penalties are added
  frequency         Frequency
  startDate         DateTime
  status            LoanStatus
  createdAt         DateTime      @default(now())
  client            Client        @relation(fields: [clientId], references: [id])
  installments      Installment[]
}

model Installment {
  id              String            @id @default(cuid())
  loanId          String
  number          Int               // sequential order (1, 2, 3...) including penalties
  dueDate         DateTime
  amount          Float             // always = loan.installmentAmount
  status          InstallmentStatus
  isPenalty       Boolean           @default(false)
  penaltySourceId String?           // id of the installment that triggered this penalty
  createdAt       DateTime          @default(now())
  loan            Loan              @relation(fields: [loanId], references: [id])
  payments        Payment[]
}

model Payment {
  id            String        @id @default(cuid())
  installmentId String
  amount        Float
  paymentDate   DateTime      @default(now())
  method        PaymentMethod
  isVoided      Boolean       @default(false)
  installment   Installment   @relation(fields: [installmentId], references: [id])
}

enum Frequency {
  DAILY
  WEEKLY
  FORTNIGHTLY
  MONTHLY
}

enum LoanStatus {
  ACTIVE
  COMPLETED
  OVERDUE
  NULLIFIED  // admin-cancelled loan
  FROZEN     // payments paused by admin; overdue cron skipped; debt still counted
}

enum InstallmentStatus {
  PENDING        // not yet due, no payment
  PAID           // paid in full on or before due date
  PARTIALLY_PAID // partial payment registered — balance owed, no carry-over to next installment
  LATE_PAID      // paid in full after due date, or partial balance fully resolved
  OVERDUE        // due date passed with no payment at all
}

enum PaymentMethod {
  CASH
  TRANSFER
}
```

---

## Core Business Logic

### Loan Creation
1. `totalAmount = principal * (1 + interestRate / 100)`
2. `installmentAmount = totalAmount / installmentCount`
3. Generate all installments upfront with sequential due dates based on `frequency` + `startDate`
4. A client can only have **one ACTIVE loan at a time**

### Installment Status Transitions
```
PENDING → PAID           (full payment on or before due date)
PENDING → PARTIALLY_PAID (partial payment registered)
PENDING → OVERDUE        (due date passed, no payment — set by cron)
PARTIALLY_PAID → LATE_PAID (remaining balance fully paid)
OVERDUE → LATE_PAID      (paid in full after being overdue)
```

### Overdue Logic (triggered by cron)
- Find all `PENDING` installments where `dueDate < now()`
- Mark them `OVERDUE`
- For each one: append one penalty installment at end of plan (`isPenalty: true`, same `installmentAmount`, `number = last + 1`)
- Update loan `status` to `OVERDUE` if not already
- One penalty per overdue event only

### Partial Payment Logic
- Admin registers payment with `amount < installment.amount` → status becomes `PARTIALLY_PAID`
- **Immediately** append one penalty installment to end of plan
- The partial balance is **not carried over** to the next installment
- Each installment keeps its original `amount`
- A `PARTIALLY_PAID` installment can only be fully resolved (pay remaining balance) → becomes `LATE_PAID`
- **No second partial payment allowed** on a `PARTIALLY_PAID` installment

### Loan Completion
- Loan becomes `COMPLETED` only when **all** installments (including penalties) are `PAID` or `LATE_PAID`
- UI must clearly surface any pending `PARTIALLY_PAID` installments so admin can collect before closing

### Payment Registration
- Every payment stores: `amount`, `paymentDate`, `method` (CASH | TRANSFER)
- Multiple `Payment` rows can exist per installment (partial + later full resolution)

### Loan Nullification
- Only `ACTIVE` or `OVERDUE` loans can be nullified
- Sets loan `status` to `NULLIFIED`
- Optional `{ voidPayments: true }` body bulk-sets `isVoided: true` on all non-voided payments for that loan (done in a single transaction)
- Nullified loans are excluded from all dashboard queries (`totalOwed`, `overdueClients`, `debtPerClient`)
- `collectedThisMonth` and `cashVsTransfer` already filter `isVoided: false`, so voided payments are automatically excluded
- No payments or installment modifications can be made on a NULLIFIED loan

### Payment Voiding
- Any non-voided payment on an ACTIVE or OVERDUE loan can be manually voided
- After voiding, installment status is recalculated from remaining non-voided payments
- If no valid payments remain, installment may revert to `OVERDUE` (if past due date) or `PENDING`
- Loan status is updated accordingly (may revert to `OVERDUE` if an installment becomes OVERDUE)

### Penalty Installment Deletion
- Only `PENDING` penalty installments on non-COMPLETED, non-NULLIFIED loans can be deleted
- After deletion, all subsequent installment `number` values are decremented by 1 to keep the sequence contiguous
- After renumbering, loan completion and status are re-evaluated

### Loan Freeze
- Admin can freeze an `ACTIVE` or `OVERDUE` loan → status becomes `FROZEN`
- **Overdue cron skips FROZEN loans** — no installments marked OVERDUE, no penalties appended
- **Payments are still allowed** on a FROZEN loan
- **Nullification is allowed** on a FROZEN loan
- **A new loan cannot be created** for a client with a FROZEN loan (same guard as ACTIVE/OVERDUE)
- Any OVERDUE installments that existed before freezing remain OVERDUE — freeze doesn't clear them
- **Unfreezing:** if any installment is currently OVERDUE → loan reverts to `OVERDUE`; otherwise → `ACTIVE`
- FROZEN loan debt appears in `totalOwed` and `debtPerClient` — the money is still owed
- FROZEN loans with OVERDUE installments appear in `overdueClients`

### Client Soft Delete
- Clients are never hard-deleted — `deletedAt` is set to the current timestamp
- **Guard:** clients with an `ACTIVE` or `OVERDUE` loan cannot be deleted; admin must nullify the loan first
- Soft-deleted clients are excluded from:
  - The client list (`GET /clients` filters `deletedAt: null` by default; pass `?includeDeleted=true` to include them)
  - All dashboard debt/overdue metrics: `totalOwed`, `overdueClients`, `onTimeRate`, `debtPerClient`
  - The overdue cron (their installments are not processed)
- Soft-deleted clients are **included** in `collectedThisMonth` and `cashVsTransfer` — payments already received still count
- Deleted clients can be viewed read-only by navigating to `/clientes/:id` directly
- The client list has an "Eliminados" toggle that reveals soft-deleted clients in a separate dashed section

---

## API Routes (REST)

```
POST   /auth/login
POST   /auth/logout

GET    /clients                       # list with active loan summary (excludes soft-deleted by default)
GET    /clients?includeDeleted=true   # list including soft-deleted clients
POST   /clients                       # create client
GET    /clients/:id                   # detail + full loan history (works for deleted clients too)
PUT    /clients/:id                   # edit client
DELETE /clients/:id                   # soft-delete client (sets deletedAt); blocked if active/overdue loan exists

GET    /clients/:id/loans             # loan history
POST   /clients/:id/loans             # create loan (only if no active loan)
GET    /loans/:id                     # loan detail with all installments

POST   /installments/:id/payments     # register full or partial payment
PATCH  /installments/:id/resolve      # fully resolve a PARTIALLY_PAID installment
DELETE /installments/:id              # delete a PENDING penalty installment (renumbers subsequent)

POST   /loans/:id/nullify             # nullify ACTIVE, OVERDUE, or FROZEN loan; optional body { voidPayments?: boolean }
POST   /loans/:id/freeze              # freeze ACTIVE or OVERDUE loan → FROZEN
POST   /loans/:id/unfreeze            # unfreeze FROZEN loan → ACTIVE or OVERDUE (based on installment states)
POST   /payments/:id/void             # void a single payment; recalculates installment status

GET    /dashboard                     # aggregated business metrics

POST   /internal/process-overdue      # called by cron-job.org — requires x-internal-secret header; optional body { asOf: ISO string } to simulate a specific time
```

---

## DateTime & Timezone Strategy

**Argentina timezone:** `America/Argentina/Buenos_Aires` → UTC-3, permanently (no DST since 2008)
**Conversion rule:** Argentina time = UTC − 3h → e.g. 5:00 PM ARG = 20:00 UTC

### Due Dates
All installment due dates are stored in PostgreSQL as UTC timestamps at **02:55 UTC the next calendar day** (= 23:55 ARG).
e.g. April 8 ARG deadline → stored as `2026-04-09T02:55:00Z`.
Computed via `Date.UTC(y, m, d + 1, 2, 55, 0)` in `dateUtils.ts` (the `+1` pushes to the next UTC day).
This means: on the calendar day of the due date, the client has until 11:55 PM local time to pay.

### Cron Job Timing
The cron runs at **02:58 UTC = 23:58 ARG** — 3 minutes after the client deadline.
At that moment: `now()` = 02:58 UTC > 02:55 UTC (today's due dates) → the overdue query fires correctly.
Query: `WHERE status = 'PENDING' AND dueDate < now()` catches all today's unpaid installments.

### Payment Date Comparison
In `installments.ts`, `effectiveDate > installment.dueDate` determines PAID vs LATE_PAID.
`effectiveDate` is either the provided `paymentDate` (ISO string → UTC) or `new Date()` (server UTC).

### Frontend Display
`fmtDate` subtracts 3h from the stored UTC timestamp before extracting date components, converting back to ARG calendar date.
e.g. `2026-04-09T02:55:00Z` − 3h = `2026-04-08T23:55:00Z` → displays "8/4/2026".

---

## Scheduled Jobs

**Service:** [cron-job.org](https://cron-job.org) (free tier)
**Schedule:** Daily at 02:58 UTC (23:58 ARG / UTC-3)
**Endpoint:** `POST /internal/process-overdue`
**Auth:** `x-internal-secret` header validated against `INTERNAL_CRON_SECRET` env var — return 401 immediately if mismatch

**Optional body:** `{ "asOf": "<ISO datetime>" }` — overrides the reference time used for the overdue query. Defaults to `new Date()` when omitted. Useful for manual testing during the day without waiting for 02:58 UTC.

**cron-job.org setup:**
- URL: `https://api-production-e92a.up.railway.app/internal/process-overdue`
- Method: `POST`
- Custom header: `x-internal-secret: <your secret>`
- Schedule: daily at 02:58 UTC

---

## Dashboard Metrics (`GET /dashboard`)

| Key                | Description                                              |
|--------------------|----------------------------------------------------------|
| `totalOwed`        | Sum of all pending balances across all active loans (excludes soft-deleted clients) |
| `collectedThisMonth` | Sum of all non-voided payments in the current calendar month (**includes** payments from soft-deleted clients — money was received) |
| `overdueClients`   | Clients with at least one OVERDUE installment (excludes soft-deleted clients)       |
| `onTimeRate`       | % of clients with no overdue installments (excludes soft-deleted clients)           |
| `cashVsTransfer`   | Total collected split by payment method (**includes** payments from soft-deleted clients) |
| `debtPerClient`    | Remaining debt breakdown per client (excludes soft-deleted clients)                 |

---

## Frontend Pages

| Route                              | Page                                        |
|------------------------------------|---------------------------------------------|
| `/login`                           | Login form (Supabase Auth)                  |
| `/`                                | Redirect to `/clientes`                     |
| `/clientes`                        | Client list with active loan status         |
| `/clientes/nuevo`                  | Create client form                          |
| `/clientes/:id`                    | Client detail: info, active loan, history   |
| `/clientes/:id/prestamo/nuevo`     | Create new loan for client                  |
| `/dashboard`                       | Business metrics overview                   |

---

## Auth

- **Supabase Auth** — email + password
- Frontend: Supabase JS client manages session
- Backend: Hono middleware validates Supabase JWT on every protected route
- All routes except `/auth/login` and `/login` require valid session
- Single admin user — create directly from Supabase Auth dashboard (no signup flow in app)

---

## Key Constraints & Rules Summary

- One active loan per client at a time
- Installment amounts are always fixed (same amount for all installments including penalties)
- Partial payments do NOT carry balance to the next installment
- Each partial payment triggers one penalty installment appended at end of plan
- Each overdue event (cron) triggers one penalty installment appended at end of plan
- `PARTIALLY_PAID` installments can only be fully resolved — no second partial allowed
- Loan is `COMPLETED` only when all installments are `PAID` or `LATE_PAID`
- Voided payments (`isVoided: true`) are excluded from all dashboard collected/cashVsTransfer stats
- NULLIFIED loans are excluded from all dashboard debt/overdue stats
- Soft-deleted clients (`deletedAt` set) are excluded from debt/overdue dashboard stats and the overdue cron, but their payments still count in `collectedThisMonth` and `cashVsTransfer`
- FROZEN loans are excluded from the overdue cron but included in all dashboard debt metrics
- No payments or installment changes allowed on COMPLETED or NULLIFIED loans
- Penalty installments track their source via `penaltySourceId` (nullable FK to the installment that triggered the penalty)
- No file uploads — notes/observations are plain text only
- UI language: **Spanish**
- Code language: **English**

---

## Development Commands

```bash
# Frontend
bun install
bun run dev           # Vite dev server on port 3000 (or configured port)
bun run build
bun run lint

# Backend
bun install
bun run dev           # Hono dev server

# Database (run from apps/api/)
bun run db:migrate:dev        # creates migration SQL file only — NEVER touches the DB
bun run db:migrate:prod       # applies pending migrations to production (uses .env.prod)
bun run db:generate           # regenerate Prisma client after schema changes
bun run db:studio             # local DB browser
```

> **IMPORTANT — migration rules:**
> - **Never** run `prisma migrate dev` (without `--create-only`), `prisma db execute`, or `prisma db push` directly — these hit the production Supabase DB and can prompt a destructive reset.
> - **Never** manually patch the `_prisma_migrations` table.
> - Always use the two-step workflow: `db:migrate:dev` to create the SQL file, then `db:migrate:prod` to apply it to production.
> - After any schema change, run `db:generate` to regenerate the Prisma client.

### Dependencies

The root package.json should not contain any "dependencies", "devDependencies", etc. Each individual package should be self-contained and declare its own dependencies.

To add npm dependencies to a particular workspace, just cd to the appropriate directory and run bun add commands as you would normally. Bun will detect that you are in a workspace and hoist the dependency as needed.

```bash
cd apps/api # move to specific workspace
bun add zod # then install desired package
```