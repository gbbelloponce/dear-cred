# CLAUDE.md — apps/ui

> See root `CLAUDE.md` for business logic, DB schema, all API routes, installment status rules, and the datetime/timezone strategy. Consult it before implementing any domain logic or building a new page.

---

## Scripts

```bash
bun run dev        # Vite dev server
bun run build      # tsc -b && vite build (type-checks first)
bun run typecheck  # tsc -b only
bun run lint       # eslint .
bun run preview    # preview production build
```

---

## Setup Notes

**Initialized with:**
```bash
bunx --bun shadcn@latest create --preset "https://ui.shadcn.com/init?base=radix&style=maia&baseColor=neutral&theme=neutral&iconLibrary=hugeicons&font=figtree&menuAccent=subtle&menuColor=default&radius=default&template=vite&rtl=false" --template vite
```

**Path alias:** `@/` → `./src/` (configured in `vite.config.ts` and `tsconfig.app.json`)

**Adding shadcn components:** `bunx shadcn@latest add <component>` — never edit `src/components/ui/` manually.

---

## Authentication

Auth uses a plain localStorage token — no Supabase JS client on the frontend. Token key: `'token'`.

**`src/hooks/useAuth.ts`** — provides `{ session, loading, signIn, signOut }`:
- `signIn` POSTs to `/auth/login`, stores `accessToken` in localStorage
- `signOut` clears token from state and localStorage
- `loading` is `true` on initial mount while checking localStorage — router blocks rendering until resolved

**`src/router.tsx`** — `<AuthGuard>` wraps all protected routes. Redirects to `/login` while `loading` is true or `session` is null.

---

## API Layer

All API calls go through **`src/services/api.ts`**.

**`apiFetch<T>(path, options?)`** — internal generic helper:
- Adds `Authorization: Bearer {token}` and `Content-Type: application/json`
- On 401: clears token and redirects to `/login`
- On any non-ok response: throws an error

All exported service functions (e.g. `getClient(id)`, `createLoan(clientId, body)`) wrap `apiFetch` with typed return values. All frontend types (`ClientSummary`, `LoanWithInstallments`, `Installment`, etc.) are defined in this file — no imports from `packages/shared`.

**Data fetching pattern in pages:**
```tsx
const [data, setData] = useState<T | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  let mounted = true
  api.getSomething()
    .then(d => { if (mounted) setData(d) })
    .catch(e => { if (mounted) setError(e.message) })
    .finally(() => { if (mounted) setLoading(false) })
  return () => { mounted = false }
}, [dependency])
```

Always use the `mounted` flag to prevent state updates after unmount.

---

## Date Utilities (`src/lib/date.ts`)

Two helpers bridge Argentina timezone (UTC-3) to form inputs and back:

- **`formatArgentinaDateInput(date)`** — converts a UTC Date/string to `YYYY-MM-DD` in ARG time, for `<input type="date">` defaultValues
- **`argentinaDateInputToIsoStart(dateInput)`** — converts a `YYYY-MM-DD` ARG local date to a UTC ISO string at midnight ARG (= 03:00 UTC); use when sending `startDate` to the API

**`fmtDate`** (in `api.ts`) subtracts 3h from stored UTC timestamps before formatting for display — see root CLAUDE.md for the full datetime strategy.

---

## Page Patterns

**Forms** (`ClienteNuevo`, `PrestamoNuevo`): controlled inputs with local state, `FormEvent` + `preventDefault`, navigate on success, inline error display.

**Detail page** (`ClienteDetalle`): one large page composing multiple sections — client info edit, active loan panel with installment table, loan history list. Dialogs for payment registration, partial resolution, nullification, and freeze are toggled via local `useState<boolean>`.

**Installment table** (`ClienteDetalle`): rows expand to show payment history. Action buttons (pay, resolve, void, delete penalty) are shown conditionally based on `loan.status` and `installment.status`. Status badges map enum values to Spanish display labels and Tailwind color classes inline.

**Dashboard** (`Dashboard.tsx`): accepts `from`/`to` date query params, passes them to `GET /dashboard?from=&to=`. Renders metric cards and a `debtPerClient` breakdown list.

---

## Styling

- **TailwindCSS v4** — no `tailwind.config.js` exists or should be created. All theme tokens are CSS variables in `src/index.css` (OKLch color space).
- **Class composition:** always use `cn()` from `src/lib/utils.ts` (`clsx` + `tailwind-merge`).
- **Icons:** `@hugeicons/react` only — never `lucide-react`.
  ```tsx
  import { Home01Icon } from '@hugeicons/react'
  <Home01Icon size={20} />
  ```
- **Currency:** always format with `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.
- **shadcn components:** `src/components/ui/` is auto-generated — never edit manually. Add with `bunx shadcn@latest add <component>`.