# TDD Skill Context

Auto-loaded when working with test files or implementing test-driven development.

## When This Skill is Loaded

This skill is automatically activated when:

- Working with files ending in `.test.ts`
- Running or writing integration tests
- Implementing TDD workflow (Red → Green → Refactor)
- Debugging test failures
- Reviewing test coverage
- Adding test cases for new features
- Writing security tests (401, 403, cross-tenant)

## Primary Resources

### Full TDD Workflow

[/tdd command](../../commands/tdd.md) - Complete Test-Driven Development process

### Quick Reference

Consult `/tdd` command for:

- Complete Red → Green → Refactor cycle
- Comprehensive test case examples
- Security test requirements (OWASP A01-A10)
- RBAC edge case tests
- Refactoring checklist

## Stack-Specific Testing Setup

### Test Framework

- **Test runner:** Vitest 3.x
- **HTTP testing:** Supertest 7.x
- **Assertions:** Vitest expect + custom matchers
- **Database:** Same PostgreSQL as dev, reset before each test

### Test File Structure

```typescript
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { prisma } from '../lib/db.js'
import {
  clearDatabase,
  createTestUser,
  createTestOrg,
  createTestMembership,
  generateTestAccessToken,
} from '../lib/test-helpers.js'

describe('POST /api/v1/orgs/:slug/resource', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  // Tests here
})
```

## Test Helpers Reference

Location: `apps/api/src/lib/test-helpers.ts`

### Database Setup

```typescript
// Clear all data (cascading deletes via Prisma schema)
await clearDatabase()
```

### User Creation

```typescript
// Create user with defaults
const { user } = await createTestUser()

// Create user with specific email
const { user } = await createTestUser({ email: 'custom@example.com' })

// Create user with custom data
const { user } = await createTestUser({
  email: 'user@example.com',
  name: 'Test User',
  password: 'custom-password',
})
```

### Organization Creation

```typescript
// Create org with defaults
const { org } = await createTestOrg()

// Create org with specific slug
const { org } = await createTestOrg({ slug: 'acme' })

// Create org with custom data
const { org } = await createTestOrg({
  slug: 'my-org',
  name: 'My Organization',
})
```

### Membership Creation

```typescript
// Create membership with defaults (MEMBER role)
const { membership } = await createTestMembership({
  userId: user.id,
  orgId: org.id,
})

// Create membership with specific role
const { membership } = await createTestMembership({
  userId: user.id,
  orgId: org.id,
  role: 'ADMIN',
})

// Available roles: 'OWNER', 'ADMIN', 'MEMBER'
```

### Token Generation

```typescript
// Generate access token for user
const token = await generateTestAccessToken(user.id, user.email)

// Generate token with custom expiry
const expiredToken = await generateTestAccessToken(user.id, user.email, {
  expiresIn: '-1h', // Already expired
})

const longLivedToken = await generateTestAccessToken(user.id, user.email, {
  expiresIn: '7d', // 7 days
})
```

## Essential Test Patterns

### Pattern 1: Authentication Tests (401)

```typescript
it('returns 401 when not authenticated', async () => {
  const response = await request(app).get('/api/v1/protected-route').expect(401)

  expect(response.body.error.code).toBe('UNAUTHENTICATED')
})

it('returns 401 when token is expired', async () => {
  const token = await generateTestAccessToken('user-id', 'user@example.com', {
    expiresIn: '-1h',
  })

  const response = await request(app)
    .get('/api/v1/protected-route')
    .set('Authorization', `Bearer ${token}`)
    .expect(401)

  expect(response.body.error.code).toBe('UNAUTHENTICATED')
})
```

### Pattern 2: Authorization Tests (403)

```typescript
it('returns 403 when user is not org member', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .get('/api/v1/orgs/acme/members')
    .set('Authorization', `Bearer ${token}`)
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})

it('returns 403 when user has insufficient role', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'MEMBER' })
  const token = await generateTestAccessToken(user.id, user.email)

  // Endpoint requires ADMIN
  const response = await request(app)
    .delete('/api/v1/orgs/acme/resource/123')
    .set('Authorization', `Bearer ${token}`)
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})
```

### Pattern 3: Cross-Tenant Isolation (CRITICAL)

```typescript
it('returns 403 when accessing resource from different org', async () => {
  // User is member of org-a
  const { user } = await createTestUser()
  const { org: orgA } = await createTestOrg({ slug: 'org-a' })
  await createTestMembership({ userId: user.id, orgId: orgA.id, role: 'ADMIN' })

  // Create org-b with resource
  const { org: orgB } = await createTestOrg({ slug: 'org-b' })
  const token = await generateTestAccessToken(user.id, user.email)

  // Attempt to access org-b resource
  const response = await request(app)
    .get('/api/v1/orgs/org-b/members')
    .set('Authorization', `Bearer ${token}`)
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})

it('creates resource in correct org (ignores body organizationId)', async () => {
  const { user } = await createTestUser()
  const { org: myOrg } = await createTestOrg({ slug: 'my-org' })
  const { org: otherOrg } = await createTestOrg({ slug: 'other-org' })
  await createTestMembership({ userId: user.id, orgId: myOrg.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/my-org/resources')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Resource',
      organizationId: otherOrg.id, // Should be IGNORED
    })
    .expect(201)

  // Verify resource created in MY org, not other org
  const resource = await prisma.resource.findFirst({
    where: { id: response.body.id },
  })

  expect(resource?.organizationId).toBe(myOrg.id)
  expect(resource?.organizationId).not.toBe(otherOrg.id)
})
```

### Pattern 4: Validation Tests (400)

```typescript
it('returns 400 when required fields are missing', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/acme/resources')
    .set('Authorization', `Bearer ${token}`)
    .send({}) // Missing required fields
    .expect(400)

  expect(response.body.error.code).toBe('VALIDATION_ERROR')
})

it('returns 400 when field format is invalid', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/acme/resources')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: 'not-an-email', // Invalid
    })
    .expect(400)

  expect(response.body.error.code).toBe('VALIDATION_ERROR')
})
```

### Pattern 5: RBAC Edge Cases

```typescript
// Last owner protection
it('returns 400 when attempting to remove last owner', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'OWNER' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .delete(`/api/v1/orgs/acme/members/${user.id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(400)

  expect(response.body.error.code).toBe('LAST_OWNER')
})

// Owner self-demotion prevention
it('returns 400 when owner attempts to demote self', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'OWNER' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .patch(`/api/v1/orgs/acme/members/${user.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'ADMIN' })
    .expect(400)

  expect(response.body.error.code).toBe('CANNOT_DEMOTE_SELF')
})

// Admin cannot modify owner
it('returns 403 when admin attempts to demote owner', async () => {
  const { user: admin } = await createTestUser({ email: 'admin@example.com' })
  const { user: owner } = await createTestUser({ email: 'owner@example.com' })
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: admin.id, orgId: org.id, role: 'ADMIN' })
  await createTestMembership({ userId: owner.id, orgId: org.id, role: 'OWNER' })
  const token = await generateTestAccessToken(admin.id, admin.email)

  const response = await request(app)
    .patch(`/api/v1/orgs/acme/members/${owner.id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ role: 'MEMBER' })
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})
```

### Pattern 6: Happy Path with Database Verification

```typescript
it('creates resource successfully and persists to database', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/acme/resources')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'My Resource',
      description: 'A test resource',
    })
    .expect(201)

  // Verify response shape
  expect(response.body).toMatchObject({
    name: 'My Resource',
    description: 'A test resource',
    organizationId: org.id,
  })

  // Verify database persistence
  const resource = await prisma.resource.findFirst({
    where: { id: response.body.id },
  })

  expect(resource).toBeDefined()
  expect(resource?.name).toBe('My Resource')
  expect(resource?.organizationId).toBe(org.id)
})
```

## Required Test Coverage for New Endpoints

**Security Tests (MANDATORY):**

- [ ] 401 - Not authenticated
- [ ] 401 - Expired token
- [ ] 403 - Not org member
- [ ] 403 - Insufficient role (if role-gated)
- [ ] 403 - Cross-tenant access (different org)
- [ ] 🔴 Tenant isolation - ignores body `organizationId`

**Validation Tests:**

- [ ] 400 - Missing required fields
- [ ] 400 - Invalid field format
- [ ] 400 - Out of range values
- [ ] 400 - Invalid enum values

**Not Found Tests:**

- [ ] 404 - Org not found
- [ ] 404 - Resource not found

**Conflict Tests (if applicable):**

- [ ] 409 - Duplicate resource (unique constraint)

**RBAC Edge Cases (if applicable):**

- [ ] Last owner protection
- [ ] Owner self-demotion prevention
- [ ] Admin cannot modify owner
- [ ] Member cannot perform admin action

**Happy Path:**

- [ ] 200/201/204 - Success case
- [ ] Response shape matches spec
- [ ] Database persistence verified

## Test Naming Conventions

Follow this pattern:

```typescript
describe('HTTP_METHOD /api/v1/path', () => {
  it('returns STATUS_CODE when condition', async () => {
    // test
  })
})
```

**Examples:**

```typescript
describe('POST /api/v1/orgs', () => {
  it('returns 201 when creating org with valid data', async () => {})
  it('returns 401 when not authenticated', async () => {})
  it('returns 400 when slug format is invalid', async () => {})
  it('returns 409 when slug already exists', async () => {})
})

describe('DELETE /api/v1/orgs/:slug/members/:userId', () => {
  it('returns 204 when removing member as admin', async () => {})
  it('returns 403 when member attempts to remove another member', async () => {})
  it('returns 404 when member does not exist', async () => {})
  it('returns 400 when attempting to remove last owner', async () => {})
})
```

## Running Tests

```bash
# Run all API tests
make test-api

# Run specific test file
pnpm --filter api test src/routes/orgs.test.ts

# Run tests in watch mode (for TDD)
pnpm --filter api test --watch src/routes/orgs.test.ts

# Run tests with coverage
make test-coverage

# Run tests in isolated Docker environment (CI parity)
make test-docker-api
```

## Common Test Debugging

### Test Fails with "Unauthenticated"

**Symptom:**

```
Expected: 200
Received: 401
```

**Diagnosis:**

- Missing `Authorization` header
- Token expired
- Token malformed

**Fix:**

```typescript
const token = await generateTestAccessToken(user.id, user.email)

await request(app)
  .get('/api/v1/protected')
  .set('Authorization', `Bearer ${token}`) // Must include "Bearer " prefix
  .expect(200)
```

### Test Fails with "Forbidden"

**Symptom:**

```
Expected: 200
Received: 403
```

**Diagnosis:**

- User not member of org
- User has insufficient role
- Cross-tenant access

**Fix:**

```typescript
// Ensure membership exists
await createTestMembership({
  userId: user.id,
  orgId: org.id,
  role: 'ADMIN', // Match required role
})
```

### Test Fails with "Validation Error"

**Symptom:**

```
Expected: 201
Received: 400 VALIDATION_ERROR
```

**Diagnosis:**

- Missing required field
- Invalid field format
- Type mismatch

**Fix:**

```typescript
// Check Zod schema for required fields
const response = await request(app).post('/api/v1/orgs').send({
  name: 'Org Name', // Required
  slug: 'valid-slug', // Required, lowercase-hyphen format
})
```

### Test Fails with Database Constraint Error

**Symptom:**

```
Prisma error P2002: Unique constraint violation
```

**Diagnosis:**

- Duplicate slug, email, or unique field
- `beforeEach` cleanup not running

**Fix:**

```typescript
beforeEach(async () => {
  await clearDatabase() // Ensure this runs
})

// Or use unique values per test
const uniqueSlug = `org-${Date.now()}`
```

### Test Hangs / Timeout

**Symptom:**

```
Test timeout of 5000ms exceeded
```

**Diagnosis:**

- Missing `await` on async operation
- Infinite loop
- Database connection not closed

**Fix:**

```typescript
// Ensure all async operations are awaited
await request(app).get('/api/v1/orgs').expect(200) // Don't forget await!

// Ensure cleanup
afterAll(async () => {
  await prisma.$disconnect()
})
```

## Security Test Checklist

When testing security-critical code, verify:

**A01: Broken Access Control**

- [ ] All routes require authentication (`authenticate` middleware)
- [ ] All org-scoped routes check membership (`requireRole` middleware)
- [ ] Queries filter by `req.tenantId`, never `req.body.organizationId`
- [ ] Cross-tenant access returns 403
- [ ] Horizontal escalation test exists
- [ ] RBAC edge cases tested (last owner, owner demotion)

**A04: Cryptographic Failures**

- [ ] Tokens generated with `crypto.randomBytes()`, not `Math.random()`
- [ ] Tokens hashed before storage (SHA-256)
- [ ] Tokens are single-use (deleted/marked used after acceptance)
- [ ] Test expired token handling

**A05: Injection**

- [ ] All inputs validated with Zod schemas
- [ ] No `$queryRawUnsafe` usage (Prisma ORM only)
- [ ] Test with malicious inputs (SQL injection attempts, XSS payloads)

**A07: Authentication Failures**

- [ ] Generic error messages (no account enumeration)
- [ ] Rate limiting tested (if applicable)
- [ ] Token expiry enforced

## Related Resources

- **Test helpers:** `apps/api/src/lib/test-helpers.ts`
- **Example tests:** `apps/api/src/routes/orgs.test.ts`, `apps/api/src/routes/auth.test.ts`
- **TDD workflow:** [/tdd command](../../commands/tdd.md)
- **Testing rules:** `.claude/rules/testing.md`
- **Test architect agent:** `.claude/agents/test-architect.md`
- **Security checklist:** `.claude/skills/security/owasp-top10.md`

## TDD Workflow Integration

1. **Start with failing tests** (Red phase)
2. **Write minimal implementation** (Green phase)
3. **Refactor while keeping tests green** (Refactor phase)
4. **Verify coverage:** `make test-coverage` (target: ≥80%)
5. **Security review:** Check OWASP Top 10 checklist
6. **Pre-PR validation:** `/review` command

## Quick Tips

- **Database cleanup:** Always use `clearDatabase()` in `beforeEach`
- **Token format:** Always prefix with `Bearer ` (note the space)
- **Tenant isolation:** Test cross-tenant access on EVERY org-scoped endpoint
- **RBAC:** Test role hierarchy (member < admin < owner)
- **Error codes:** Use descriptive codes, test in assertions
- **Happy path last:** Write security tests first, happy path last
- **Database verification:** Don't just check HTTP response, query database too

## When to Use Test Architect Agent

For complex testing scenarios, delegate to the test architect agent:

- [ ] Designing test suite for new feature
- [ ] Writing integration tests with complex setup
- [ ] Troubleshooting flaky tests
- [ ] Optimizing test performance
- [ ] Testing race conditions or concurrency
- [ ] Designing test data factories

Use: Invoke test-architect agent via Task tool when tests require specialized expertise.
