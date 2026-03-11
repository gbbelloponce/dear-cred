# Infrastructure Reference

## Hosting Summary

| Service  | Provider     | Dashboard                         | Domain |
|----------|--------------|-----------------------------------|--------|
| Frontend | Vercel       | vercel.com/dashboard              | TBD after first deploy |
| Backend  | Railway      | railway.app/dashboard             | TBD after first deploy |
| Database | Supabase     | supabase.com/dashboard            | Already live |
| Cron     | cron-job.org | cron-job.org/dashboard            | — |

Update this file with actual domains after initial deploys.

---

## Environment Variables

### Railway (Backend — `apps/api`)

| Variable                  | Description                                           |
|---------------------------|-------------------------------------------------------|
| `DATABASE_URL`            | Supabase pooler URL (port 6543) — for queries         |
| `DIRECT_URL`              | Supabase direct URL (port 5432) — for migrations      |
| `SUPABASE_URL`            | `https://<project>.supabase.co`                       |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from Supabase dashboard            |
| `INTERNAL_CRON_SECRET`    | Secret string for `/internal/process-overdue` auth    |
| `CORS_ORIGIN`             | Vercel frontend URL (e.g. `https://dear-cred.vercel.app`) |
| `PORT`                    | Set by Railway automatically — do not override        |

### Vercel (Frontend — `apps/ui`)

| Variable            | Description                              |
|---------------------|------------------------------------------|
| `VITE_API_URL`      | Railway backend URL (e.g. `https://dear-cred-api.up.railway.app`) |
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co`          |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key from Supabase dashboard |

### Local files (gitignored, never commit)

- `apps/api/.env` — local dev backend vars
- `apps/api/.env.prod` — prod vars used only for running `db:migrate:prod` locally

---

## Cron Job

**Service:** [cron-job.org](https://cron-job.org) (free tier)
**Schedule:** Daily at **23:20 UTC** (8:20 PM Argentina / UTC-3)
**Endpoint:** `POST https://<railway-domain>/internal/process-overdue`
**Auth header:** `x-internal-secret: <INTERNAL_CRON_SECRET>`

Optional body for manual testing (skips waiting for 23:20 UTC):
```json
{ "asOf": "2026-03-11T23:20:00.000Z" }
```

---

## Supabase

- **Project:** Supabase dashboard → project settings
- **Auth:** Single admin user created directly from Supabase Auth dashboard (no signup flow in app)
- **Database:** Managed by Prisma migrations — never modify schema directly in Supabase SQL editor

---

## Notes

- Railway auto-deploys on push to `main` (root directory: `apps/api`)
- Vercel auto-deploys on push to `main` (root directory: `apps/ui`)
- Always run `bun run db:migrate:prod` locally before pushing schema changes (see `DEPLOY.md`)
