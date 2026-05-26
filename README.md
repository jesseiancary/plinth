# Plinth

A production-grade multi-tenant SaaS starter built as a public portfolio project.

## Features

- Multi-tenant architecture with organization-based isolation
- Role-based access control (Owner, Admin, Member)
- Invitation flow for team collaboration
- API key management for programmatic access
- JWT-based authentication with refresh tokens
- Full OpenAPI 3.1 specification
- Type-safe API client generated from OpenAPI spec
- Comprehensive test coverage

## Tech Stack

- **API:** Node.js + Express + TypeScript
- **Frontend:** React + Vite + Tailwind CSS
- **Database:** PostgreSQL + Prisma ORM
- **Validation:** Zod
- **API Docs:** OpenAPI 3.1 + Scalar
- **Testing:** Vitest + Supertest + React Testing Library
- **Package Manager:** pnpm workspaces

## Project Structure

```
/apps
  /api        Node.js + Express + TypeScript — REST API
  /web        React + Vite + Tailwind — Frontend
/packages
  /types      Shared TypeScript types
  /openapi    OpenAPI 3.1 spec + type generation
/.claude
  /rules      Code style, API conventions, testing, git
  /commands   Slash commands for workflows
  /skills     Auto-loaded context for domains
  /agents     Specialized subagents
  /hooks      Event-driven scripts
```

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
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL (using Docker)
docker compose up -d db

# Run database migrations
pnpm --filter api db:migrate

# Seed the database
pnpm --filter api db:seed

# Start development servers (API + Web)
pnpm dev
```

The API will be running at `http://localhost:3000` and the web app at `http://localhost:5173`.

### API Documentation

Interactive API documentation is available at `http://localhost:3000/docs` when the API server is running.

## Development

```bash
# Start all apps in development mode
pnpm dev

# Run tests
pnpm test

# Type check all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Build for production
pnpm build
```

## Project Documentation

- [CLAUDE.md](CLAUDE.md) — Project overview and AI development workflow
- [API README](apps/api/README.md) — API documentation
- [Web README](apps/web/README.md) — Frontend documentation
- [OpenAPI README](packages/openapi/README.md) — API specification

## License

MIT

## Contributing

This is a portfolio project and not currently accepting contributions. Feel free to fork and adapt for your own use.
