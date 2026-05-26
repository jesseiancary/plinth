# @plinth/openapi

OpenAPI 3.1 specification for the Plinth API.

## Files

- `openapi.yaml` — API specification (source of truth)

## Scripts

```bash
# Validate spec
pnpm validate

# Generate TypeScript types
pnpm generate:types

# Generate Zod schemas
pnpm generate:zod
```

## Viewing Documentation

The API documentation is served at `http://localhost:3000/docs` when the API server is running.

## Editing the Spec

1. Edit `openapi.yaml`
2. Run `pnpm validate` to check syntax
3. Run `pnpm generate:types` and `pnpm generate:zod` to update generated code
4. Commit both the spec and generated files
