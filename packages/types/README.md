# @plinth/types

Shared TypeScript types and Zod schemas for the Plinth platform.

## Usage

```typescript
import { UserSchema, type User } from '@plinth/types'

// Validate data
const user = UserSchema.parse(data)

// Use type
const handleUser = (user: User) => {
  // ...
}
```

## Type Generation

Types are generated from the OpenAPI spec in `packages/openapi`:

```bash
pnpm --filter openapi generate:types
pnpm --filter openapi generate:zod
```

Do not manually edit generated files.
