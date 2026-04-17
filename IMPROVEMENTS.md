# Infrastructure Improvements

Pending infrastructure tasks to be implemented incrementally.

---

## 1. Staging Environment

**Goal:** A safe place to test migrations and deploys before they touch production.

**Plan:**
- Create a new Supabase project (staging DB, seeded with fake client data)
- Create a new Railway service pointing to the same repo, with `NODE_ENV=staging` and staging DB credentials
- Add a `VITE_API_URL` env var to Vercel so preview deployments (non-main branches) point to the staging API instead of production

**Success criteria:** A PR deploy on Vercel hits the staging API and staging DB, not production.

---

## 2. Weekly Database Backup via pg_dump to S3

**Goal:** Weekly snapshot of the production Supabase DB stored in an S3 bucket, free of charge.

**Plan:**
- Create an AWS S3 bucket with versioning enabled
- Create a Railway cron job (or standalone service) that runs weekly and executes `pg_dump` against the production Supabase DB
- Upload the dump to S3 using the AWS CLI or SDK
- Retain the last 4 weekly snapshots (delete older ones via S3 lifecycle policy)

**Credentials needed:**
- `DATABASE_URL` (production Supabase connection string)
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`

**Success criteria:** Every Sunday a new `.sql.gz` file appears in the S3 bucket; files older than 4 weeks are automatically deleted.

---

## 3. CI on Pull Requests (GitHub Actions)

**Goal:** Typecheck runs automatically on every PR to catch regressions before merge.

**Plan:**
- Add `.github/workflows/ci.yml`
- On `pull_request` to `main`: install deps with Bun, run `bun run typecheck` for both `apps/ui` and `apps/api`
- Fail the check if either workspace has type errors

**Success criteria:** A PR with a type error shows a failing check in GitHub and blocks merge (branch protection rule).
