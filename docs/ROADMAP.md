# SaaS Starter — Project Roadmap

> Multi-tenant SaaS foundation with public API + documentation. Stack: PostgreSQL · Prisma ·
> Node/Express · React · Vite · Tailwind · React Query · TypeScript · Scalar

---

## Phase 0 — Repo & Tooling Setup ✅ COMPLETE

- [x] Initialize pnpm monorepo with workspaces (`apps/web`, `apps/api`, `packages/types`,
      `packages/openapi`)
- [x] Configure root `tsconfig.json` with path aliases shared across packages
- [x] Add ESLint + Prettier with shared config in root
- [x] Add `husky` + `lint-staged` for pre-commit hooks
- [x] Set up `.claude/` directory structure (CLAUDE.md, rules/, commands/, skills/, agents/, hooks/)
- [x] Create `.env.example` files for both `apps/api` and `apps/web`
- [x] Add `.gitignore` covering node_modules, dist, .env, prisma migrations lock
- [x] Create initial `README.md` with project overview, architecture diagram placeholder, and local
      setup instructions
- [x] Set up GitHub repository with branch protection on `main`
- [x] Configure GitHub Actions CI: lint + typecheck + test on PR

**All items completed:**

- ✅ pnpm workspace configuration with apps/web, apps/api, packages/types, packages/openapi
- ✅ Root tsconfig.json with TypeScript strict mode enabled
- ✅ Complete .claude/ directory with 4 rules, 4 commands, 3 skills, 3 agents, 2 hooks
- ✅ Root package.json with workspace scripts (dev, build, test, typecheck, lint, format)
- ✅ ESLint + Prettier configuration with TypeScript support
- ✅ Husky + lint-staged for automated pre-commit checks
- ✅ .gitignore with comprehensive patterns
- ✅ .env.example with all required environment variables
- ✅ README.md with project overview, tech stack, and setup instructions
- ✅ GitHub Actions CI workflow
- ✅ GitHub repository with branch protection configured
- ✅ Package.json files for all workspace packages with appropriate scripts

**Note:** Dependencies will be installed at the start of Phase 1.

---

## Phase 1 — Database & API Foundation ✅ COMPLETE

### Prisma + PostgreSQL

- [x] Initialize Prisma in `apps/api`
- [x] Write initial schema: `Organization`, `User`, `Membership`, `Invitation`
- [x] Add `role` enum: `owner | admin | member`
- [x] Add `ApiKey` model (hashed key, last_used_at)
- [x] Add `WebhookEvent` model (provider, event_type, payload Json, idempotency_key, processed_at)
- [x] Run first migration and seed script with dev org + admin user
- [x] Add Prisma client singleton with connection pooling config

### Express API Skeleton

- [x] Initialize Express app with TypeScript in `apps/api`
- [x] Add middleware: helmet, cors, morgan, express-json, cookie-parser
- [x] Implement global error handler middleware with typed `AppError` class
- [x] Add Zod environment variable validation
- [x] Add rate limiting middleware (express-rate-limit)
- [x] Health check endpoint: `GET /health`
- [x] Wire up Scalar docs at `GET /docs`

**All items completed:**

- ✅ Database schema with 6 models (User, Organization, Membership, Invitation, ApiKey,
  WebhookEvent)
- ✅ Role enum: OWNER, ADMIN, MEMBER
- ✅ Proper indexing and cascade deletes
- ✅ Initial migration: `20260526062715_init_schema`
- ✅ Seed script with test user (admin@example.com) and organization (acme)
- ✅ Docker Compose for PostgreSQL (running on port 5433)
- ✅ Express API with TypeScript strict mode + ESM
- ✅ Complete middleware stack (helmet, cors, morgan, cookie-parser, rate-limit)
- ✅ Global error handler supporting Zod, Prisma, and AppError
- ✅ Environment validation with Zod
- ✅ Prisma client singleton
- ✅ Health check with database connectivity test
- ✅ Graceful shutdown handling
- ✅ Scalar API documentation UI
- ✅ Initial OpenAPI 3.1 spec
- ✅ All dependencies installed (659 packages)
- ✅ ESLint + Prettier working with pre-commit hooks

**API running at:** http://localhost:3001

- Health: http://localhost:3001/health
- Docs: http://localhost:3001/docs

---

## Phase 2 — Authentication ✅ COMPLETE

- [x] Implement `POST /api/v1/auth/register` — create user + personal org
- [x] Implement `POST /api/v1/auth/login` — return JWT access token + refresh token (httpOnly
      cookie)
- [x] Implement `POST /api/v1/auth/refresh` — rotate refresh token
- [x] Implement `POST /api/v1/auth/logout` — invalidate refresh token
- [x] Implement `GET /api/v1/auth/me` — return current user + memberships
- [x] JWT middleware: extract + verify, attach `req.user` and `req.tenantId`
- [x] API key middleware: hash lookup, attach org context, scope enforcement
- [x] Password hashing with bcrypt (work factor configurable via env)
- [x] Write auth integration tests (Vitest + Supertest)

**All items completed:**

- ✅ Database migration: added `tokenVersion` field to User model for refresh token rotation
- ✅ Password hashing with bcrypt (configurable work factor via `BCRYPT_WORK_FACTOR` env)
- ✅ JWT utilities: sign and verify access/refresh tokens with proper types
- ✅ API key utilities: generate (sk*live*\*) and hash with SHA-256
- ✅ Slug generation: unique organization slugs from names
- ✅ Zod validation schemas for register and login
- ✅ Auth endpoints: register, login, refresh, logout, me (all at `/api/v1/auth/*`)
- ✅ JWT middleware: `authenticateJWT` (parse token), `requireAuth` (enforce auth)
- ✅ RBAC middleware: `requireRole()` - checks organization membership and role
- ✅ API key middleware: `authenticateApiKey` - hash lookup and tenant context
- ✅ Async handler wrapper for proper Express error handling
- ✅ Integration tests: 21 tests covering all auth flows and error cases
- ✅ Test infrastructure: Vitest config, test helpers, database cleanup
- ✅ OpenAPI documentation: all 5 auth endpoints documented with schemas
- ✅ TypeScript: strict mode, all files type-checked
- ✅ ESLint: all rules passing with test file overrides
- ✅ httpOnly cookies for refresh tokens (7d expiry)
- ✅ Token rotation on logout (increment tokenVersion to invalidate all tokens)
- ✅ Personal organization automatically created on registration

**Security features:**

- ✅ Passwords hashed with bcrypt (work factor 10, configurable)
- ✅ JWT access tokens (15m default expiry)
- ✅ httpOnly refresh tokens in secure cookies
- ✅ Refresh token rotation prevents token reuse
- ✅ API keys hashed with SHA-256 (never stored plaintext)
- ✅ Tenant isolation via `req.tenantId` (set by middleware)
- ✅ Input validation with Zod on all endpoints
- ✅ Proper error handling (no internal details leaked)

**Test results:** 23/23 passing (21 auth + 2 health)

---

## Phase 3 — Multi-Tenancy Core

### Organization Management

- [ ] `POST /api/v1/orgs` — create org (auto-assigns caller as owner)
- [ ] `GET /api/v1/orgs/:slug` — get org details (member+)
- [ ] `PATCH /api/v1/orgs/:slug` — update org name/slug (admin+)
- [ ] `DELETE /api/v1/orgs/:slug` — delete org + cascade (owner only)
- [ ] Org slug uniqueness enforced at DB + API layer

### Membership & RBAC

- [ ] `GET /api/v1/orgs/:slug/members` — list members with roles
- [ ] `PATCH /api/v1/orgs/:slug/members/:userId` — change role (admin+, cannot demote owner)
- [ ] `DELETE /api/v1/orgs/:slug/members/:userId` — remove member (admin+ or self)
- [ ] RBAC middleware factory: `requireRole('admin')` composable guard
- [ ] Owner transfer flow: `POST /api/v1/orgs/:slug/transfer`
- [ ] Prevent last-owner removal

### Invitations

- [ ] `POST /api/v1/orgs/:slug/invitations` — create invite (email + role), send email
- [ ] `GET /api/v1/invitations/:token` — validate token (public, no auth required)
- [ ] `POST /api/v1/invitations/:token/accept` — accept invite (creates membership, handles new vs
      existing user)
- [ ] `DELETE /api/v1/invitations/:id` — revoke pending invite (admin+)
- [ ] Token expiry: 72 hours, single-use, stored as hash
- [ ] Edge cases: invitee already member, org at seat limit, token expired
- [ ] Write invitation flow integration tests

### API Key Management

- [ ] `POST /api/v1/orgs/:slug/keys` — generate API key (returns plaintext once, stores hash)
- [ ] `GET /api/v1/orgs/:slug/keys` — list keys (id, name, scopes, last_used_at — never plaintext)
- [ ] `DELETE /api/v1/orgs/:slug/keys/:id` — revoke key
- [ ] Scope system: `members:read`, `members:write`, `invitations:write`, `org:read`

---

## Phase 4 — OpenAPI Spec & Scalar Docs

- [ ] Write OpenAPI 3.1 spec in `packages/openapi/openapi.yaml`
- [ ] Document all Phase 2–3 endpoints with request/response schemas
- [ ] Add security schemes: `BearerAuth` (JWT) and `ApiKeyAuth`
- [ ] Generate TypeScript types from spec into `packages/types` (using `openapi-typescript`)
- [ ] Generate Zod schemas from spec (using `zod-openapi`) for runtime validation
- [ ] Mount Scalar UI in Express at `GET /docs`
- [ ] Add OpenAPI spec validation to CI (ensure spec stays in sync with code)
- [ ] Write a `packages/openapi/README.md` explaining how to regenerate types

---

## Phase 5 — React Frontend

### Project Setup

- [ ] Initialize Vite + React + TypeScript in `apps/web`
- [ ] Configure Tailwind CSS with custom design tokens
- [ ] Add React Router v6 with layout-based routing
- [ ] Configure TanStack Query (React Query) with global error/retry defaults
- [ ] Add Axios instance with interceptors (auth header injection, 401 refresh flow)
- [ ] Import generated TypeScript types from `packages/types`

### Auth UI

- [ ] Register page
- [ ] Login page
- [ ] Protected route wrapper (redirect to login if unauthenticated)
- [ ] Auth context provider (current user, active org, org switching)

### Core Dashboard UI

- [ ] Org switcher in nav (list orgs, switch active tenant context)
- [ ] Members page: list, role badges, remove member action
- [ ] Invite member modal: email + role selector, pending invites list, revoke action
- [ ] Org settings page: rename org, danger zone (delete org, transfer ownership)
- [ ] API Keys page: generate key (show once modal), list keys, revoke

### Accept Invitation Flow

- [ ] Public `/invite/:token` page — shows org name + role, login/register to accept
- [ ] Handle already-logged-in user accepting invite

---

## Phase 6 — Claude Code AI Integration Showcase

- [ ] Finalize `.claude/CLAUDE.md` with full project context
- [ ] Write `.claude/rules/code-style.md` — const-first, no any, Zod for all I/O
- [ ] Write `.claude/rules/api-conventions.md` — RESTful patterns, error shape, status codes
- [ ] Write `.claude/rules/testing.md` — integration-first, colocated tests, coverage requirements
- [ ] Write `.claude/rules/git.md` — conventional commits, branch naming, PR checklist
- [ ] Write `.claude/commands/review.md` — slash command for pre-PR review checklist
- [ ] Write `.claude/commands/add-endpoint.md` — slash command scaffolding a new route (route +
      controller + Zod schema + OpenAPI entry + test)
- [ ] Write `.claude/commands/add-migration.md` — slash command for Prisma schema change + migration
- [ ] Write `.claude/commands/fix-issue.md` — slash command for bug investigation workflow
- [ ] Write `.claude/skills/openapi/SKILL.md` — context for generating spec-compliant endpoint docs
- [ ] Write `.claude/skills/prisma/SKILL.md` — context for schema changes, migration naming, seed
      patterns
- [ ] Write `.claude/skills/rbac/SKILL.md` — context for adding new permission-guarded routes
- [ ] Write `.claude/agents/code-reviewer.md` — specialized agent for security + correctness review
- [ ] Write `.claude/agents/api-designer.md` — specialized agent for REST/OpenAPI design decisions
- [ ] Write `.claude/agents/db-architect.md` — specialized agent for schema + query optimization
- [ ] Write `.claude/hooks/validate-types.sh` — pre-tool hook: run `tsc --noEmit` before edits
- [ ] Write `.claude/hooks/lint-staged.sh` — pre-commit hook via husky
- [ ] Add `AI_DEVELOPMENT.md` to repo root explaining the Claude Code workflow, agents used, and how
      AI was used thoughtfully throughout the project

---

## Phase 7 — Testing & Quality

- [ ] API integration test suite covering all happy paths (Vitest + Supertest)
- [ ] RBAC edge case tests: owner demotion, last-owner removal, cross-tenant access attempts
- [ ] Invitation edge case tests: expired token, already-accepted, revoked
- [ ] API key scope enforcement tests
- [ ] Frontend: React Testing Library for auth flows and invite acceptance
- [ ] Add test coverage threshold to CI (80% on API)
- [ ] Add OpenAPI spec drift detection to CI

---

## Phase 8 — Deployment & Polish

- [ ] Dockerize `apps/api` with multi-stage build
- [ ] Add `docker-compose.yml` for local dev (PostgreSQL + API + Redis if needed)
- [ ] Deploy API + PostgreSQL to Railway (or Render)
- [ ] Deploy frontend to Vercel
- [ ] Configure environment variables in both platforms
- [ ] Set up Prisma migrate deploy in CI/CD pipeline
- [ ] Add live demo link to README
- [ ] Write architecture decision records (ADRs) for: monorepo structure, tenant isolation strategy,
      token design, API key hashing approach
- [ ] Final README pass: architecture diagram, local setup, API docs link, AI workflow section

---

## Future: Subscription Billing Dashboard (Phase 9+)

- [ ] Add `Subscription`, `Invoice`, `Plan` to Prisma schema
- [ ] Stripe customer + subscription creation on org creation
- [ ] Stripe webhook ingestion (idempotent, signature-verified)
- [ ] Subscription lifecycle state machine: `trialing → active → past_due → canceled`
- [ ] Dunning logic: retry schedule, grace period, customer notification
- [ ] Invoice PDF generation
- [ ] Billing dashboard UI: current plan, invoice history, payment method management
- [ ] Plan-gated feature flags (seat limits, feature entitlements per plan)
- [ ] Document billing endpoints in OpenAPI spec
