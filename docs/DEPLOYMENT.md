# Deployment

This project deploys as two independent services:

- **API** → [Railway](https://railway.com) (builds `docker/api.Dockerfile`, runs the Express server + Prisma against a managed Postgres).
- **Web** → [Vercel](https://vercel.com) (builds the Vite SPA, serves static files with a client-side-routing fallback).

Continuous deployment is driven by [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):
every push to `main` (i.e. after a PR squash-merges) runs `prisma migrate deploy` against the
production database, then deploys the API and the web app.

> **One-time provisioning is manual.** Creating the Railway and Vercel projects and entering live
> credentials cannot be scripted safely from this repo. Follow the checklist below once; after that,
> deploys are automatic on merge to `main`.

---

## Architecture at a glance

```
                 push to main
                      │
            ┌─────────▼──────────┐
            │  migrate (Actions) │  prisma migrate deploy → prod Postgres
            └─────────┬──────────┘
          ┌───────────┴───────────┐
          ▼                       ▼
  deploy-api (Railway)     deploy-web (Vercel)
  docker/api.Dockerfile    vite build (SPA)
          │                       │
          ▼                       ▼
   https://api.<domain>    https://app.<domain>
          ▲                       │
          └───────── CORS / cookies ┘
```

The API's production CORS allow-list is exactly `WEB_URL` (see `apps/api/src/lib/security.ts`), and
refresh-token cookies are cross-site between the two origins — so **`WEB_URL` on the API must equal the
Vercel origin**, and **`VITE_API_URL` on the web build must equal the Railway API origin**. Mismatches
surface as CORS or cookie failures, not build failures.

---

## Prerequisites

- A Railway account and a Vercel account.
- Admin access to the GitHub repository (to add Actions secrets/variables).
- A transactional email provider with a verified sender (SendGrid, Postmark, AWS SES, Resend, …) —
  production refuses to boot with the dev/Mailpit placeholder `SMTP_FROM` or a missing `SMTP_HOST`
  (enforced in `apps/api/src/lib/env.ts`).

---

## Step 1 — Provision Railway (API + Postgres)

1. Create a new Railway **project**.
2. Add a **PostgreSQL** database to the project (New → Database → PostgreSQL).
3. Add a **service** from this GitHub repo. In the service's **Settings**:
   - **Config-as-code:** Railway auto-detects [`railway.json`](../railway.json) at the repo root, which
     pins the Dockerfile builder (`docker/api.Dockerfile`), the start command, and the `/health`
     healthcheck. No build settings need to be entered by hand.
   - Note the service **name** — you'll set it as the `RAILWAY_SERVICE` repo variable in Step 3.
4. Generate a public domain for the service (Settings → Networking → Generate Domain). This is your
   **API origin** (e.g. `https://plinth-api-production.up.railway.app`).
5. Set the service's environment **variables** (Variables tab). Railway injects `PORT` and (via the
   Postgres plugin reference) `DATABASE_URL` automatically — reference the database with
   `${{ Postgres.DATABASE_URL }}` rather than pasting a connection string.

   | Variable             | Value / source                                                                 |
   | -------------------- | ------------------------------------------------------------------------------ |
   | `NODE_ENV`           | `production`                                                                   |
   | `DATABASE_URL`       | `${{ Postgres.DATABASE_URL }}` (plugin reference)                              |
   | `JWT_SECRET`         | `openssl rand -base64 32` (≥ 32 chars)                                         |
   | `JWT_REFRESH_SECRET` | `openssl rand -base64 32` (≥ 32 chars, different from `JWT_SECRET`)            |
   | `API_URL`            | the Railway API origin from step 4                                             |
   | `WEB_URL`            | the Vercel origin from Step 2 (must **not** be `localhost`, no trailing slash) |
   | `SMTP_HOST`          | your provider's SMTP host (**required** in production)                         |
   | `SMTP_PORT`          | provider SMTP port (e.g. `587`)                                                |
   | `SMTP_USER`          | provider username (set **with** `SMTP_PASS` or neither)                        |
   | `SMTP_PASS`          | provider password/API key                                                      |
   | `SMTP_FROM`          | a **verified** sender, e.g. `Plinth <noreply@yourdomain.com>`                  |
   | `JWT_ACCESS_EXPIRY`  | optional, default `15m`                                                        |
   | `JWT_REFRESH_EXPIRY` | optional, default `7d`                                                         |
   | `BCRYPT_WORK_FACTOR` | optional, default `10`                                                         |
   | `LOG_LEVEL`          | optional, default `info`                                                       |
   | `HEALTH_CHECK_TOKEN` | optional; `openssl rand -base64 32` to enable `GET /health/detailed`           |

   > `WEB_URL` is a chicken-and-egg with Step 2 — provision Vercel first (or set a placeholder and
   > update it once the Vercel domain exists). Changing it later triggers a redeploy.

---

## Step 2 — Provision Vercel (web)

1. Create a new Vercel **project** from this GitHub repo.
2. Set **Root Directory** to `apps/web`. Vercel reads [`apps/web/vercel.json`](../apps/web/vercel.json)
   for the framework (Vite), the monorepo-aware install/build commands, and the SPA rewrite
   (`/(.*) → /index.html`), so no build settings need to be entered by hand.
3. Add the build-time environment variable (Settings → Environment Variables, **Production**):

   | Variable       | Value                                                    |
   | -------------- | -------------------------------------------------------- |
   | `VITE_API_URL` | the Railway API origin from Step 1.4 (no trailing slash) |

   `VITE_API_URL` is inlined at build time, so a change requires a rebuild/redeploy.

4. Your Vercel domain (e.g. `https://plinth.vercel.app` or a custom domain) is the **`WEB_URL`** you set
   on Railway in Step 1. Go back and confirm the two match.

---

## Step 3 — Wire up GitHub Actions

The deploy workflow authenticates to both platforms with repository secrets and targets the Railway
service by name. Add these under **Settings → Secrets and variables → Actions**.

**Secrets:**

| Secret              | Where to get it                                                                      |
| ------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`      | Railway Postgres connection string (the **public** URL) — used by the migrate job    |
| `RAILWAY_TOKEN`     | Railway → Project Settings → Tokens → create a **project token** (scope: production) |
| `VERCEL_TOKEN`      | Vercel → Account Settings → Tokens                                                   |
| `VERCEL_ORG_ID`     | Vercel project → Settings → General (or `.vercel/project.json` after `vercel link`)  |
| `VERCEL_PROJECT_ID` | same as above                                                                        |

**Variables:**

| Variable          | Value                                      |
| ----------------- | ------------------------------------------ |
| `RAILWAY_SERVICE` | the Railway API service name from Step 1.3 |

> The migrate job connects from a GitHub-hosted runner, so `DATABASE_URL` here must be the Railway
> **public** Postgres URL (the internal `*.railway.internal` host is only reachable inside Railway's
> network). The API service itself should keep using the plugin reference / internal URL.

---

## Step 4 — First deploy

1. Merge a PR to `main` (or re-run the `Deploy` workflow manually once it exists on `main`).
2. Watch the three jobs in the Actions tab: `migrate` → then `deploy-api` and `deploy-web` in parallel.
3. Verify:
   - `GET https://<api-origin>/health` returns `200`.
   - The Vercel site loads, and signup → verify-email → login works end to end (check your email
     provider's activity log, or Mailpit locally — see [DOCKER.md](./DOCKER.md)).
   - Browser devtools show no CORS errors on API calls (confirms `WEB_URL` ↔ `VITE_API_URL` match).

---

## Migrate → release ordering caveat

`.github/workflows/deploy.yml` runs `prisma migrate deploy` **before** the new API image goes live, so
there is a brief window where the **new schema** is serving the **old binary**. For most migrations this
is harmless, but two migrations in this project's history are sensitive and are worth understanding if
you deploy an older revision:

- **`add_email_verification_to_users` (original PR 2):** backfills `emailVerified = true` only for rows
  that exist when it runs. A user who registers through the _old_ binary during the cutover window lands
  `emailVerified = false` with no verification email, and hits `403 EMAIL_NOT_VERIFIED` once the new code
  is live.
- **`add_pending_registrations` (follow-up, see the migration under
  `apps/api/prisma/migrations/`):** adds the
  `pending_registrations` table, **deletes any `emailVerified = false` users** (plus their solely-owned
  personal orgs), and **drops** `User.verificationTokenHash` / `verificationExpiresAt`. The DELETE is
  destructive: a user created unverified through the _old_ binary after this migration runs would be
  swept on a later run or left unable to log in. The two verification code paths (User-column vs
  pending-registration) must never run against the same schema.

**Mitigation:** deploy during a low-traffic window and keep the migrate→release gap small (the workflow
already gates the deploys on the migrate job to minimize it). For a high-stakes cutover, briefly pause
registrations. Both app deploys are gated on `migrate`, so a failed migration aborts the release rather
than shipping code against an unmigrated schema.

---

## Rollback

- **Web:** Vercel → Deployments → promote a previous production deployment.
- **API:** Railway → the service's Deployments → redeploy a previous build.
- **Database:** Prisma migrations are forward-only; there is no automatic down-migration. To undo a
  schema change, write a new corrective migration and deploy it (do not hand-edit the production
  schema). Restore from a Railway Postgres backup only as a last resort.
