# Planned Features

This document describes upcoming features requested for dear-cred. Each entry includes the motivation, implementation scope, and known caveats.

---

## 1. Default Payment Method → Transferencia

**Status:** Done

### What
Change the default payment method in the payment registration form from Efectivo (CASH) to Transferencia (TRANSFER).

### Why
Most clients pay via bank transfer; selecting it manually every time is unnecessary friction.

### Scope
- `apps/ui/src/pages/ClienteDetalle.tsx` — change 3 `useState<PaymentMethod>('CASH')` defaults (~lines 229, 235, 295) to `'TRANSFER'`

### Caveats
None. Pure frontend change, no backend or DB impact.

---

## 2. Fortnightly (Quincenal) Loan Cadence

**Status:** Done

### What
Add a new `FORTNIGHTLY` frequency option (every 14 days) alongside the existing DAILY, WEEKLY, and MONTHLY options.

### Why
Some clients prefer to pay every two weeks aligned to their paycheck schedule.

### Scope
- **DB migration:** Add `FORTNIGHTLY` to the `Frequency` enum in Prisma
- `apps/api/src/lib/dateUtils.ts` — add `+14 days` case to both `computeNextDueDate` and `computeDueDates`
- `packages/shared/src/types.ts` — add `FORTNIGHTLY` to the shared `Frequency` type
- `apps/ui/src/pages/PrestamoNuevo.tsx` — add `FORTNIGHTLY: 'Quincenal'` to the `FREQUENCY_LABEL` map

### Caveats
None. Follows the exact same pattern as existing frequency types.

---

## 3. Late Cutoff: Due Date & Cron Time Change to 23:55 ARG

**Status:** Done

### What
Move the daily payment cutoff from 5:00 PM ARG (20:00 UTC) to 23:55 ARG (02:55 UTC next calendar day), so clients can pay until nearly midnight without being marked overdue or late.

### Why
Some clients pay at night. The current 5 PM cutoff causes valid on-time payments to be incorrectly classified as LATE_PAID, and triggers unwanted penalties.

### How It Works (UTC storage)
Argentina is UTC-3. Storing "23:55 ARG" means storing **02:55 UTC on the next calendar day** in the database. This is correct and safe because:
- The UI displays dates via `toLocaleDateString('es-AR')`, which converts UTC back to ARG time and shows the right calendar date.
- `Date.UTC(y, m, d + 1, 2, 55, 0)` handles month/year overflow natively.

### Scope
- `apps/api/src/lib/dateUtils.ts` — change timestamp from `(y, m, d + offset, 20, 0, 0)` to `(y, m, d + offset + 1, 2, 55, 0)` in both `computeNextDueDate` and `computeDueDates`
- **DB migration (data):** Update all PENDING and PARTIALLY_PAID installment `dueDate` values to the new time (shift from 20:00 UTC to 02:55 UTC next day). This is required so that payments made between 5 PM and midnight today on existing loans are not incorrectly classified as LATE_PAID.
- **cron-job.org:** Change schedule from `20:05 UTC` → `03:00 UTC` daily

### Caveats
- Existing due dates stored in DB will be migrated. The calendar date shown in the UI will not change.
- The UTC date stored in DB will always be one calendar day ahead of the displayed ARG date — this is intentional and expected.
- The cron moving to 03:00 UTC means it runs just after midnight ARG; this is the correct trigger point.

---

## 4. Soft Delete Clients

**Status:** Pending

### What
Allow the admin to "delete" a client so they no longer appear in the system. The client's data is retained in the database (soft delete). A toggle in the client list allows viewing deleted clients and their historical data.

### Why
Some clients should no longer appear in day-to-day operations, but hard deleting their data (payments, loans) would break financial history.

### Behavior
- Deleted clients are hidden from the client list, client search, and all dashboard metrics (totalOwed, overdueClients, debtPerClient, onTimeRate).
- The overdue cron skips installments belonging to deleted clients.
- A "Show deleted clients" toggle in the client list reveals them in a separate section.
- Deleted clients can be viewed (read-only) but not edited.
- **Clients with an ACTIVE or OVERDUE loan cannot be deleted** — the admin must first nullify the loan.

### Scope
- **DB migration:** Add `deletedAt DateTime?` to the `Client` model
- `apps/api/src/routes/clients.ts` — add `deletedAt: null` filter to all list/detail queries; new `DELETE /clients/:id` route that sets `deletedAt = now()`; support `?includeDeleted=true` query param on `GET /clients`
- `apps/api/src/routes/dashboard.ts` — add `client: { deletedAt: null }` filter to all aggregation queries
- `apps/api/src/routes/internal.ts` — add `client: { deletedAt: null }` to the overdue installment query
- `apps/ui/src/pages/Clientes.tsx` — add "Mostrar eliminados" toggle
- `apps/ui/src/pages/ClienteDetalle.tsx` — add "Eliminar cliente" button with a confirmation dialog

### Caveats
- Data is never destroyed — `deletedAt` is set but records remain in PostgreSQL.
- The deletion guard (no active loan) should be enforced on the API, not just the UI.

---

## 5. Freeze Loan Account

**Status:** Pending

### What
Allow the admin to freeze an active loan, pausing all penalty and overdue processing. The loan can be unfrozen at any time to resume normal operation.

### Why
Clients sometimes make an agreement to pause payments temporarily and resume later. Freezing prevents the system from accumulating penalties during that period.

### Behavior
- **Overdue cron skips frozen loans** — no overdue status changes, no penalty installments appended.
- **Payments are still allowed** on a frozen loan — the client can pay down the balance.
- **Frozen loan debt appears in the dashboard** (totalOwed, debtPerClient) — the money is still owed.
- **Nullification is allowed** on a frozen loan.
- **A new loan cannot be created** for a client with a FROZEN loan (same guard as ACTIVE/OVERDUE).
- Any OVERDUE installments that existed before freezing remain OVERDUE — they are not cleared by the freeze.
- **Unfreezing** reverts the loan status to ACTIVE or OVERDUE depending on whether any installments are currently OVERDUE.

### Scope
- **DB migration:** Add `FROZEN` to the `LoanStatus` enum
- `apps/api/src/routes/internal.ts` — add `'FROZEN'` to the `notIn` status exclusion in the overdue query
- `apps/api/src/routes/loans.ts` — add `'FROZEN'` to the new-loan creation guard; allow `'FROZEN'` in the nullify route
- `apps/api/src/routes/dashboard.ts` — add `'FROZEN'` to status filters for debt/overdue queries
- New routes: `POST /loans/:id/freeze` and `POST /loans/:id/unfreeze`
- `apps/ui/src/pages/ClienteDetalle.tsx` — add "Congelar préstamo" / "Descongelar préstamo" button on the active loan card

### Caveats
- Freezing does not clear or modify existing OVERDUE installments — only stops new ones from being created.
- Unfreezing must re-evaluate loan status from existing installment states (revert to OVERDUE if any remain OVERDUE, otherwise ACTIVE).
- Voiding payments on a frozen loan should be allowed since payments are permitted while frozen.
