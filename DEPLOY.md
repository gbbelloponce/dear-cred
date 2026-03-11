# Deployment Guide

## Services

| Service  | Provider | URL                        |
|----------|----------|----------------------------|
| Frontend | Vercel   | (set after first deploy)   |
| Backend  | Railway  | (set after first deploy)   |
| Database | Supabase | Already live               |
| Cron     | cron-job.org | Configured after API is live |

---

## Initial Setup (one-time)

### 1. Railway — Backend

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select the `dear-cred` repo
3. Set **Root Directory** to `apps/api`
4. Set **Start Command** to `bun src/index.ts`
5. Add all environment variables (see `INFRA.md`)
6. Deploy

### 2. Run Production Migration

Before deploying code that includes schema changes, run migrations from your local machine:

```bash
cd apps/api
bun run db:migrate:prod
```

This uses `.env.prod` (which you must have locally with `DIRECT_URL` pointing to Supabase).

### 3. Vercel — Frontend

1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub repo
2. Select the `dear-cred` repo
3. Set **Root Directory** to `apps/ui`
4. Add environment variables (see `INFRA.md`)
5. Deploy
6. Copy the assigned Vercel domain

### 4. Update CORS on Railway

After getting the Vercel domain, update `CORS_ORIGIN` in Railway env vars to the actual Vercel URL.

### 5. Configure cron-job.org

- URL: `https://<railway-domain>/internal/process-overdue`
- Method: `POST`
- Custom header: `x-internal-secret: <INTERNAL_CRON_SECRET value>`
- Schedule: daily at **23:20 UTC**

---

## Ongoing Deployments

### Frontend changes

```bash
git add .
git commit -m "..."
git push
```

Vercel auto-deploys on push to `main`. No manual steps needed.

### Backend changes (no schema change)

```bash
git add .
git commit -m "..."
git push
```

Railway auto-deploys on push to `main`. No manual steps needed.

### Backend changes (with DB schema change)

**Order matters — always migrate prod before deploying new code.**

1. Make and test schema changes locally
2. Run prod migration from local:
   ```bash
   cd apps/api
   bun run db:migrate:prod
   ```
3. Commit and push:
   ```bash
   git add .
   git commit -m "..."
   git push
   ```
4. Railway auto-deploys the new code (schema is already updated)

> **Why this order?** The new code expects the new schema. If you deploy code first and migrate after, the app will fail between deploy and migration. Migrate first = zero-downtime window.

---

## Rollback

- **Frontend:** Vercel keeps all previous deployments — redeploy any previous build from the Vercel dashboard.
- **Backend:** Railway keeps deploy history — roll back from the Railway dashboard.
- **Database:** Migrations are append-only. If a migration causes issues, fix it with a new migration (no `prisma migrate reset` in prod).
