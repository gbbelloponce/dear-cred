# Dear-Cred — Loan & Installment Management System

## Project Overview

Web app for managing personal loans and installment payments for a small lending business.
Single admin user (expandable in the future). ~30 active clients initially.
UI is in **Spanish**. Code (variables, functions, types, comments) is in **English**.

---

## Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Runtime    | Bun                               |
| Frontend   | React + Vite + TypeScript         |
| Backend    | Hono + TypeScript (Bun runtime)   |
| Database   | PostgreSQL via Supabase            |
| ORM        | Prisma                            |
| Auth       | Supabase Auth                     |
| Styling    | TailwindCSS                       |

---

## Monorepo Structure

```
dear-cred/
├── apps/
│   ├── web/                  # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── services/     # API call functions (fetch wrappers)
│   │   │   ├── types/        # Shared TS types (imported from /packages/shared)
│   │   │   └── lib/          # supabase client, utils
│   │   └── ...
│   └── api/                  # Hono backend
│       ├── src/
│       │   ├── routes/       # One file per resource (clients, loans, installments, payments)
│       │   ├── middleware/   # Auth middleware, error handler
│       │   ├── lib/          # Prisma client instance, utils
│       │   └── index.ts      # Hono app entry point
│       └── ...
└── packages/
    └── shared/               # Shared TypeScript types and Zod schemas
        └── src/
            ├── types.ts
            └── schemas.ts
```

---

## Database Schema (Prisma)

```prisma
model Client {
  id            String    @id @default(cuid())
  firstName     String
  lastName      String
  phone         String
  address       String
  dni           String    @unique
  notes         String?
  createdAt     DateTime  @default(now())

  loans         Loan[]
}

model Loan {
  id                String        @id @default(cuid())
  clientId          String
  principal         Float         // capital prestado
  interestRate      Float         // porcentaje de interés
  totalAmount       Float         // principal + interés (calculado al crear)
  installmentAmount Float         // monto fijo por cuota = totalAmount / installmentCount
  installmentCount  Int           // cantidad de cuotas original
  frequency         Frequency     // DAILY | WEEKLY | MONTHLY
  startDate         DateTime
  status            LoanStatus    // ACTIVE | COMPLETED | OVERDUE
  createdAt         DateTime      @default(now())

  client            Client        @relation(fields: [clientId], references: [id])
  installments      Installment[]
}

// Each row = one installment in the plan (including penalty installments)
model Installment {
  id            String              @id @default(cuid())
  loanId        String
  number        Int                 // sequential order in the plan (1, 2, 3...)
  dueDate       DateTime
  amount        Float               // always equal to loan.installmentAmount
  status        InstallmentStatus   // PENDING | PAID | PARTIALLY_PAID | LATE_PAID | OVERDUE
  isPenalty     Boolean             @default(false)  // true if added as penalty
  createdAt     DateTime            @default(now())

  loan          Loan                @relation(fields: [loanId], references: [id])
  payments      Payment[]
}

// Each row = one payment event registered by the admin
model Payment {
  id              String        @id @default(cuid())
  installmentId   String
  amount          Float         // amount paid in this transaction
  paymentDate     DateTime      @default(now())
  method          PaymentMethod // CASH | TRANSFER

  installment     Installment   @relation(fields: [installmentId], references: [id])
}

enum Frequency {
  DAILY
  WEEKLY
  MONTHLY
}

enum LoanStatus {
  ACTIVE
  COMPLETED
  OVERDUE
}

enum InstallmentStatus {
  PENDING
  PAID           // paid in full on or before due date
  PARTIALLY_PAID // partial payment registered, balance still owed — no balance carry-over
  LATE_PAID      // paid in full after due date, or partial balance cleared later
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
3. Generate all installments upfront with sequential due dates based on `frequency` and `startDate`
4. A client can only have **one ACTIVE loan at a time**

### Installment Status Rules
- A daily job (or on-demand check) scans all `PENDING` installments whose `dueDate < now()` and marks them `OVERDUE`
- When an installment is marked `OVERDUE`: add one penalty installment at the end of the plan (`isPenalty: true`, same `installmentAmount`, `number = last + 1`)
- Only one penalty per overdue event

### Partial Payment Logic
- Admin registers a payment with `amount < installment.amount` → installment becomes `PARTIALLY_PAID`
- A penalty installment is **immediately** appended to the end of the plan
- The partial balance is **not carried over** to the next installment — each installment retains its original amount
- A `PARTIALLY_PAID` installment can only be resolved by paying the remaining balance in full → status becomes `LATE_PAID`
- No second partial payment is allowed on an already `PARTIALLY_PAID` installment

### Loan Completion
- A loan is `COMPLETED` only when **all** installments (including penalties) are in status `PAID` or `LATE_PAID`
- The admin should clearly see any pending `PARTIALLY_PAID` installments before closing

### Payment Registration
- Every payment records: amount, date, and method (`CASH` or `TRANSFER`)
- Multiple `Payment` rows can exist per installment (e.g., partial + final clearance)

---

## Scheduled Jobs

### Overdue Installment Processor
- **Trigger:** External HTTP call from [cron-job.org](https://cron-job.org) (free tier)
- **Schedule:** Daily at a fixed time (e.g. 00:01 AM)
- **Endpoint:** `POST /internal/process-overdue`
- **Auth:** `x-internal-secret` header checked against `INTERNAL_CRON_SECRET` env variable — if it doesn't match, return 401 immediately
- **Logic:**
  1. Find all `PENDING` installments where `dueDate < now()`
  2. Mark them as `OVERDUE`
  3. For each one, append a penalty installment at the end of its loan (`isPenalty: true`, same `installmentAmount`, `number = last + 1`)
  4. Update loan status to `OVERDUE` if not already
- **Add to env:**
  ```
  INTERNAL_CRON_SECRET=some-long-random-string
  ```
- Setup: once the API is deployed, register on cron-job.org with:
  - URL: `https://your-api-domain.com/internal/process-overdue`
  - Method: `POST`
  - Custom header: `x-internal-secret: <your secret>`
  - Schedule: daily at 00:01 AM

---

## API Routes (REST)

```
POST   /auth/login
POST   /auth/logout

GET    /clients               # list all clients with active loan summary
POST   /clients               # create client
GET    /clients/:id           # client detail + full loan history
PUT    /clients/:id           # edit client

GET    /clients/:id/loans     # loan history for a client
POST   /clients/:id/loans     # create new loan (only if no active loan)
GET    /loans/:id             # loan detail with all installments

POST   /installments/:id/payments    # register a payment (full or partial)
PATCH  /installments/:id/resolve     # resolve a PARTIALLY_PAID installment (pay remaining balance)

POST   /internal/process-overdue     # called by cron-job.org — requires x-internal-secret header

GET    /dashboard             # aggregated metrics
```

---

## Dashboard Metrics

Computed server-side at `/dashboard`:

- `totalOwed` — sum of all pending balances across all active loans
- `collectedThisMonth` — sum of all payments registered in the current calendar month
- `overdueClients` — list of clients with at least one `OVERDUE` installment
- `onTimeRate` — % of clients with no overdue installments
- `cashVsTransfer` — total collected split by payment method
- `debtPerClient` — breakdown of remaining debt per client

---

## Frontend Pages

```
/login                        # Supabase Auth login form
/                             # redirect to /clientes if authenticated
/clientes                     # client list with active loan status overview
/clientes/nuevo               # create client form
/clientes/:id                 # client detail: info, active loan, payment history
/clientes/:id/prestamo/nuevo  # create new loan for client
/dashboard                    # business metrics overview
```

---

## Auth

- Handled by **Supabase Auth** (email + password)
- Frontend: Supabase JS client manages session, stores JWT in memory/cookie
- Backend: Hono middleware validates Supabase JWT on every protected route
- All routes except `/auth/login` require a valid session
- Single admin user for now; architecture supports multiple users in the future

---

## Key Constraints & Rules Summary

- One active loan per client at a time
- Installment amounts are always fixed (same across all installments including penalties)
- Partial payments do NOT carry balance to the next installment
- Each partial payment triggers one penalty installment appended to the end
- Each overdue (unpaid past due date) also triggers one penalty installment
- `PARTIALLY_PAID` installments can only be fully resolved, not partially paid again
- Loan is only `COMPLETED` when all installments are `PAID` or `LATE_PAID`
- UI language: **Spanish**
- Code language: **English**
- No file uploads — notes/observations are plain text only

---

## Development Setup

### Prerequisites
- Bun installed (`curl -fsSL https://bun.sh/install | bash`)
- Supabase project created (get `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`)
- GitHub private repo

### Env Variables

**apps/api/.env**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3000
```

**apps/web/.env**
```
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

### Commands
```bash
bun install           # install all workspace dependencies
bun run dev:api       # start Hono API
bun run dev:web       # start Vite dev server
bun run db:migrate    # prisma migrate dev
bun run db:studio     # prisma studio (local DB browser)
```


### Dependencies

The root package.json should not contain any "dependencies", "devDependencies", etc. Each individual package should be self-contained and declare its own dependencies.

To add npm dependencies to a particular workspace, just cd to the appropriate directory and run bun add commands as you would normally. Bun will detect that you are in a workspace and hoist the dependency as needed.

```bash
cd apps/api # move to specific workspace
bun add zod # then install desired package
```