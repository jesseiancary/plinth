# TDD Command

Implement features using disciplined Test-Driven Development with the Red → Green → Refactor cycle.

## Purpose

Enforce test-first development for:

- API endpoints (routes, controllers, middleware)
- Business logic (validation, authentication, authorization)
- Database operations (Prisma queries, transactions)
- Security-critical code (RBAC, tenant isolation, cryptography)

## The TDD Cycle

```
┌─────────────────────────────────────────────┐
│  RED: Write a failing test                 │
│  (Test describes desired behavior)          │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  GREEN: Write minimal code to pass          │
│  (Implementation makes test pass)           │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  REFACTOR: Improve code quality             │
│  (Keep tests green while cleaning up)       │
└─────────────────┬───────────────────────────┘
                  │
                  └──────> Repeat for next behavior
```

## Process

### Phase 1: RED - Write Failing Tests

**Before writing ANY production code, create failing tests.**

#### Test File Setup

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

  // Tests go here
})
```

#### Required Test Cases (Security First)

**1. Authentication Tests (401):**

```typescript
it('returns 401 when not authenticated', async () => {
  const response = await request(app)
    .post('/api/v1/orgs/acme/resource')
    .send({ data: 'value' })
    .expect(401)

  expect(response.body.error.code).toBe('UNAUTHENTICATED')
})

it('returns 401 when token is expired', async () => {
  const expiredToken = await generateTestAccessToken(
    'user-id',
    'user@example.com',
    { expiresIn: '-1h' }, // Already expired
  )

  const response = await request(app)
    .post('/api/v1/orgs/acme/resource')
    .set('Authorization', `Bearer ${expiredToken}`)
    .send({ data: 'value' })
    .expect(401)

  expect(response.body.error.code).toBe('UNAUTHENTICATED')
})
```

**2. Authorization Tests (403):**

```typescript
it('returns 403 when user is not org member', async () => {
  const { user } = await createTestUser({ email: 'outsider@example.com' })
  const { org } = await createTestOrg({ slug: 'acme' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/acme/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({ data: 'value' })
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})

it('returns 403 when user has insufficient role', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'MEMBER' })
  const token = await generateTestAccessToken(user.id, user.email)

  // Endpoint requires ADMIN role
  const response = await request(app)
    .delete('/api/v1/orgs/acme/resource/123')
    .set('Authorization', `Bearer ${token}`)
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})
```

**3. Tenant Isolation Tests (CRITICAL):**

```typescript
it('returns 403 when accessing resource from different org (cross-tenant)', async () => {
  // User is member of Org A
  const { user } = await createTestUser()
  const { org: orgA } = await createTestOrg({ slug: 'org-a' })
  await createTestMembership({ userId: user.id, orgId: orgA.id, role: 'ADMIN' })

  // But tries to access resource in Org B
  const { org: orgB } = await createTestOrg({ slug: 'org-b' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .get('/api/v1/orgs/org-b/resource')
    .set('Authorization', `Bearer ${token}`)
    .expect(403)

  expect(response.body.error.code).toBe('FORBIDDEN')
})

it('cannot create resource with organizationId from request body (tenant isolation)', async () => {
  const { user } = await createTestUser()
  const { org: myOrg } = await createTestOrg({ slug: 'my-org' })
  const { org: targetOrg } = await createTestOrg({ slug: 'target-org' })
  await createTestMembership({ userId: user.id, orgId: myOrg.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  // Attempt to inject different organizationId
  const response = await request(app)
    .post('/api/v1/orgs/my-org/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Resource',
      organizationId: targetOrg.id, // Should be ignored!
    })
    .expect(201)

  // Verify resource was created in MY org, not target org
  const resource = await prisma.resource.findFirst({
    where: { id: response.body.id },
  })

  expect(resource?.organizationId).toBe(myOrg.id) // Uses req.tenantId
  expect(resource?.organizationId).not.toBe(targetOrg.id)
})
```

**4. Validation Tests (400):**

```typescript
it('returns 400 when required fields are missing', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/acme/resource')
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
    .post('/api/v1/orgs/acme/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({
      email: 'not-an-email', // Invalid format
    })
    .expect(400)

  expect(response.body.error.code).toBe('VALIDATION_ERROR')
})
```

**5. Not Found Tests (404):**

```typescript
it('returns 404 when org does not exist', async () => {
  const { user } = await createTestUser()
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .get('/api/v1/orgs/nonexistent/resource')
    .set('Authorization', `Bearer ${token}`)
    .expect(404)

  expect(response.body.error.code).toBe('ORG_NOT_FOUND')
})

it('returns 404 when resource does not exist', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .delete('/api/v1/orgs/acme/resource/nonexistent-id')
    .set('Authorization', `Bearer ${token}`)
    .expect(404)

  expect(response.body.error.code).toBe('RESOURCE_NOT_FOUND')
})
```

**6. Conflict Tests (409):**

```typescript
it('returns 409 when resource already exists', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  // Create resource
  await request(app)
    .post('/api/v1/orgs/acme/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Resource', slug: 'my-resource' })
    .expect(201)

  // Attempt to create duplicate
  const response = await request(app)
    .post('/api/v1/orgs/acme/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Another Resource', slug: 'my-resource' })
    .expect(409)

  expect(response.body.error.code).toBe('RESOURCE_EXISTS')
})
```

**7. RBAC Edge Case Tests (CRITICAL):**

```typescript
// Example: Last owner protection
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

// Example: Owner demotion protection
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

// Example: Admin cannot modify owner
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

**8. Happy Path Tests (200/201/204):**

```typescript
it('creates resource successfully when authenticated as admin', async () => {
  const { user } = await createTestUser()
  const { org } = await createTestOrg({ slug: 'acme' })
  await createTestMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
  const token = await generateTestAccessToken(user.id, user.email)

  const response = await request(app)
    .post('/api/v1/orgs/acme/resource')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'My Resource',
      description: 'A test resource',
    })
    .expect(201)

  expect(response.body).toMatchObject({
    name: 'My Resource',
    description: 'A test resource',
    organizationId: org.id,
  })

  // Verify in database
  const resource = await prisma.resource.findFirst({
    where: { id: response.body.id },
  })

  expect(resource).toBeDefined()
  expect(resource?.organizationId).toBe(org.id)
})
```

#### Run Tests (Should Fail)

```bash
# Run test file
pnpm --filter api test src/routes/resource.test.ts

# Expected: All tests fail (route doesn't exist yet)
```

### Phase 2: GREEN - Minimal Implementation

**Now write the MINIMUM code to make tests pass.**

#### 1. Create Route File

```typescript
// apps/api/src/routes/resource.ts
import { Router } from 'express'

import { authenticate } from '../middleware/auth.js'
import { requireRole } from '../middleware/rbac.js'
import { validateRequest } from '../middleware/validation.js'
import { ResourceController } from '../controllers/resource.js'
import { CreateResourceSchema, ResourceParamsSchema } from '../lib/validation/resource.js'

const router = Router()

router.post(
  '/orgs/:slug/resource',
  authenticate,
  requireRole('ADMIN'),
  validateRequest({ body: CreateResourceSchema, params: ResourceParamsSchema }),
  ResourceController.create,
)

export { router as resourceRouter }
```

#### 2. Create Controller

```typescript
// apps/api/src/controllers/resource.ts
import type { RequestHandler } from 'express'

import { prisma } from '../lib/db.js'
import { AppError } from '../lib/errors.js'

export const ResourceController = {
  create: (async (req, res) => {
    const { name, description } = req.body
    const tenantId = req.tenantId! // Set by requireRole middleware

    // Create resource scoped to org
    const resource = await prisma.resource.create({
      data: {
        name,
        description,
        organizationId: tenantId, // ALWAYS use req.tenantId
      },
    })

    res.status(201).json(resource)
  }) as RequestHandler,
}
```

#### 3. Create Validation Schemas

```typescript
// apps/api/src/lib/validation/resource.ts
import { z } from 'zod'

export const CreateResourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  // organizationId intentionally OMITTED - uses req.tenantId
})

export const ResourceParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
})
```

#### 4. Register Route

```typescript
// apps/api/src/app.ts
import { resourceRouter } from './routes/resource.js'

// ... other routes
app.use('/api/v1', resourceRouter)
```

#### 5. Run Tests (Should Pass)

```bash
pnpm --filter api test src/routes/resource.test.ts

# Expected: All tests pass ✅
```

### Phase 3: REFACTOR - Improve Code Quality

**Tests are green. Now improve code while keeping tests passing.**

#### Refactoring Checklist

**Code Quality:**

- [ ] Extract magic numbers to constants
- [ ] Extract complex conditions to named functions
- [ ] Remove code duplication
- [ ] Improve variable names for clarity
- [ ] Add JSDoc comments to exported functions
- [ ] Simplify complex logic (reduce cyclomatic complexity)

**Performance:**

- [ ] Check for N+1 query problems
- [ ] Add database indexes if needed
- [ ] Use `select` to limit returned fields
- [ ] Consider batch operations for multiple queries

**Security:**

- [ ] Verify all queries use `organizationId: req.tenantId`
- [ ] Confirm no client input used for `organizationId`
- [ ] Check error messages don't leak sensitive data
- [ ] Validate all inputs with Zod schemas
- [ ] No `$queryRawUnsafe` or `eval()` usage

**Error Handling:**

- [ ] All async operations in try/catch
- [ ] AppError used for known failures
- [ ] Error codes are descriptive
- [ ] Error messages are actionable
- [ ] Prisma errors caught and translated to AppError

**Testing:**

- [ ] Tests are readable and well-named
- [ ] No duplicate test setup (use helper functions)
- [ ] Edge cases documented in test descriptions
- [ ] Coverage ≥80% on new code

#### Example Refactorings

**Before (duplication):**

```typescript
// Multiple controllers repeat this
const org = await prisma.organization.findUnique({
  where: { slug: req.params.slug },
})
if (!org) {
  throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
}
```

**After (extracted helper):**

```typescript
// apps/api/src/lib/helpers/org.ts
export async function getOrgBySlug(slug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug },
  })
  if (!org) {
    throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
  }
  return org
}

// In controller
const org = await getOrgBySlug(req.params.slug)
```

**Before (unclear condition):**

```typescript
if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
  throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
}
```

**After (named constant):**

```typescript
const ADMIN_ROLES = ['OWNER', 'ADMIN'] as const

if (!ADMIN_ROLES.includes(membership.role)) {
  throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
}
```

#### Run Tests After Each Refactor

```bash
# After EVERY change, verify tests still pass
pnpm --filter api test src/routes/resource.test.ts
```

## TDD Workflow Checklist

### Phase 1: RED ❌

- [ ] Created test file with proper imports
- [ ] Added `beforeEach` database cleanup
- [ ] Wrote 401 authentication tests
- [ ] Wrote 403 authorization tests
- [ ] Wrote cross-tenant isolation test
- [ ] Wrote 400 validation tests
- [ ] Wrote 404 not found tests
- [ ] Wrote 409 conflict tests (if applicable)
- [ ] Wrote RBAC edge case tests
- [ ] Wrote happy path tests
- [ ] Ran tests and verified they FAIL

### Phase 2: GREEN ✅

- [ ] Created route file with middleware
- [ ] Created controller with minimal logic
- [ ] Created Zod validation schemas
- [ ] Registered route in app.ts
- [ ] Used `req.tenantId` for organizationId (NEVER req.body)
- [ ] Ran tests and verified they PASS

### Phase 3: REFACTOR 🔧

- [ ] Extracted common logic to helpers
- [ ] Removed code duplication
- [ ] Improved variable names
- [ ] Added JSDoc comments
- [ ] Checked for N+1 queries
- [ ] Verified security checklist
- [ ] All tests still pass after refactoring
- [ ] Coverage ≥80%

## Security Validation (Post-TDD)

After completing TDD cycle, verify:

**🔴 CRITICAL:**

- [ ] **A01:** All queries use `req.tenantId`, never `req.body.organizationId`
- [ ] **A01:** `authenticate` middleware on all protected routes
- [ ] **A01:** `requireRole()` enforces minimum role
- [ ] **A01:** Cross-tenant test exists and passes
- [ ] **A02:** Error responses sanitized (no stack traces)
- [ ] **A02:** No hardcoded secrets

**🟡 MODERATE:**

- [ ] **A04:** Tokens use `crypto.randomBytes()`, not `Math.random()`
- [ ] **A05:** All inputs validated with Zod
- [ ] **A05:** No `$queryRawUnsafe` usage
- [ ] **A07:** Rate limiting considered

**🔵 ADVISORY:**

- [ ] **A06:** Threat modeling for business logic
- [ ] **A09:** Security events logged
- [ ] **A10:** Error handlers on async operations

## Common TDD Mistakes

**❌ Writing implementation before tests:**

```typescript
// WRONG ORDER:
// 1. Write route handler
// 2. Write tests
```

**✅ Correct TDD order:**

```typescript
// CORRECT ORDER:
// 1. Write failing tests
// 2. Write minimal code to pass
// 3. Refactor
```

**❌ Tests that don't fail first:**

```typescript
it('creates resource', async () => {
  // If this passes before you write the route, it's a bad test
})
```

**✅ Verify test fails first:**

```bash
# Run test BEFORE implementing route
pnpm test resource.test.ts
# Expected: Test fails ❌

# Implement route
# ...

# Run test again
pnpm test resource.test.ts
# Expected: Test passes ✅
```

**❌ Missing security tests:**

```typescript
// Missing cross-tenant test
// Missing 403 tests
// Only testing happy path
```

**✅ Security-first test coverage:**

```typescript
// 401 unauthenticated
// 403 wrong org
// 403 wrong role
// 403 cross-tenant
// 400 validation
// 404 not found
// 200/201 happy path
```

**❌ Using req.body.organizationId:**

```typescript
// SECURITY BUG - client controls organizationId
const resource = await prisma.resource.create({
  data: {
    organizationId: req.body.organizationId, // ❌
  },
})
```

**✅ Using req.tenantId:**

```typescript
// SECURE - server controls organizationId
const resource = await prisma.resource.create({
  data: {
    organizationId: req.tenantId, // ✅ Set by requireRole middleware
  },
})
```

## Integration with Project Workflow

After completing TDD cycle:

1. **Run full test suite:** `make test-api`
2. **Check coverage:** `make test-coverage`
3. **Update OpenAPI spec:** Add endpoint to `packages/openapi/openapi.yaml`
4. **Security review:** Run `/security-audit` if adding auth/RBAC logic
5. **Pre-PR review:** Run `/review` to verify all checklists
6. **Create PR:** Use `/pr` command with TDD context

## When to Use TDD

**ALWAYS use TDD for:**

- ✅ New API endpoints
- ✅ Authentication/authorization logic
- ✅ RBAC enforcement
- ✅ Database operations
- ✅ Business logic with edge cases
- ✅ Security-critical code

**Consider skipping TDD for:**

- Simple UI components (use React Testing Library interactively)
- Configuration files
- Type definitions
- Documentation

## Benefits of TDD in This Stack

1. **Catches tenant isolation bugs** before code review
2. **Forces thinking about edge cases** upfront
3. **Documents expected behavior** in tests
4. **Enables confident refactoring** (tests catch regressions)
5. **Improves code design** (testable code is better code)
6. **Reduces debugging time** (tests pinpoint failures)
7. **Builds comprehensive test suite** incrementally

## Resources

- **Test helpers:** `apps/api/src/lib/test-helpers.ts`
- **Example tests:** `apps/api/src/routes/orgs.test.ts`
- **Testing rules:** `.claude/rules/testing.md`
- **Security checklist:** `.claude/skills/security/owasp-top10.md`
- **Test architect agent:** `.claude/agents/test-architect.md`
