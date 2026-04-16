# Dear-Cred — Loan & Installment Management System

This is the primary reference for the entire project. All domain logic, database schema, API contracts, and datetime rules live here. Workspace-specific files (`apps/ui/CLAUDE.md`, `apps/api/CLAUDE.md`) cover implementation details only — always consult this file first when working on any domain logic or adding a new feature.

---

## Project Overview

Web app for managing personal loans and installment payments for a small lending business.
Single admin user (expandable in the future). ~30 active clients initially.
UI is in **Spanish**. Code (variables, functions, types, comments) is in **English**.

---

## Deployed URLs

| Service  | URL                                          |
|----------|----------------------------------------------|
| Frontend | https://dear-cred-ui.vercel.app              |
| API      | https://api-production-e92a.up.railway.app   |

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Runtime    | Bun                                               |
| Frontend   | React 19 + Vite + TypeScript                      |
| Routing    | React Router v7 (SPA mode, `createBrowserRouter`) |
| UI         | shadcn/ui (Maia style, Neutral theme)             |
| Icons      | HugeIcons (`@hugeicons/react`)                    |
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
│   ├── ui/                         # React + Vite frontend
│   │   ├── public/
│   │   ├── src/
│   │   │   ├── assets/
│   │   │   ├── components/
│   │   │   │   ├── ui/             # shadcn/ui — never edit manually
│   │   │   │   └── ...             # app-specific shared components
│   │   │   ├── lib/
│   │   │   │   ├── utils.ts        # cn() helper
│   │   │   │   └── date.ts         # ARG timezone helpers
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   ├── services/
│   │   │   │   └── api.ts          # all API calls + shared types
│   │   │   ├── pages/
│   │   │   │   ├── Login.tsx
│   │   │   │   ├── Clientes.tsx
│   │   │   │   ├── ClienteDetalle.tsx
│   │   │   │   ├── ClienteNuevo.tsx
│   │   │   │   ├── PrestamoNuevo.tsx
│   │   │   │   └── Dashboard.tsx
│   │   │   ├── router.tsx
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css
│   │   └── components.json
│   └── api/                        # Hono backend (Bun runtime)
│       └── src/
│           ├── routes/
│           ├── middleware/
│           ├── lib/
│           │   ├── dateUtils.ts
│           │   ├── paymentUtils.ts
│           │   ├── loanService.ts
│           │   └── types.ts
│           ├── shared/db/          # Prisma schema (split across .prisma files)
│           └── index.ts
└── packages/
    └── shared/                     # shared TypeScript types (currently unused — types live in api.ts)
```

> **Dependencies:** never add packages to the root `package.json`. Always `cd` into the target workspace first, then run `bun add`.

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
  installmentCount  Int           // original count — never changes when penalties are added
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
  FROZEN     // overdue cron skipped; payments still allowed; debt still counted
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
4. If a generated due date lands on **Sunday ARG**, shift it forward to Monday
5. For `DAILY` loans, the Sunday shift **cascades** — all subsequent installments shift too so no two share the same date
6. For `WEEKLY`, `FORTNIGHTLY`, and `MONTHLY` loans, each installment is evaluated independently — no cascade
7. A client can only have one `ACTIVE`, `OVERDUE`, or `FROZEN` loan at a time

### Installment Status Transitions
```
PENDING        → PAID           full payment on or before due date
PENDING        → PARTIALLY_PAID partial payment registered
PENDING        → OVERDUE        due date passed with no payment (set by cron)
PARTIALLY_PAID → LATE_PAID      remaining balance fully paid
OVERDUE        → LATE_PAID      paid in full after being overdue
```

### Overdue Logic (triggered by cron)
- Find all `PENDING` installments where `dueDate < now()`, skipping loans with status `FROZEN` or `COMPLETED` or `NULLIFIED`
- Mark them `OVERDUE`
- For each: append one penalty installment at end of plan (`isPenalty: true`, same `installmentAmount`, `number = last + 1`)
- Penalty due dates also follow the Sunday rule
- Update loan `status` to `OVERDUE` if not already
- One penalty per overdue event only

### Partial Payment Logic
- Admin registers payment with `amount < installment.amount` → status becomes `PARTIALLY_PAID`
- Immediately append one penalty installment to end of plan (same Sunday rule applies)
- The partial balance is **not carried over** to the next installment — each installment keeps its original `amount`
- A `PARTIALLY_PAID` installment can only be fully resolved → becomes `LATE_PAID`
- **No second partial payment allowed** on a `PARTIALLY_PAID` installment

### Loan Completion
- Loan becomes `COMPLETED` only when **all** installments (including penalties) are `PAID` or `LATE_PAID`
- UI must clearly surface any `PARTIALLY_PAID` installments before allowing closure

### Payment Registration
- Every payment stores: `amount`, `paymentDate`, `method` (CASH | TRANSFER)
- Multiple `Payment` rows can exist per installment (partial + later full resolution)

### Loan Nullification
- Only `ACTIVE`, `OVERDUE`, or `FROZEN` loans can be nullified → status becomes `NULLIFIED`
- Optional `{ voidPayments: true }` body bulk-sets `isVoided: true` on all non-voided payments (single transaction)
- Nullified loans are excluded from all dashboard debt/overdue metrics
- No payments or installment changes allowed on a `NULLIFIED` loan

### Payment Voiding
- Any non-voided payment on an `ACTIVE`, `OVERDUE`, or `FROZEN` loan can be voided
- After voiding, installment status is recalculated from remaining non-voided payments
- If no valid payments remain, installment reverts to `OVERDUE` (past due) or `PENDING`
- Loan status is updated accordingly

### Penalty Installment Deletion
- Only `PENDING` penalty installments on non-`COMPLETED`, non-`NULLIFIED` loans can be deleted
- After deletion, all subsequent `number` values are decremented by 1 to keep the sequence contiguous
- Loan completion and status are re-evaluated after renumbering

### Loan Freeze
- Admin can freeze an `ACTIVE` or `OVERDUE` loan → status becomes `FROZEN`
- **Overdue cron skips `FROZEN` loans** — no installments marked overdue, no penalties appended
- Payments are still allowed on a `FROZEN` loan
- Nullification is allowed on a `FROZEN` loan
- A new loan cannot be created for a client with a `FROZEN` loan
- Pre-existing `OVERDUE` installments remain `OVERDUE` after freezing
- **Unfreezing:** if any installment is `OVERDUE` → loan reverts to `OVERDUE`; otherwise → `ACTIVE`
- `FROZEN` loan debt appears in `totalOwed` and `debtPerClient`
- `FROZEN` loans with `OVERDUE` installments appear in `overdueClients`

### Client Soft Delete
- Clients are never hard-deleted — `deletedAt` is set to the current timestamp
- **Guard:** clients with an `ACTIVE`, `OVERDUE`, or `FROZEN` loan cannot be deleted
- Soft-deleted clients are excluded from: client list, all dashboard debt/overdue metrics, and the overdue cron
- Soft-deleted clients **are included** in `collectedThisMonth` and `cashVsTransfer` — money already received counts
- Deleted clients can be viewed read-only at `/clientes/:id`
- Client list has an "Eliminados" toggle that reveals soft-deleted clients in a separate dashed section

---

## API Routes (REST)

```
POST   /auth/login
POST   /auth/logout

GET    /clients                       # list (excludes soft-deleted by default)
GET    /clients?includeDeleted=true   # list including soft-deleted
POST   /clients                       # create client
GET    /clients/:id                   # detail + full loan history (works for deleted clients)
PUT    /clients/:id                   # edit client
DELETE /clients/:id                   # soft-delete (blocked if active/overdue/frozen loan exists)

GET    /clients/:id/loans             # loan history
POST   /clients/:id/loans             # create loan (blocked if active/overdue/frozen loan exists)
GET    /loans/:id                     # loan detail with all installments

POST   /installments/:id/payments     # register full or partial payment
PATCH  /installments/:id/resolve      # fully resolve a PARTIALLY_PAID installment
DELETE /installments/:id              # delete a PENDING penalty installment (renumbers subsequent)

POST   /loans/:id/nullify             # nullify loan; optional body { voidPayments?: boolean }
POST   /loans/:id/freeze              # freeze ACTIVE or OVERDUE loan
POST   /loans/:id/unfreeze            # unfreeze FROZEN loan → ACTIVE or OVERDUE
POST   /payments/:id/void             # void a payment; recalculates installment status

GET    /dashboard                     # aggregated business metrics

POST   /internal/process-overdue      # cron-job.org trigger — requires x-internal-secret header
                                      # optional body { asOf: ISO string } to simulate a specific time
```

---

## DateTime & Timezone Strategy

**Argentina timezone:** `America/Argentina/Buenos_Aires` → UTC−3, permanently (no DST since 2008)

### Due Date Storage
Stored in PostgreSQL as UTC at **02:55 UTC** (= 23:55 ARG) on the next calendar day.
- April 8 ARG deadline → stored as `2026-04-09T02:55:00Z`
- Computed via `Date.UTC(y, m, d + 1, 2, 55, 0)` in `dateUtils.ts`
- Clients have until 11:55 PM ARG on the due date to pay

### Sunday Handling
A stored date with `getUTCDay() === 1` means the effective ARG day is **Sunday** (because the stored UTC date is the next calendar day at 02:55).
- Sunday ARG due dates are always shifted forward to Monday
- `DAILY`: shift cascades to all subsequent installments
- `WEEKLY` / `FORTNIGHTLY` / `MONTHLY`: each installment evaluated independently, no cascade
- Applies to both regular and penalty installments

### Cron Timing
Runs at **02:58 UTC** (23:58 ARG) — 3 minutes after the client deadline.
Query: `WHERE status = 'PENDING' AND dueDate < now()` catches all today's unpaid installments.

### PAID vs LATE_PAID
`effectiveDate > installment.dueDate` → `LATE_PAID`; otherwise `PAID`.
`effectiveDate` = provided `paymentDate` (ISO → UTC) or `new Date()` (server UTC).

### Frontend Display
`fmtDate` subtracts 3h from the stored UTC timestamp before extracting date components.
`2026-04-09T02:55:00Z` − 3h = `2026-04-08T23:55:00Z` → displays "8/4/2026".

---

## Dashboard Metrics (`GET /dashboard`)

| Key                  | Description                                                                                      |
|----------------------|--------------------------------------------------------------------------------------------------|
| `totalOwed`          | Sum of all pending balances across active loans (excludes soft-deleted clients)                  |
| `collectedThisMonth` | Sum of all non-voided payments in the current calendar month (includes soft-deleted clients)     |
| `overdueClients`     | Clients with at least one OVERDUE installment (excludes soft-deleted clients)                    |
| `onTimeRate`         | % of clients with no OVERDUE installments (excludes soft-deleted clients)                        |
| `cashVsTransfer`     | Total collected split by payment method (includes soft-deleted clients)                          |
| `debtPerClient`      | Remaining debt breakdown per client (excludes soft-deleted clients)                              |

---

## Frontend Pages

| Route                              | Page                                       |
|------------------------------------|--------------------------------------------|
| `/login`                           | Login form                                 |
| `/`                                | Redirect to `/clientes`                    |
| `/clientes`                        | Client list with active loan status        |
| `/clientes/nuevo`                  | Create client form                         |
| `/clientes/:id`                    | Client detail: info, active loan, history  |
| `/clientes/:id/prestamo/nuevo`     | Create new loan for client                 |
| `/dashboard`                       | Business metrics overview                  |

---

## Key Constraints & Rules Summary

- One active/overdue/frozen loan per client at a time
- Installment amounts are always fixed — same for all installments including penalties
- Partial payments do NOT carry balance to the next installment
- Each partial payment triggers one penalty installment appended at end of plan
- Each overdue event (cron) triggers one penalty installment appended at end of plan
- `PARTIALLY_PAID` installments can only be fully resolved — no second partial allowed
- Loan is `COMPLETED` only when all installments are `PAID` or `LATE_PAID`
- Voided payments are excluded from all collected/cashVsTransfer dashboard stats
- `NULLIFIED` loans are excluded from all dashboard debt/overdue stats
- `FROZEN` loans are excluded from the overdue cron but included in all debt metrics
- Soft-deleted clients are excluded from debt/overdue stats and the cron; their payments still count in collected stats
- No payments or installment changes allowed on `COMPLETED` or `NULLIFIED` loans
- `penaltySourceId` tracks which installment triggered each penalty
- No file uploads — notes are plain text only
- UI language: **Spanish** — Code language: **English**