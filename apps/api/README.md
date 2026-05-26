# @plinth/api

Node.js + Express + TypeScript REST API for the Plinth SaaS platform.

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Start development server
pnpm dev
```

## Available Scripts

- `pnpm dev` — Start development server with hot reload
- `pnpm build` — Build for production
- `pnpm start` — Start production server
- `pnpm test` — Run tests
- `pnpm test:watch` — Run tests in watch mode
- `pnpm typecheck` — Type check without emitting files
- `pnpm lint` — Lint source files
- `pnpm db:migrate` — Run database migrations
- `pnpm db:seed` — Seed database with test data
- `pnpm db:studio` — Open Prisma Studio

## Project Structure

```
src/
  routes/          # Express route handlers
  controllers/     # Business logic
  middleware/      # Auth, validation, error handling
  lib/             # Utilities, Prisma client, errors
  types/           # TypeScript types
  server.ts        # Server entry point
  app.ts           # Express app configuration
prisma/
  schema.prisma    # Database schema
  migrations/      # Migration files
  seed.ts          # Database seed script
```

## Environment Variables

See `.env.example` for required variables.
