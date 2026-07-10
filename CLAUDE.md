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

| Layer           | Choice                                 | Notes                                                        |
| --------------- | -------------------------------------- | ------------------------------------------------------------ |
| Database        | PostgreSQL                             | Via Railway or local Docker                                  |
| ORM             | Prisma 7.8                             | Schema-first, migrations in version control, driver adapters |
| API             | Node.js + Express + TypeScript         | `apps/api`                                                   |
| Validation      | Zod                                    | All request/response I/O validated at runtime                |
| Auth            | JWT (access) + httpOnly refresh cookie | Rolled manually — no auth library abstraction                |
| Frontend        | React + Vite + TypeScript              | `apps/web`                                                   |
| Styling         | Tailwind CSS v4                        | CSS-first config: `@theme` + `@plugin` in `index.css`        |
| Data fetching   | TanStack Query (React Query)           | All server state                                             |
| API Docs        | OpenAPI 3.1 + Scalar                   | Spec in `packages/openapi`, served at `/docs`                |
| Testing         | Vitest + Supertest                     | Integration-first on API; RTL for frontend                   |
| Package manager | pnpm workspaces                        | Run commands from repo root                                  |

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
- **Arrow functions** — use implicit returns when possible: `() => value` instead of `() => { return value }`. Enforced by `arrow-body-style` ESLint rule.
- **Zod for all I/O** — every request body, query param, and env variable validated with Zod. Infer
  TypeScript types from Zod schemas with `z.infer<typeof Schema>` — do not duplicate types.
- **No barrel files** (`index.ts` re-exports) — import directly from source files.
- **Named exports only** — no default exports except React components and route handlers.
- **Error handling:** use the `AppError` class for all known failure modes. Never throw raw strings.
- **Async/await** — no `.then()` chains. Always `try/catch` in Express route handlers.
- **Prisma:** never use `prisma.$queryRaw` unless there is no alternative. Document why if you do.
- **Tailwind v4 configuration:** All config in CSS using `@theme` for colors and `@plugin` for plugins in `apps/web/src/index.css`. No `tailwind.config.ts` needed. Use `--color-{name}-{shade}` format for color scales (e.g., `--color-brand-500`).

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

## Logging Conventions

- **Use Winston logger** — never use `console.log`, `console.error`, or `console.warn` in production code
- **Security events use WARN level** — `logAuthFailure()`, `logAuthorizationFailure()`, `logSensitiveOperation()`
- **Business events use INFO level** — `logUserRegistration()`, `logMembershipChanged()`, `logApiKeyEvent()`
- **Errors logged automatically** — error handler middleware logs all errors with context
- **Never log sensitive data:**
  - ❌ Passwords (plaintext or hashed)
  - ❌ JWT tokens (access or refresh)
  - ❌ API keys (plaintext - only log key name/ID)
  - ❌ `req.body` on auth endpoints (contains passwords)
  - ❌ `req.headers.authorization` (contains tokens)
  - ✅ Email addresses OK for user events (not error logs)
  - ✅ IP addresses OK for security events only
- **Use structured logging** — pass objects, not string concatenation
  - ✅ `logger.info('User registered', { userId, email, orgId })`
  - ❌ ~~`logger.info(\`User ${email} registered\`)`~~
- **Security logging helpers:**
  - `logAuthFailure()` - failed logins, invalid tokens
  - `logAuthorizationFailure()` - 403 errors, RBAC violations
  - `logSensitiveOperation()` - password changes, email changes
  - `logSecurityEvent()` - generic security event with request context
- **Business logging helpers:**
  - `logUserRegistration()` / `logUserLogin()` / `logUserLogout()`
  - `logOrganizationCreated()` / `logOrganizationUpdated()`
  - `logMembershipChanged()` - role changes, additions, removals
  - `logInvitationEvent()` - created, accepted, revoked
  - `logApiKeyEvent()` - created, revoked
- **Reference:** See `docs/LOGGING.md` for comprehensive logging architecture and examples

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

**Root `.env` (for Docker Compose)**

```
POSTGRES_USER=plinth_dev
POSTGRES_PASSWORD=<generated-via-openssl-rand-base64-32>
POSTGRES_DB=plinth_dev
POSTGRES_PORT=5432
```

**`apps/api/.env`**

```
# Must match credentials in root .env
DATABASE_URL=postgresql://plinth_dev:<password>@db:5432/plinth_dev
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
BCRYPT_WORK_FACTOR=10
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
API_URL=https://localhost
NODE_ENV=development
PORT=3000
```

**`apps/web/.env`**

```
VITE_API_URL=https://localhost
```

All env vars validated at startup using Zod. App fails fast with a clear error if any required
variable is missing.

**Security Note - Auto-Generated Credentials:**

Passwords are auto-generated during `make setup` using cryptographically secure methods:

- **Database password:** `openssl rand -hex 32` (64 chars, URL-safe, 256-bit entropy)
- **JWT secrets:** `openssl rand -base64 32` (44 chars, 264-bit entropy)

**Why hex for database, base64 for JWT?**

- Database passwords appear in URLs (`postgresql://user:PASSWORD@host/db`)
- Hex uses only `[0-9a-f]` (URL-safe, no encoding needed)
- Base64 uses `/`, `+`, `=` (requires URL encoding: `%2F`, `%2B`, `%3D`)
- JWT secrets never appear in URLs, so base64 is preferred (shorter for same entropy)

**Defense-in-depth validation:**

1. `.env.example` placeholders: Empty strings intentionally fail to prevent accidental use
2. Zod validation (`apps/api/src/lib/env.ts`): Validates format, length, and encoding
3. Application pre-flight check (`apps/api/src/server.ts`): Runs even if Zod is bypassed
4. PostgreSQL authentication: Final backstop (rejects wrong credentials)

---

## Local Development

**Prerequisites:**

- Docker 24+ and Docker Compose v2
- Make (standard on macOS/Linux)
- No Node.js/pnpm installation required (runs inside containers)

All development happens inside Docker containers. The `make` command provides a unified interface for all operations.

### Quick Start

```bash
# First-time setup (creates .env files, builds images, runs migrations, seeds data)
make setup

# Start all services (db + api + web) with hot-reload
make dev

# Stop all services
make stop
```

### Daily Development

```bash
# View all available commands
make help

# Start services
make dev             # Start all services with logs (Ctrl+C to stop)
make dev-detached    # Start all services in background
make stop            # Stop all services
make restart         # Restart API and Web services

# View logs
make logs            # Tail all service logs
make logs-api        # Tail API logs only
make logs-web        # Tail Web logs only
make logs-db         # Tail database logs only

# Debug containers
make shell-api       # Open shell in API container
make shell-web       # Open shell in Web container
make shell-db        # Open PostgreSQL shell
```

### Database Management

```bash
make db-migrate      # Run Prisma migrations
make db-seed         # Seed database with test data
make db-reset        # Reset database (⚠️  destructive!)
make db-studio       # Open Prisma Studio GUI (http://localhost:5555)
```

### Testing

**Two testing approaches available:**

#### 1. Quick Development Testing (use running containers)

```bash
make test            # Run all tests (API + Web) in development containers
make test-api        # API tests only
make test-web        # Web tests only
make test-coverage   # Run tests with coverage report
```

**Best for:** Fast feedback during TDD/development workflow. Requires services to be running (`make dev`).

**Tradeoffs:**

- ✅ Fast (~seconds)
- ✅ Uses existing containers
- ⚠️ Tests run against development database (shared state)
- ⚠️ May be affected by existing dev data

#### 2. Isolated CI-Parity Testing (fresh containers)

```bash
make test-docker       # Run all tests in isolated test environment (like CI)
make test-docker-api   # API tests only (isolated)
make test-docker-web   # Web tests only (isolated)
make test-docker-clean # Clean up test containers and volumes
```

**Best for:** Pre-commit validation, debugging CI failures, ensuring tests pass in clean environment.

**Tradeoffs:**

- ✅ Complete isolation (separate database on port 5433)
- ✅ Exact CI environment match
- ✅ Fresh containers and volumes
- ⚠️ Slower (~30s setup time)
- ⚠️ More resource intensive

**Recommended workflow:**

```bash
# Daily development: fast feedback loop
make test

# Before committing: final validation
make test-docker
```

### Code Quality

```bash
make lint            # Run ESLint (API + Web)
make lint-fix        # Fix auto-fixable lint issues
make format          # Format code with Prettier
make format-check    # Check code formatting
make typecheck       # Run TypeScript type checking
make check           # Run ALL checks (lint + format + typecheck)
```

### Build & Cleanup

```bash
make build           # Build production Docker images
make rebuild         # Rebuild containers without cache
make clean           # Stop services and remove volumes
```

### How It Works

All commands execute inside Docker containers:

- **Caddy container**: Reverse proxy (port 80) — routes traffic to API and Web services
- **API container**: Node.js 24 + Express + Prisma with `tsx watch` for hot-reload (internal port 3000)
- **Web container**: Node.js 24 + Vite with Hot Module Replacement (HMR) (internal port 5173)
- **Database container**: PostgreSQL 15 Alpine (internal port 5432)

### Reverse Proxy Architecture (Production Parity)

Development uses **Caddy** as a reverse proxy to match production's AWS ALB pattern:

```
Browser (https://localhost)
    ↓
Caddy Container (ports 80/443, auto-generates self-signed cert)
    ├─ /api/*  → API Container (port 3000, internal only)
    └─ /*      → Web Container (port 5173, internal only)
```

**Benefits:**

- ✅ Single entry point (HTTPS with automatic self-signed certificate)
- ✅ Services not directly exposed to host
- ✅ Matches production architecture (Caddy → ALB)
- ✅ Clean URLs (no port numbers in browser)
- ✅ Production-parity HTTPS for testing secure contexts (cookies, service workers, etc.)

**Access URLs:**

- Frontend: https://localhost
- API: https://localhost/api/v1/\*
- API Health: https://localhost/health
- API Docs: https://localhost/docs

**IMPORTANT for Development:**

- All services run inside Docker containers - no local Node.js/pnpm required
- Browser requests to `https://localhost` are routed by Caddy reverse proxy
- Caddy automatically generates a self-signed certificate for localhost (browser will show security warning - this is normal for local development)
- Web app uses `VITE_API_URL=https://localhost` (browser makes requests through Caddy)
- API container uses `PORT=3000` internally, but is NOT exposed directly to host
- Web container uses port 5173 internally, but is NOT exposed directly to host

Source code is volume-mounted into containers, so changes are instantly reflected. `node_modules` are isolated in Docker volumes to avoid permission issues.

**Internal pnpm usage:** The Makefile delegates to `docker compose exec <service> pnpm <command>`. You don't run pnpm directly on your host machine.

See [docs/DOCKER.md](docs/DOCKER.md) for architecture details and troubleshooting.

---

## Claude Code Workflow

This project uses a full `.claude/` directory structure for disciplined AI-assisted development.

### Personal Overrides (CLAUDE.local.md)

You can create a **CLAUDE.local.md** file at the project root for personal preferences and local-only instructions. This file is gitignored and will not be committed.

**Use CLAUDE.local.md for:**

- Personal coding preferences (e.g., "Always add JSDoc comments to exported functions")
- Local environment details (e.g., "I use VS Code with Vim keybindings")
- Workflow customizations (e.g., "Run tests after every file edit")
- Temporary project context (e.g., "I'm currently working on the billing dashboard")
- Personal reminders (e.g., "Always ask before making database schema changes")

**What NOT to put in CLAUDE.local.md:**

- Project conventions (those belong in CLAUDE.md or `.claude/rules/`)
- Team-wide guidelines (those belong in the main codebase)
- Sensitive information (use environment variables instead)

Both CLAUDE.md and CLAUDE.local.md (if present) are loaded at session start. CLAUDE.local.md instructions take precedence over CLAUDE.md when there's a conflict.

### Rules (always active)

- `.claude/rules/code-style.md` — TypeScript and code quality rules
- `.claude/rules/api-conventions.md` — REST design, error shapes, status codes
- `.claude/rules/testing.md` — test structure, coverage, database reset patterns
- `.claude/rules/git.md` — conventional commits, branch policy
- `.claude/rules/security.md` — OWASP Top 10 2025 security controls (A01-A10)

### Commands (invoke with `/command-name`)

- `/review` — pre-PR checklist: types, tests, OpenAPI sync, OWASP Top 10 security, edge cases
- `/security-audit` — comprehensive security audit (OWASP Top 10 2025 + threat modeling)
- `/add-endpoint` — scaffold a new route: route file + controller + Zod schema + OpenAPI entry +
  test stub
- `/add-migration` — guided Prisma schema change + migration naming + seed update
- `/fix-issue` — structured bug investigation: reproduce → isolate → fix → test

### Skills (auto-loaded based on task context)

- `openapi/` — loaded when working on API spec or generating types
- `prisma/` — loaded when modifying schema or writing migrations
- `rbac/` — loaded when adding permission-guarded routes or membership logic
- `security/` — loaded when addressing security vulnerabilities or conducting security reviews

### Agents (specialized subagents with isolated context)

- `code-reviewer` — security and correctness focused review agent (OWASP Top 10 2025 enhanced)
- `security-auditor` — specialized security audit agent (threat modeling, vulnerability analysis)
- `api-designer` — REST design and OpenAPI spec decisions
- `db-architect` — schema design, indexing strategy, query optimization

### Hooks

- `validate-types.sh` — runs `tsc --noEmit` before Claude edits TypeScript files
- `lint-staged.sh` — ESLint + Prettier check triggered pre-commit
- `security-check.sh` — OWASP Top 10 validation (blocks critical issues, warns on moderate)

---

## OpenAPI & Type Generation

The spec lives in `packages/openapi/openapi.yaml` and is the **source of truth** for the API
contract.

```bash
# Generate TypeScript types from spec (for frontend)
pnpm --filter openapi generate:types

# Validate spec is well-formed
pnpm --filter openapi validate
```

### Architecture Decision: Hand-Written Zod Schemas

**Backend validation:** Hand-written Zod schemas in `apps/api/src/lib/validation/` provide:

- More ergonomic validation with custom error messages
- Direct control over refinements and transforms
- Easier iteration during development
- Better TypeScript inference

**Frontend types:** Generated from OpenAPI spec using `openapi-typescript` into `packages/types`.
This provides type safety for API consumers without coupling them to backend validation logic.

### Workflow for Adding a New Endpoint:

1. Write the Zod validation schema in `apps/api/src/lib/validation/`
2. Implement the route handler in `apps/api/src/routes/`
3. Document the endpoint in `packages/openapi/openapi.yaml` with request/response schemas
4. Validate the spec: `pnpm --filter openapi validate`
5. Generate frontend types: `pnpm --filter openapi generate:types` (when frontend is ready)
6. Keep OpenAPI spec and Zod schemas in sync manually (validated by integration tests)

Scalar docs are served at `GET /docs` in development and production.

---

## Security Framework (OWASP Top 10 2025)

This project implements comprehensive security controls based on the OWASP Top 10 2025 framework with graduated enforcement:

- **🔴 CRITICAL (Block on commit):** A01 Broken Access Control, A02 Security Misconfiguration, A03 Supply Chain Failures
- **🟡 MODERATE (Warn on commit):** A04 Cryptographic Failures, A05 Injection, A07 Authentication Failures
- **🔵 ADVISORY (Guidance only):** A06 Insecure Design, A08 Data Integrity, A09 Logging/Alerting, A10 Exception Handling

### Security Workflow Integration

**Always Active:**

- `.claude/rules/security.md` — Enforced during all development activities
- `.claude/hooks/security-check.sh` — Pre-commit validation blocks critical issues
- `.claude/agents/code-reviewer.json` — Enhanced with OWASP Top 10 focus

**On-Demand:**

- `/security-audit` command — Deep security review of entire codebase
- `security-auditor` agent — Specialized threat modeling and vulnerability analysis
- `.claude/skills/security/` — Comprehensive OWASP Top 10 guidance (auto-loaded for security tasks)

### Security Checklist (for every new endpoint)

**Access Control (A01 - CRITICAL):**

- [ ] Route protected with `authenticate` middleware
- [ ] `tenantId` sourced from `req.tenantId` (JWT/API key), NEVER from request body/query
- [ ] Role requirement enforced with `requireRole()` middleware
- [ ] Prisma queries scoped to `organizationId` where applicable
- [ ] Horizontal privilege escalation prevented (user A cannot access user B's resources)
- [ ] 404 vs 403 pattern followed (don't leak org existence to non-members)

**Authentication (A07 - MODERATE):**

- [ ] Generic error messages (prevent account enumeration)
- [ ] Timing normalization on auth failures (200ms minimum via `normalizeAuthTiming()`)
- [ ] Rate limiting appropriate for endpoint sensitivity
- [ ] Email verification (Phase 8+): verify email ownership before account activation

**Input Validation (A05 - MODERATE):**

- [ ] All inputs validated with Zod before database operations
- [ ] No `$queryRawUnsafe` or `$executeRawUnsafe` usage
- [ ] No `dangerouslySetInnerHTML` without DOMPurify sanitization

**Configuration (A02 - CRITICAL):**

- [ ] Error responses sanitized (no stack traces, internal paths, or sensitive data)
- [ ] Security headers configured (helmet middleware)
- [ ] No hardcoded secrets in code

**Testing:**

- [ ] Integration tests covering 401, 403, 404 cases
- [ ] Horizontal escalation test (access another user's resource)
- [ ] RBAC edge case tests (owner protection, last owner, etc.)

**Documentation:**

- [ ] Endpoint documented in OpenAPI spec
- [ ] Required role documented
- [ ] Security considerations noted (if any)

---

## Current Phase

> Update this section as phases are completed.

**Active:** Phase 5 — React Frontend (5a-5f Complete, 5g-5j In Progress)
**Next:** Phase 6 — Claude Code AI Integration Showcase
**Completed:**

- Phase 0 — Repo & Tooling Setup ✅
- Phase 1 — Database & API Foundation ✅
- Phase 2 — Authentication ✅
- Phase 3 — Multi-Tenancy Core ✅ (2026-05-28)
- Phase 4 — OpenAPI Spec & Scalar Docs ✅ (2026-05-28)
- Phase 5a-5f — Frontend Foundation ✅ (2026-05-29)

See `docs/ROADMAP.md` for full checklist.

### Phase 3 Accomplishments ✅

**Completion Date:** 2026-05-28
**Security Audit Score:** 98/100
**Test Coverage:** 87 tests, 91%+ coverage

Delivered:

- ✅ Organization CRUD operations (4 endpoints)
- ✅ Member management with cursor pagination (4 endpoints)
- ✅ Invitation system with token hashing (5 endpoints)
- ✅ API key management with scopes (3 endpoints)
- ✅ RBAC enforcement with `requireRole()` middleware
- ✅ Owner transfer flow with atomic demotion
- ✅ Last owner protection (remove & demote blocked)
- ✅ Cross-tenant isolation (404 vs 403 pattern)
- ✅ SHA-256 token/key hashing, single-use enforcement
- ✅ Comprehensive integration tests (87 total)
- ✅ Complete OpenAPI 3.1 specification

**Files Created:**

- 5 route handlers (orgs, members, invitations, org-invitations, api-keys)
- 4 validation schema files (Zod)
- 2 crypto utility libraries
- 4 test suites with 87 tests
- 1 database migration (schema enhancements)

### Phase 4 Accomplishments ✅

**Completion Date:** 2026-05-28
**OpenAPI Quality Score:** 98/100 (after improvements)
**Security Score:** 92/100 (PASS)
**Validation Score:** 95%+ consistency with implementation

Delivered:

- ✅ Comprehensive OpenAPI 3.1 specification for all 22 endpoints
- ✅ Realistic request/response examples with proper ID formats
- ✅ Complete error code examples (14 additional codes documented)
- ✅ CI integration with drift detection
- ✅ TypeScript type generation from OpenAPI spec
- ✅ Security review and audit (no critical issues)
- ✅ Testing strategy designed (hybrid automated + manual)
- ✅ Documentation cleanup (removed generate:zod references)
- ✅ Architecture clarification (hand-written Zod for backend)
- ✅ Scalar UI served at `/docs` endpoint

**Key Improvements:**

- Fixed development server URL (3001 → 3000)
- Replaced example passwords with secure placeholders
- Added security notes to public endpoints
- Added 41+ example sections across all endpoints
- Comprehensive pagination examples (first/last page)
- Enhanced endpoint descriptions with edge cases

**Files Modified:**

- `packages/openapi/openapi.yaml` - Comprehensive enhancements
- `packages/openapi/README.md` - Architecture documentation
- `.github/workflows/ci.yml` - OpenAPI validation job
- `.claude/commands/review.md` - Updated workflow
- `.claude/skills/openapi/context.md` - Clarified architecture

### Phase 5a-5f Accomplishments ✅

**Completion Date:** 2026-05-29
**Status:** Foundation Complete (Members/Invitations/Settings/API Keys Remaining)
**Test Infrastructure:** Vitest + RTL + MSW configured

Delivered:

- ✅ Project setup: Vite 8 + React 19 + TypeScript 5.9 + Tailwind 4.3
- ✅ API client with automatic token refresh on 401
- ✅ TanStack Query configured with exponential backoff retry
- ✅ React Router 7 with protected routes and layout-based structure
- ✅ 8 shared UI primitives (Button, Input, Modal, LoadingSpinner, ErrorMessage, EmptyState, Card, Badge)
- ✅ Auth system: Register/Login pages with Zod validation
- ✅ AuthContext provider with localStorage persistence
- ✅ ProtectedRoute wrapper with redirect preservation
- ✅ OrgContext provider for active organization tracking
- ✅ Dashboard layout with top nav + sidebar
- ✅ OrgSwitcher component (dropdown, auto-fetch memberships)
- ✅ UserMenu component (avatar, sign out)
- ✅ Dashboard home page (auto-select first org)
- ✅ Testing infrastructure: Vitest + RTL + MSW server/handlers
- ✅ Complete implementation guide for remaining features (900+ lines)

**Files Created:**

- Configuration: vite.config.ts, tailwind.config.ts, vitest.config.ts, postcss.config.js, vite-env.d.ts
- Infrastructure: api-client.ts, query-client.ts, router.tsx, main.tsx, App.tsx
- Shared: 8 UI components in shared/components/
- Auth: AuthContext.tsx, ProtectedRoute.tsx, LoginPage.tsx, RegisterPage.tsx
- Organizations: OrgContext.tsx, OrgSwitcher.tsx, UserMenu.tsx, DashboardLayout.tsx, DashboardPage.tsx
- Testing: setup.ts, server.ts, handlers.ts
- Documentation: docs/FRONTEND_PATTERNS.md

**Dependencies Added:**

- react@19.2, react-dom@19.2, react-router-dom@7
- @tanstack/react-query@5.76, axios@1.7
- tailwindcss@4.3, @tailwindcss/forms@0.5
- zod@3.25
- vitest@3, @testing-library/react@17, @testing-library/jest-dom@6
- msw@2.7
- @plinth/types (workspace dependency)

**Key Architectural Patterns:**

- State Management: Server state (TanStack Query) + Global client state (Context) + Local UI state (useState)
- Type Safety: Using generated @plinth/types from OpenAPI spec
- Accessibility: Semantic HTML, ARIA attributes, keyboard navigation, focus management
- Design System: Tailwind design tokens (brand-500, success, warning, danger)
- Testing: MSW for API mocking, RTL for component testing

---

## Key Decisions & Rationale

**Why manual JWT over an auth library?**
Auth.js/Clerk abstract away the implementation details this project intends to demonstrate.
Understanding token rotation, httpOnly cookies, and refresh flows is the point.

**Why cursor pagination over offset?**
Offset pagination breaks under concurrent inserts. Cursor-based is the correct choice for any
production API and is worth demonstrating even on a small dataset.

**Why single-DB multi-tenancy over per-tenant schemas?**
Per-tenant schemas don't scale operationally (migrations across thousands of schemas become painful).
Single DB with row-level `organizationId` is the industry default for early-stage SaaS.

**Why Scalar over Swagger UI?**
Scalar is actively maintained, has a significantly better UX, supports OpenAPI 3.1 natively,
and is new enough to be worth learning. Swagger UI is legacy at this point.

**Why pnpm workspaces?**
Faster installs, strict dependency isolation, and native monorepo support without a separate tool
like Turborepo (which can be added later if build caching becomes a concern).
