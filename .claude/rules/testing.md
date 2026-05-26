# Testing Conventions

## Test Philosophy

- **Integration tests first** on the API — test through the HTTP layer using Supertest.
- **Don't mock the database** — use a real test database (separate from dev).
- **Test behavior, not implementation** — avoid testing private functions directly.
- **Coverage threshold:** 80% on `apps/api/src`.

## Test Organization

- **Colocate tests** with source files: `src/routes/auth.test.ts` next to `src/routes/auth.ts`.
- **One `describe` block per route** or module.
- **Group related tests** with nested `describe` blocks.

## Test Naming

Use descriptive test names that explain the scenario and expected outcome:

```typescript
describe('POST /api/v1/auth/login', () => {
  it('returns 200 and tokens when credentials are valid', async () => {
    // ...
  })

  it('returns 401 when password is wrong', async () => {
    // ...
  })

  it('returns 400 when email is missing', async () => {
    // ...
  })
})
```

## Database Setup

Each test file should:

1. **Reset the database** to a known state using a `beforeEach` seed helper.
2. **Use isolated test data** — don't rely on data from other tests.
3. **Clean up** after tests if necessary (though `beforeEach` reset is preferred).

Example:

```typescript
import { resetDatabase, seedTestUser } from '../test-helpers/db'

beforeEach(async () => {
  await resetDatabase()
})

describe('POST /api/v1/auth/login', () => {
  it('returns 200 when credentials are valid', async () => {
    const user = await seedTestUser({ email: 'test@example.com', password: 'password123' })
    // test logic
  })
})
```

## API Integration Tests

- **Use Supertest** to make HTTP requests to the API.
- **Test all status codes** — 200, 201, 400, 401, 403, 404, 409, etc.
- **Assert response shape** — check that the response matches the expected structure.
- **Test edge cases** — expired tokens, missing fields, invalid IDs, etc.

Example:

```typescript
import request from 'supertest'
import { app } from '../app'

describe('GET /api/v1/orgs/:slug/members', () => {
  it('returns 401 when not authenticated', async () => {
    const response = await request(app).get('/api/v1/orgs/acme/members').expect(401)

    expect(response.body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 403 when user is not a member', async () => {
    const token = await generateTokenForUser({ orgId: 'other-org' })
    const response = await request(app)
      .get('/api/v1/orgs/acme/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 and members list when authenticated', async () => {
    const token = await generateTokenForUser({ orgId: 'acme' })
    const response = await request(app)
      .get('/api/v1/orgs/acme/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body.data).toBeInstanceOf(Array)
  })
})
```

## Frontend Tests

- **Use React Testing Library** — test components as users interact with them.
- **No implementation details** — don't test state or props directly.
- **User-centric queries** — use `getByRole`, `getByLabelText`, etc.
- **Test interactions** — clicks, form submissions, navigation.

## Test Data Factories

- **Create reusable factories** for generating test data.
- **Use sensible defaults** — allow overrides when needed.
- **Keep factories simple** — don't add business logic.

Example:

```typescript
export const createTestUser = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  ...overrides,
})
```

## What NOT to Test

- **Third-party libraries** — trust that Prisma, Express, etc., work correctly.
- **Type correctness** — TypeScript handles this at compile time.
- **Implementation details** — private functions, internal state.

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests for a specific package
pnpm --filter api test
```
