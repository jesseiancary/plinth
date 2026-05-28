# @plinth/types

Shared TypeScript types for the Plinth API, generated from the OpenAPI specification.

## Usage

```typescript
import type { paths, components } from '@plinth/types'

// Extract operation types
type LoginRequest =
  paths['/api/v1/auth/login']['post']['requestBody']['content']['application/json']
type LoginResponse =
  paths['/api/v1/auth/login']['post']['responses']['200']['content']['application/json']

// Extract schema types
type User = components['schemas']['User']
type Organization = components['schemas']['Organization']
type Membership = components['schemas']['Membership']

// Use in API client
async function login(credentials: LoginRequest): Promise<LoginResponse> {
  // ...
}
```

## Type Generation

Types are automatically generated from the OpenAPI spec in `packages/openapi`:

```bash
# Validate OpenAPI spec
pnpm --filter openapi validate

# Generate TypeScript types
pnpm --filter openapi generate:types
```

**Do not manually edit generated files.** All changes should be made to the OpenAPI spec.

## Architecture Note

**Backend:** Uses hand-written Zod schemas in `apps/api/src/lib/validation/` for runtime validation.

**Frontend:** Uses these generated TypeScript types for compile-time type safety.

This separation provides the best of both worlds: ergonomic validation on the backend and zero-runtime-cost types on the frontend.
