# @plinth/validation

Shared Zod validation schemas for the Plinth application.

## Purpose

This package provides validation schemas that are used by both:

- **Backend (`apps/api`)** - Server-side request validation
- **Frontend (`apps/web`)** - Client-side form validation

## Benefits

✅ **Single Source of Truth** - Validation rules defined once
✅ **Type Safety** - TypeScript types inferred from Zod schemas
✅ **Zero Drift** - Frontend and backend always stay in sync
✅ **DRY Principle** - No duplication of validation logic

## Usage

### Backend (API)

```typescript
import { registerSchema, loginSchema } from '@plinth/validation'

// Validate request body
const body = registerSchema.parse(req.body)
```

### Frontend (React)

```typescript
import { registerSchema } from '@plinth/validation'

// Client-side validation
const result = registerSchema.safeParse(formData)

if (!result.success) {
  // Handle validation errors
  const errors = result.error.issues
}
```

## Available Schemas

### Authentication (`auth.ts`)

- **`registerSchema`** - User registration validation
  - Email (valid email format)
  - Password (8+ chars, uppercase, lowercase, number, special char)
  - Name (1-100 characters)

- **`loginSchema`** - User login validation
  - Email (valid email format)
  - Password (required)

### Type Exports

```typescript
import type { RegisterInput, LoginInput } from '@plinth/validation'
```

## Architecture Decision

This package follows the project's validation architecture:

- **`@plinth/validation`** - Hand-written Zod schemas for request validation (this package)
- **`@plinth/types`** - OpenAPI-generated TypeScript types for response types

## Adding New Schemas

1. Create new schema file (e.g., `src/orgs.ts`)
2. Export schemas and types
3. Re-export from `src/index.ts`
4. Use in both backend and frontend

Example:

```typescript
// packages/validation/src/orgs.ts
import { z } from 'zod'

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
})

export type CreateOrgInput = z.infer<typeof createOrgSchema>
```

```typescript
// packages/validation/src/index.ts
export * from './auth.js'
export * from './orgs.js'
```

## Related Packages

- `@plinth/types` - OpenAPI-generated response types
- `@plinth/openapi` - OpenAPI specification
