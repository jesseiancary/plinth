# @plinth/web

React + Vite + TypeScript frontend for the Plinth SaaS platform.

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with API URL

# Start development server
pnpm dev
```

## Available Scripts

- `pnpm dev` — Start development server
- `pnpm build` — Build for production
- `pnpm preview` — Preview production build
- `pnpm test` — Run tests
- `pnpm typecheck` — Type check without emitting files
- `pnpm lint` — Lint source files

## Project Structure

```
src/
  components/      # React components
  pages/           # Page components
  hooks/           # Custom React hooks
  lib/             # API client, utilities
  styles/          # Global styles
  App.tsx          # Root component
  main.tsx         # Entry point
```

## Environment Variables

See `.env.example` for required variables.
