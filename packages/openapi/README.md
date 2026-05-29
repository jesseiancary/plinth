# @plinth/openapi

OpenAPI 3.1 specification for the Plinth API.

## Files

- `openapi.yaml` — API specification (source of truth)

## Scripts

```bash
# Validate spec
pnpm validate

# Generate TypeScript types for frontend
pnpm generate:types
```

## Viewing Documentation

The API documentation is served at `http://localhost:3000/docs` when the API server is running.

## Editing the Spec

1. Edit `openapi.yaml`
2. Run `pnpm validate` to check syntax
3. Run `pnpm generate:types` to update frontend types
4. Commit both the spec and generated files

## Architecture

**Backend validation:** Hand-written Zod schemas in `apps/api/src/lib/validation/`

- Provides custom error messages and refinements
- Source of truth for runtime validation

**Frontend types:** Auto-generated from OpenAPI spec into `packages/types`

- Provides type safety for API consumers
- Generated via `openapi-typescript`

**Sync strategy:** Manually keep Zod schemas and OpenAPI spec in sync. Integration tests validate responses match expected shapes.
