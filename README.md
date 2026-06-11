# Plinth

[![CI](https://github.com/jesseiancary/plinth/actions/workflows/ci.yml/badge.svg)](https://github.com/jesseiancary/plinth/actions/workflows/ci.yml)

A production-grade multi-tenant SaaS starter built as a public portfolio project.

**Project Status:** Phase 1 Complete (Database & API Foundation) — Phase 2 In Progress
(Authentication)

## Overview

Plinth demonstrates a production-ready SaaS foundation with:

- Multi-tenant architecture (single database, row-level isolation)
- RESTful API with OpenAPI specification
- Disciplined development workflow with CI/CD and branch protection
- Thoughtful use of AI-assisted development (Claude Code)

This is a **portfolio project** showcasing both technical architecture and development process.

## Features

### Implemented ✅

- Multi-tenant database schema with Prisma
- Organization, User, Membership, Invitation, ApiKey models
- Role-based access control foundation (Owner, Admin, Member)
- Express API with comprehensive middleware stack
- Health check endpoint with database connectivity
- Scalar API documentation UI
- Full CI/CD pipeline (Lint, Type Check, Test, Build, OpenAPI Validate)
- GitHub branch protection and PR workflow
- Integration test suite with Vitest + Supertest

### Planned 🚧

- JWT-based authentication with refresh tokens
- User registration and login endpoints
- Organization management endpoints
- Invitation flow for team collaboration
- API key generation and management
- Frontend (React + Vite + Tailwind)
- Type-safe API client generated from OpenAPI spec

## Tech Stack

### Backend

- **Runtime:** Node.js 18+ with TypeScript (strict mode, ESM)
- **Framework:** Express.js with middleware stack
- **Database:** PostgreSQL 15 + Prisma ORM
- **Validation:** Zod (runtime type validation)
- **API Docs:** OpenAPI 3.1 + Scalar UI

### Frontend (Planned)

- **Framework:** React + Vite
- **Styling:** Tailwind CSS
- **Data Fetching:** TanStack Query (React Query)

### Development Tools

- **Package Manager:** pnpm workspaces (monorepo)
- **Testing:** Vitest + Supertest (integration-first)
- **Linting:** ESLint with TypeScript rules
- **Formatting:** Prettier
- **Git Hooks:** Husky + lint-staged
- **CI/CD:** GitHub Actions (5-job pipeline)
- **Containerization:** Docker Compose

## Architecture

### Database Schema

**6 Models (Prisma):**

```
User
├── id, email (unique), password (hashed), name
└── → Membership[]

Organization
├── id, name, slug (unique, indexed)
└── → Membership[], Invitation[], ApiKey[]

Membership (join table)
├── userId → User
├── organizationId → Organization
├── role: OWNER | ADMIN | MEMBER
└── unique [userId, organizationId]

Invitation
├── id, email, token (unique), role
├── organizationId → Organization
├── invitedBy (userId)
└── expiresAt, acceptedAt

ApiKey
├── id, name, keyHash (unique)
├── organizationId → Organization
└── lastUsedAt

WebhookEvent (future)
├── id, provider, eventType
├── payload (JSON), idempotencyKey (unique)
└── processedAt
```

**Tenant Isolation:** Single database with `organizationId` on all tenant resources. All queries
filtered by `organizationId` at application layer.

### API Architecture

**Express Middleware Stack:**

1. Helmet (security headers)
2. CORS
3. JSON body parser
4. Cookie parser (for refresh tokens)
5. Morgan (request logging)
6. Rate limiting (100 req/15min)
7. Application routes
8. 404 handler
9. Global error handler (Zod + Prisma + AppError)

**Error Response Format:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

### Project Structure

```
plinth/
├── apps/
│   ├── api/                      # Express REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # Database schema
│   │   │   └── seed.ts           # Test data
│   │   └── src/
│   │       ├── lib/
│   │       │   ├── env.ts        # Zod env validation
│   │       │   ├── errors.ts     # AppError class
│   │       │   └── prisma.ts     # Client singleton
│   │       ├── middleware/
│   │       │   ├── error-handler.ts
│   │       │   └── not-found.ts
│   │       ├── routes/
│   │       │   ├── health.ts
│   │       │   └── health.test.ts
│   │       ├── app.ts            # Express setup
│   │       └── server.ts         # HTTP server
│   │
│   └── web/                      # React frontend (placeholder)
│
├── packages/
│   ├── openapi/                  # OpenAPI 3.1 spec
│   └── types/                    # Shared TypeScript types
│
├── .claude/                      # AI development workflow
│   ├── rules/                    # Code style, API conventions, testing
│   ├── commands/                 # Repeatable workflows (/review, /add-endpoint)
│   ├── skills/                   # Auto-loaded context (openapi, prisma, rbac)
│   └── agents/                   # Specialized subagents
│
├── .github/workflows/
│   └── ci.yml                    # 5-job CI pipeline
│
├── docs/
│   ├── ROADMAP.md               # Phase-by-phase plan
│   └── GITHUB_SETUP.md          # GitHub CLI workflow
│
├── docker-compose.yml           # PostgreSQL service
├── pnpm-workspace.yaml
└── CLAUDE.md                    # Project context for AI development
```

### CI/CD Pipeline

**5 GitHub Actions jobs (run in parallel):**

1. **Lint** — ESLint with TypeScript type-checking
2. **Type Check** — `tsc --noEmit` across workspace
3. **Test** — Vitest integration tests with PostgreSQL service
4. **Validate OpenAPI Spec** — Schema validation
5. **Build** — Production build with Prisma client generation

**Branch Protection:**

- All changes require PR with passing CI checks
- Squash merge preferred (clean history)
- Auto-delete branches after merge

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- PostgreSQL 14+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/plinth.git
cd plinth

# Install dependencies
pnpm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Edit .env files with your configuration if needed

# Run database migrations (database will be started automatically)
docker compose up -d db
pnpm --filter api db:migrate

# Seed the database
pnpm --filter api db:seed

# Start all services (database + API + Web)
pnpm dev
```

**Services will be running at:**

- API: `http://localhost:3000`
- API Docs: `http://localhost:3000/docs`
- PostgreSQL: `localhost:5432`
- Web: `http://localhost:5173`

### Test Data

The seed script creates:

- **User:** `admin@example.com` / `password123`
- **Organization:** Acme Corporation (slug: `acme`)
- **Membership:** Admin user is OWNER of Acme

### Current API Endpoints

| Method | Endpoint  | Description                                  |
| ------ | --------- | -------------------------------------------- |
| GET    | `/health` | Health check with database connectivity test |
| GET    | `/docs`   | Scalar API documentation UI                  |

_More endpoints coming in Phase 2 (Authentication) and Phase 3 (Organizations)_

## Development

### Quick Start

```bash
# Start all services (database + API + web)
pnpm dev

# Or use Make (alternative interface)
make dev

# Stop services when done
pnpm stop        # or: make stop
```

### Using Make (Optional)

This project includes a **Makefile** for convenient development commands. All `pnpm` commands still work as before—the Makefile is an optional, polyglot-friendly interface.

```bash
# View all available commands
make help

# Common workflows
make dev          # Start all services
make stop         # Stop all services
make test         # Run tests
make check        # Run lint + format + typecheck
make db-migrate   # Run database migrations
make db-seed      # Seed database

# First-time setup (one command does everything)
make setup
```

**When to use Make:**

- Coming from Go/Python/Rust background
- Adding non-Node.js services in the future
- Prefer conventional Unix-style commands
- Want self-documenting help menu (`make help`)

**When to use pnpm:**

- Prefer Node.js ecosystem conventions
- Using IDE npm script panels
- Writing CI/CD workflows (explicit dependencies)

See [docs/MAKEFILE.md](docs/MAKEFILE.md) for detailed Makefile documentation and patterns for adding Go/Python services.

---

### All Development Commands

**Using pnpm:**

```bash
pnpm dev          # Start all services
pnpm test         # Run tests
pnpm typecheck    # Type check
pnpm lint         # Run linters
pnpm build        # Build for production
pnpm stop         # Stop services
```

**Using Make:**

```bash
make dev          # Start all services
make test         # Run tests
make check        # Lint + format + typecheck
make build        # Build for production
make stop         # Stop services
make help         # Show all commands
```

Both interfaces call the same underlying scripts—use whichever you prefer.

---

### Database Management

```bash
# Generate Prisma client
pnpm --filter api db:generate

# Create a new migration
pnpm --filter api db:migrate

# Deploy migrations (CI/production)
pnpm --filter api db:migrate:deploy

# Reset database (drop all data)
pnpm --filter api db:reset

# Seed database with test data
pnpm --filter api db:seed
```

## Code Conventions

### TypeScript Style

- **Strict mode** enabled across all packages
- No `any` types (use `unknown` + type guards)
- `const` only (no `let` unless reassignment truly required)
- Named exports only (except React components)
- ESM modules (`import`/`export`)

### Validation & Types

- **Zod schemas** for all I/O validation (request/response)
- Types inferred from Zod: `z.infer<typeof Schema>`
- Never duplicate types — single source of truth

### Error Handling

- Use `AppError` class for all known failures
- `async`/`await` only (no `.then()` chains)
- Always `try/catch` in Express route handlers

### Testing

- **Integration-first:** Test through HTTP layer (Supertest)
- Tests colocated with source (`*.test.ts` next to `*.ts`)
- Database reset before each test
- 80% coverage threshold on API

### Git Workflow

- **Conventional commits:** `type(scope): description`
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`
- Branch naming: `feat/`, `fix/`, `docs/`, `chore/`
- All changes via PR with passing CI checks

See [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) for complete GitHub CLI workflow.

## Project Documentation

- [CLAUDE.md](CLAUDE.md) — Project context and AI development workflow
- [docs/ROADMAP.md](docs/ROADMAP.md) — Phase-by-phase development plan
- [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) — GitHub CLI workflow reference
- [apps/api/README.md](apps/api/README.md) — API documentation
- [packages/openapi/README.md](packages/openapi/README.md) — API specification

## License

MIT

## Contributing

This is a portfolio project and not currently accepting contributions. Feel free to fork and adapt
for your own use.
