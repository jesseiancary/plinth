# CLAUDE.md — SaaS Starter

> This file is loaded at every Claude Code session start. Keep it accurate and up to date. It is the
> single source of truth for project context, conventions, and AI workflow guidance.

---

## Project Overview

A production-grade **multi-tenant SaaS starter** built as a public portfolio project. Demonstrates:
tenant isolation, RBAC, invitation flows, API key management, and a fully documented public REST
API.

Future phases will add a **subscription billing dashboard** (Stripe, webhooks, dunning logic).

The project also serves as a showcase for **thoughtful AI-assisted development** — not vibe coding,
but a disciplined workflow using Claude Code agents, skills, commands, and hooks. See
`AI_DEVELOPMENT.md`.

---

## Monorepo Structure

```
/apps
  /api        Node.js + Express + TypeScript — REST API
  /web        React + Vite + Tailwind + React Query — Frontend
/packages
  /types      Shared TypeScript types (generated from OpenAPI spec)
  /openapi    OpenAPI 3.1 spec + Zod schema generation
/.claude
  /rules      Modular rule files (code-style, api-conventions, testing, git)
  /commands   Slash commands for repeatable workflows
  /skills     Auto-loaded context files for specific task domains
  /agents     Specialized subagent definitions
  /hooks      Event-driven scripts (pre/post tool execution)
```

---

## Tech Stack

| Layer           | Choice                                 | Notes                                                       |
| --------------- | -------------------------------------- | ----------------------------------------------------------- |
| Database        | PostgreSQL                             | Via Railway or local Docker                                 |
| ORM             | Prisma                                 | Schema-first, migrations in version control                 |
| API             | Node.js + Express + TypeScript         | `apps/api`                                                  |
| Validation      | Zod                                    | All request/response I/O validated at runtime               |
| Auth            | JWT (access) + httpOnly refresh cookie | Rolled manually — no auth library abstraction               |
| Frontend        | React + Vite + TypeScript              | `apps/web`                                                  |
| Styling         | Tailwind CSS                           | Utility-first, custom design tokens in `tailwind.config.ts` |
| Data fetching   | TanStack Query (React Query)           | All server state                                            |
| API Docs        | OpenAPI 3.1 + Scalar                   | Spec in `packages/openapi`, served at `/docs`               |
| Testing         | Vitest + Supertest                     | Integration-first on API; RTL for frontend                  |
| Package manager | pnpm workspaces                        | Run commands from repo root                                 |

---

## Core Domain Model

```
Organization  (1) ──< (many) Membership >── (many) User
Organization  (1) ──< (many) Invitation
Organization  (1) ──< (many) ApiKey
Organization  (1) ──< (many) Subscription    [Phase 9+]
Subscription  (1) ──< (many) Invoice         [Phase 9+]
WebhookEvent  (standalone log table)
```

**Tenant isolation strategy:** single database, `organizationId` foreign key on all tenant-scoped
resources. All queries in the API layer are filtered by `req.tenantId` — never trust the client to
provide this. Cross-tenant access is a security bug, not a feature.

**Roles:** `owner | admin | member`

- `owner` — full control, cannot be removed, can transfer ownership
- `admin` — manage members and invitations, cannot demote owner
- `member` — read access to org resources

---

## API Conventions

Base path: `/api/v1`

**URL structure:** `noun-plural/resource-id/sub-resource`

- `GET /api/v1/orgs/:slug/members`
- `POST /api/v1/orgs/:slug/invitations`

**HTTP status codes:**

- `200` — success with body
- `201` — resource created
- `204` — success, no body (DELETE)
- `400` — validation error (Zod)
- `401` — unauthenticated
- `403` — authenticated but insufficient role
- `404` — resource not found
- `409` — conflict (duplicate slug, already a member, etc.)
- `429` — rate limited
- `500` — unexpected server error

**Error response shape (always):**

```json
{
  "error": {
    "code": "INVITATION_EXPIRED",
    "message": "This invitation has expired.",
    "details": {}
  }
}
```

**Pagination:** cursor-based using `?cursor=` + `?limit=` (default 20, max 100). Response includes
`{ data: [], nextCursor: string | null }`.

**API Key authentication:** `Authorization: Bearer sk_live_...` header. Keys are hashed (SHA-256) at
rest — the plaintext is returned once on creation and never stored.

---

## Code Style

- **TypeScript strict mode on.** No `any`. If you need an escape hatch, use `unknown` + a type
  guard.
- **`const` only** — never `let` unless reassignment is genuinely required and unavoidable.
- **Zod for all I/O** — every request body, query param, and env variable validated with Zod. Infer
  TypeScript types from Zod schemas with `z.infer<typeof Schema>` — do not duplicate types.
- **No barrel files** (`index.ts` re-exports) — import directly from source files.
- **Named exports only** — no default exports except React components and route handlers.
- **Error handling:** use the `AppError` class for all known failure modes. Never throw raw strings.
- **Async/await** — no `.then()` chains. Always `try/catch` in Express route handlers.
- **Prisma:** never use `prisma.$queryRaw` unless there is no alternative. Document why if you do.

---

## Testing Conventions

- Tests live alongside source: `src/routes/auth.test.ts` next to `src/routes/auth.ts`
- **Integration tests first** on the API — test through the HTTP layer (Supertest), not unit-testing
  internals
- Each test file resets the database to a known state using a `beforeEach` seed helper
- Test naming: `describe('POST /api/v1/auth/login')` → `it('returns 401 when password is wrong')`
- Do not mock Prisma in integration tests — use a real test database (separate from dev)
- Frontend: React Testing Library, test behavior not implementation
- Coverage threshold: 80% on `apps/api/src`

---

## Git Conventions & PR Workflow

**CRITICAL: NEVER commit directly to `main`. ALL changes must go through a pull request.**

### Mandatory Workflow for Every Change

```bash
# 1. Start from main (ALWAYS)
git checkout main
git pull

# 2. Create feature branch (REQUIRED)
git checkout -b type/description
# Examples: feat/user-auth, fix/null-pointer, docs/update-readme

# 3. Make changes and commit
git add .
git commit -m "type(scope): description"

# 4. Push branch
git push -u origin type/description

# 5. Create PR
gh pr create --title "type: description" --body "PR description"

# 6. Wait for CI checks to pass (5 jobs must be green)

# 7. Merge PR (only after all checks pass)
gh pr merge --squash --delete-branch

# 8. Return to main
git checkout main
git pull
```

**This workflow applies to:**

- ✅ Feature development
- ✅ Bug fixes
- ✅ Documentation changes
- ✅ Configuration updates
- ✅ Refactoring
- ✅ **EVERYTHING** — no exceptions

### Conventional Commits

Format: `type(scope): description`

**Types:**

- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation only
- `chore` — Tooling, dependencies, config
- `refactor` — Code restructuring (no behavior change)
- `test` — Adding or updating tests
- `ci` — CI/CD pipeline changes

**Examples:**

```
feat(auth): add refresh token rotation
fix(invitations): handle expired token edge case
chore(deps): upgrade prisma to 6.x
docs(openapi): document membership endpoints
refactor(prisma): extract query helpers
test(auth): add login integration tests
ci(github): add codecov upload step
```

**Branch naming:** `type/description-in-kebab-case`

- ✅ `feat/user-authentication`
- ✅ `fix/null-pointer-error`
- ✅ `docs/update-readme`
- ❌ `feature_auth` (wrong format)
- ❌ `fix-bug` (not descriptive)

---

## Environment Variables

Managed via `.env` (gitignored) and `.env.example` (committed).

**`apps/api/.env`**

```
DATABASE_URL=postgresql://...
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
APP_URL=http://localhost:5173
API_URL=http://localhost:3000
NODE_ENV=development
```

**`apps/web/.env`**

```
VITE_API_URL=http://localhost:3000
```

All env vars validated at startup using Zod. App fails fast with a clear error if any required
variable is missing.

---

## Local Development

```bash
# Install dependencies
pnpm install

# Start PostgreSQL via Docker
docker compose up -d db

# Run migrations + seed
pnpm --filter api db:migrate
pnpm --filter api db:seed

# Start API (port 3000) + Web (port 5173) in parallel
pnpm dev

# Run tests
pnpm --filter api test
pnpm --filter web test

# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint
```

---

## Claude Code Workflow

This project uses a full `.claude/` directory structure for disciplined AI-assisted development.

### Rules (always active)

- `.claude/rules/code-style.md` — TypeScript and code quality rules
- `.claude/rules/api-conventions.md` — REST design, error shapes, status codes
- `.claude/rules/testing.md` — test structure, coverage, database reset patterns
- `.claude/rules/git.md` — conventional commits, branch policy

### Commands (invoke with `/command-name`)

- `/review` — pre-PR checklist: types, tests, OpenAPI sync, security, edge cases
- `/add-endpoint` — scaffold a new route: route file + controller + Zod schema + OpenAPI entry +
  test stub
- `/add-migration` — guided Prisma schema change + migration naming + seed update
- `/fix-issue` — structured bug investigation: reproduce → isolate → fix → test

### Skills (auto-loaded based on task context)

- `openapi/` — loaded when working on API spec or generating types
- `prisma/` — loaded when modifying schema or writing migrations
- `rbac/` — loaded when adding permission-guarded routes or membership logic

### Agents (specialized subagents with isolated context)

- `code-reviewer` — security and correctness focused review agent
- `api-designer` — REST design and OpenAPI spec decisions
- `db-architect` — schema design, indexing strategy, query optimization

### Hooks

- `validate-types.sh` — runs `tsc --noEmit` before Claude edits TypeScript files
- `lint-staged.sh` — ESLint + Prettier check triggered pre-commit

---

## OpenAPI & Type Generation

The spec lives in `packages/openapi/openapi.yaml` and is the **source of truth** for the API
contract.

```bash
# Regenerate TypeScript types from spec
pnpm --filter openapi generate:types

# Regenerate Zod schemas from spec
pnpm --filter openapi generate:zod

# Validate spec is well-formed
pnpm --filter openapi validate
```

When adding a new endpoint:

1. Add the route to Express
2. Add the Zod schema to `packages/types`
3. Document the endpoint in `openapi.yaml`
4. Re-run type + schema generation
5. CI will fail if spec and implementation drift

Scalar docs are served at `GET /docs` in development and production.

---

## Security Checklist (for every new endpoint)

- [ ] Is the route behind auth middleware?
- [ ] Is the `tenantId` sourced from `req.tenantId` (JWT/API key context), never from request body?
- [ ] Is the role requirement enforced with `requireRole()`?
- [ ] Are all inputs validated with Zod before touching the database?
- [ ] Are Prisma queries scoped to the correct `organizationId`?
- [ ] Does the error response avoid leaking internal details?
- [ ] Is the endpoint documented in the OpenAPI spec?
- [ ] Are there integration tests covering the 401, 403, and 404 cases?

---

## Current Phase

> Update this section as phases are completed.

**Active:** Phase 2 — Authentication **Next:** Phase 3 — Organization Management **Completed:**

- Phase 0 — Repo & Tooling Setup ✅
- Phase 1 — Database & API Foundation ✅

See `docs/ROADMAP.md` for full checklist.

### Phase 2 Goals

- Implement user registration and login endpoints
- JWT-based authentication (access token + httpOnly refresh token)
- Token refresh and logout flows
- Password hashing with bcrypt
- JWT middleware to extract and verify tokens, attach `req.user` and `req.tenantId`
- API key middleware for programmatic access
- Integration tests for all auth flows
- Document auth endpoints in OpenAPI spec

---

## Key Decisions & Rationale

**Why manual JWT over an auth library?** Auth.js/Clerk abstract away the implementation details this
project intends to demonstrate. Understanding token rotation, httpOnly cookies, and refresh flows is
the point.

**Why cursor pagination over offset?** Offset pagination breaks under concurrent inserts.
Cursor-based is the correct choice for any production API and is worth demonstrating even on a small
dataset.

**Why single-DB multi-tenancy over per-tenant schemas?** Per-tenant schemas don't scale
operationally (migrations across thousands of schemas become painful). Single DB with row-level
`organizationId` is the industry default for early-stage SaaS.

**Why Scalar over Swagger UI?** Scalar is actively maintained, has a significantly better UX,
supports OpenAPI 3.1 natively, and is new enough to be worth learning. Swagger UI is legacy at this
point.

**Why pnpm workspaces?** Faster installs, strict dependency isolation, and native monorepo support
without a separate tool like Turborepo (which can be added later if build caching becomes a
concern).
