# Dear-Cred — Loan & Installment Management System

## Project Overview

Web app for managing personal loans and installment payments for a small lending business.
Single admin user (expandable in the future). ~30 active clients initially.
UI is in **Spanish**. Code (variables, functions, types, comments) is in **English**.

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
│   ├── web/                        # React + Vite frontend
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
  id        String   @id @default(cuid())
  firstName String
  lastName  String
  phone     String
  address   String
  dni       String   @unique
  notes     String?
  createdAt DateTime @default(now())
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
  id        String            @id @default(cuid())
  loanId    String
  number    Int               // sequential order (1, 2, 3...) including penalties
  dueDate   DateTime
  amount    Float             // always = loan.installmentAmount
  status    InstallmentStatus
  isPenalty Boolean           @default(false)
  createdAt DateTime          @default(now())
  loan      Loan              @relation(fields: [loanId], references: [id])
  payments  Payment[]
}

model Payment {
  id            String        @id @default(cuid())
  installmentId String
  amount        Float
  paymentDate   DateTime      @default(now())
  method        PaymentMethod
  installment   Installment   @relation(fields: [installmentId], references: [id])
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

---

## API Routes (REST)

```
POST   /auth/login
POST   /auth/logout

GET    /clients                       # list with active loan summary
POST   /clients                       # create client
GET    /clients/:id                   # detail + full loan history
PUT    /clients/:id                   # edit client

GET    /clients/:id/loans             # loan history
POST   /clients/:id/loans             # create loan (only if no active loan)
GET    /loans/:id                     # loan detail with all installments

POST   /installments/:id/payments     # register full or partial payment
PATCH  /installments/:id/resolve      # fully resolve a PARTIALLY_PAID installment

GET    /dashboard                     # aggregated business metrics

POST   /internal/process-overdue      # called by cron-job.org — requires x-internal-secret header
```

---

## Scheduled Jobs

**Service:** [cron-job.org](https://cron-job.org) (free tier)
**Schedule:** Daily at 00:01 AM
**Endpoint:** `POST /internal/process-overdue`
**Auth:** `x-internal-secret` header validated against `INTERNAL_CRON_SECRET` env var — return 401 immediately if mismatch

**cron-job.org setup (once API is deployed):**
- URL: `https://your-api-domain.com/internal/process-overdue`
- Method: `POST`
- Custom header: `x-internal-secret: <your secret>`
- Schedule: daily at 00:01

---

## Dashboard Metrics (`GET /dashboard`)

| Key                | Description                                              |
|--------------------|----------------------------------------------------------|
| `totalOwed`        | Sum of all pending balances across all active loans      |
| `collectedThisMonth` | Sum of all payments in the current calendar month      |
| `overdueClients`   | Clients with at least one OVERDUE installment            |
| `onTimeRate`       | % of clients with no overdue installments                |
| `cashVsTransfer`   | Total collected split by payment method                  |
| `debtPerClient`    | Remaining debt breakdown per client                      |

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

# Database
bunx prisma migrate dev       # run migrations
bunx prisma studio            # local DB browser
bunx prisma generate          # regenerate client after schema changes
```

### Dependencies

The root package.json should not contain any "dependencies", "devDependencies", etc. Each individual package should be self-contained and declare its own dependencies.

To add npm dependencies to a particular workspace, just cd to the appropriate directory and run bun add commands as you would normally. Bun will detect that you are in a workspace and hoist the dependency as needed.

```bash
cd apps/api # move to specific workspace
bun add zod # then install desired package
```