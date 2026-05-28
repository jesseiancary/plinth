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

## Phase 3 RBAC Test Patterns

### 404 vs 403 Decision Tree

Use this decision tree for every protected endpoint:

```typescript
describe('GET /api/v1/orgs/:slug/members', () => {
  it('returns 401 when not authenticated', async () => {
    // No auth header at all
    const response = await request(app).get('/api/v1/orgs/acme/members').expect(401)

    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 404 when org does not exist', async () => {
    // Auth valid, but org slug doesn't exist
    // Don't use 403 - would leak existence to non-members
    const token = generateToken(user.id)
    const response = await request(app)
      .get('/api/v1/orgs/nonexistent/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)

    expect(response.body.error.code).toBe('ORG_NOT_FOUND')
  })

  it('returns 403 when user is not org member', async () => {
    // Auth valid, org exists, but user not a member
    const token = generateToken(user.id)
    const response = await request(app)
      .get('/api/v1/orgs/acme/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(response.body.error.code).toBe('NOT_ORG_MEMBER')
  })

  it('returns 403 when user has insufficient role', async () => {
    // Auth valid, is member, but role too low (e.g., member trying admin action)
    await seedMembership({ userId: user.id, orgId: org.id, role: 'MEMBER' })
    const token = generateToken(user.id)
    const response = await request(app)
      .delete('/api/v1/orgs/acme/members/other-user-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 when user has sufficient role', async () => {
    // Happy path
    await seedMembership({ userId: user.id, orgId: org.id, role: 'ADMIN' })
    const token = generateToken(user.id)
    const response = await request(app)
      .get('/api/v1/orgs/acme/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body.data).toBeInstanceOf(Array)
  })
})
```

### Multi-Tenant Isolation Tests

```typescript
describe('Tenant isolation', () => {
  it('prevents cross-tenant access', async () => {
    // Create two orgs
    const orgA = await seedOrg({ slug: 'org-a' })
    const orgB = await seedOrg({ slug: 'org-b' })

    // User is member of org-a only
    await seedMembership({ userId: user.id, orgId: orgA.id, role: 'ADMIN' })

    const token = generateToken(user.id)

    // Try to access org-b resources
    const response = await request(app)
      .get('/api/v1/orgs/org-b/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(response.body.error.code).toBe('NOT_ORG_MEMBER')
  })

  it('allows user to access multiple orgs they belong to', async () => {
    const orgA = await seedOrg({ slug: 'org-a' })
    const orgB = await seedOrg({ slug: 'org-b' })

    // User is member of both orgs
    await seedMembership({ userId: user.id, orgId: orgA.id, role: 'MEMBER' })
    await seedMembership({ userId: user.id, orgId: orgB.id, role: 'ADMIN' })

    const token = generateToken(user.id)

    // Can access org-a
    await request(app)
      .get('/api/v1/orgs/org-a/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    // Can access org-b
    await request(app)
      .get('/api/v1/orgs/org-b/members')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
  })
})
```

### Invitation Flow Tests Checklist

```typescript
describe('POST /api/v1/invitations/:token/accept', () => {
  it('creates membership for new user', async () => {
    // User doesn't exist, create account + membership
    const invitation = await seedInvitation({
      email: 'newuser@example.com',
      role: 'MEMBER',
    })

    const response = await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .send({ name: 'New User', password: 'password123' })
      .expect(201)

    // Verify user was created
    const user = await prisma.user.findUnique({
      where: { email: 'newuser@example.com' },
    })
    expect(user).toBeDefined()

    // Verify membership was created
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    })
    expect(membership?.role).toBe('MEMBER')
  })

  it('creates membership for existing user', async () => {
    // User exists, just add membership
    const existingUser = await seedUser({ email: 'existing@example.com' })
    const invitation = await seedInvitation({
      email: 'existing@example.com',
      role: 'ADMIN',
    })

    const token = generateToken(existingUser.id)
    const response = await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    // Verify membership was created
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: invitation.organizationId,
        },
      },
    })
    expect(membership?.role).toBe('ADMIN')
  })

  it('returns 400 when token is expired', async () => {
    // expiresAt in the past
    const invitation = await seedInvitation({
      email: 'test@example.com',
      expiresAt: new Date(Date.now() - 1000), // 1 second ago
    })

    const response = await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .send({ name: 'Test', password: 'password123' })
      .expect(400)

    expect(response.body.error.code).toBe('INVITATION_EXPIRED')
  })

  it('returns 409 when user is already member', async () => {
    // User already has membership for this org
    const user = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: user.id, orgId: org.id, role: 'MEMBER' })

    const invitation = await seedInvitation({
      email: user.email,
      organizationId: org.id,
    })

    const token = generateToken(user.id)
    const response = await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .set('Authorization', `Bearer ${token}`)
      .expect(409)

    expect(response.body.error.code).toBe('ALREADY_MEMBER')
  })

  it('returns 404 when token is invalid', async () => {
    // Token doesn't exist
    const response = await request(app)
      .post('/api/v1/invitations/invalid-token-hash/accept')
      .send({ name: 'Test', password: 'password123' })
      .expect(404)

    expect(response.body.error.code).toBe('INVITATION_NOT_FOUND')
  })

  it('returns 400 when organization is deleted', async () => {
    // Org was deleted after invitation sent
    const invitation = await seedInvitation()
    await prisma.organization.delete({ where: { id: invitation.organizationId } })

    const response = await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .send({ name: 'Test', password: 'password123' })
      .expect(400)

    expect(response.body.error.code).toBe('ORG_DELETED')
  })

  it('marks invitation as single-use', async () => {
    const invitation = await seedInvitation()

    // First accept succeeds
    await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .send({ name: 'Test', password: 'password123' })
      .expect(201)

    // Second accept fails
    const response = await request(app)
      .post(`/api/v1/invitations/${invitation.token}/accept`)
      .send({ name: 'Test2', password: 'password456' })
      .expect(404)

    expect(response.body.error.code).toBe('INVITATION_NOT_FOUND')
  })
})
```

### RBAC Edge Case Tests

```typescript
describe('RBAC edge cases', () => {
  it('prevents last owner removal', async () => {
    // Only one owner, try to delete -> 400 LAST_OWNER
    const owner = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: owner.id, orgId: org.id, role: 'OWNER' })

    const token = generateToken(owner.id)
    const response = await request(app)
      .delete(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)

    expect(response.body.error.code).toBe('LAST_OWNER')
  })

  it('prevents owner self-demotion', async () => {
    // Owner tries to change own role -> 403
    const owner = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: owner.id, orgId: org.id, role: 'OWNER' })

    const token = generateToken(owner.id)
    const response = await request(app)
      .patch(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'ADMIN' })
      .expect(403)

    expect(response.body.error.code).toBe('CANNOT_DEMOTE_SELF')
  })

  it('prevents admin from demoting owner', async () => {
    // Admin tries to change owner's role -> 403
    const owner = await seedUser()
    const admin = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: owner.id, orgId: org.id, role: 'OWNER' })
    await seedMembership({ userId: admin.id, orgId: org.id, role: 'ADMIN' })

    const token = generateToken(admin.id)
    const response = await request(app)
      .patch(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'MEMBER' })
      .expect(403)

    expect(response.body.error.code).toBe('CANNOT_DEMOTE_OWNER')
  })

  it('allows admin to remove member', async () => {
    // Admin removes member -> 204
    const admin = await seedUser()
    const member = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: admin.id, orgId: org.id, role: 'ADMIN' })
    await seedMembership({ userId: member.id, orgId: org.id, role: 'MEMBER' })

    const token = generateToken(admin.id)
    await request(app)
      .delete(`/api/v1/orgs/${org.slug}/members/${member.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204)

    // Verify membership was deleted
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: member.id,
          organizationId: org.id,
        },
      },
    })
    expect(membership).toBeNull()
  })

  it('prevents member from removing anyone', async () => {
    // Member tries to remove anyone -> 403
    const member1 = await seedUser()
    const member2 = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: member1.id, orgId: org.id, role: 'MEMBER' })
    await seedMembership({ userId: member2.id, orgId: org.id, role: 'MEMBER' })

    const token = generateToken(member1.id)
    const response = await request(app)
      .delete(`/api/v1/orgs/${org.slug}/members/${member2.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})
```
