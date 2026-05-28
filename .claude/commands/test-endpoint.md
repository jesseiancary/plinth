# Test Endpoint Command

Generate a comprehensive test suite for an API endpoint with RBAC and multi-tenant coverage.

## Usage

```
/test-endpoint members
/test-endpoint invitations
/test-endpoint organizations
```

## Test Coverage Template

Creates tests for:

- ✅ Authentication (401)
- ✅ Authorization (403)
- ✅ Not found (404)
- ✅ Validation (400)
- ✅ Success cases (200/201/204)
- ✅ Multi-tenant isolation
- ✅ RBAC edge cases

## Template: Full Test Suite

```typescript
import request from 'supertest'
import { app } from '../app.js'
import { prisma } from '../lib/prisma.js'
import { generateAccessToken } from '../lib/jwt.js'

describe('<Resource> API', () => {
  let owner: any
  let admin: any
  let member: any
  let org: any
  let ownerToken: string
  let adminToken: string
  let memberToken: string

  beforeEach(async () => {
    // Clean database
    await prisma.membership.deleteMany()
    await prisma.<resource>.deleteMany()
    await prisma.organization.deleteMany()
    await prisma.user.deleteMany()

    // Create users
    owner = await prisma.user.create({
      data: {
        email: 'owner@example.com',
        password: 'hashed',
        name: 'Owner User',
      },
    })

    admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: 'hashed',
        name: 'Admin User',
      },
    })

    member = await prisma.user.create({
      data: {
        email: 'member@example.com',
        password: 'hashed',
        name: 'Member User',
      },
    })

    // Create org
    org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        slug: 'test-org',
      },
    })

    // Create memberships
    await prisma.membership.create({
      data: {
        userId: owner.id,
        organizationId: org.id,
        role: 'OWNER',
      },
    })

    await prisma.membership.create({
      data: {
        userId: admin.id,
        organizationId: org.id,
        role: 'ADMIN',
      },
    })

    await prisma.membership.create({
      data: {
        userId: member.id,
        organizationId: org.id,
        role: 'MEMBER',
      },
    })

    // Generate tokens
    ownerToken = generateAccessToken({ userId: owner.id })
    adminToken = generateAccessToken({ userId: admin.id })
    memberToken = generateAccessToken({ userId: member.id })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('GET /api/v1/orgs/:slug/<resources>', () => {
    describe('Authentication & Authorization', () => {
      it('returns 401 when not authenticated', async () => {
        const response = await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .expect(401)

        expect(response.body.error.code).toBe('UNAUTHENTICATED')
      })

      it('returns 404 when org does not exist', async () => {
        const response = await request(app)
          .get('/api/v1/orgs/nonexistent/<resources>')
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('ORG_NOT_FOUND')
      })

      it('returns 403 when user is not org member', async () => {
        const otherUser = await prisma.user.create({
          data: { email: 'other@example.com', password: 'hashed', name: 'Other' },
        })
        const otherToken = generateAccessToken({ userId: otherUser.id })

        const response = await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${otherToken}`)
          .expect(403)

        expect(response.body.error.code).toBe('NOT_ORG_MEMBER')
      })
    })

    describe('Success cases', () => {
      it('returns 200 and empty array when no resources exist', async () => {
        const response = await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(200)

        expect(response.body.data).toEqual([])
      })

      it('returns 200 and resources list when resources exist', async () => {
        // Create test resource
        await prisma.<resource>.create({
          data: {
            organizationId: org.id,
            // ... other required fields
          },
        })

        const response = await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(200)

        expect(response.body.data).toHaveLength(1)
      })

      it('allows owner to list resources', async () => {
        await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(200)
      })

      it('allows admin to list resources', async () => {
        await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200)
      })

      it('allows member to list resources', async () => {
        await request(app)
          .get(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(200)
      })
    })
  })

  describe('POST /api/v1/orgs/:slug/<resources>', () => {
    const validPayload = {
      // ... required fields
    }

    describe('Authentication & Authorization', () => {
      it('returns 401 when not authenticated', async () => {
        const response = await request(app)
          .post(`/api/v1/orgs/${org.slug}/<resources>`)
          .send(validPayload)
          .expect(401)

        expect(response.body.error.code).toBe('UNAUTHENTICATED')
      })

      it('returns 403 when user is member (not admin)', async () => {
        const response = await request(app)
          .post(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send(validPayload)
          .expect(403)

        expect(response.body.error.code).toBe('FORBIDDEN')
      })
    })

    describe('Validation', () => {
      it('returns 400 when required fields are missing', async () => {
        const response = await request(app)
          .post(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
      })

      it('returns 400 when field format is invalid', async () => {
        const response = await request(app)
          .post(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ ...validPayload, email: 'not-an-email' })
          .expect(400)

        expect(response.body.error.code).toBe('VALIDATION_ERROR')
      })
    })

    describe('Success cases', () => {
      it('returns 201 and creates resource when admin', async () => {
        const response = await request(app)
          .post(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(validPayload)
          .expect(201)

        expect(response.body).toMatchObject(validPayload)
        expect(response.body.id).toBeDefined()
        expect(response.body.organizationId).toBe(org.id)

        // Verify in database
        const resource = await prisma.<resource>.findUnique({
          where: { id: response.body.id },
        })
        expect(resource).toBeDefined()
        expect(resource?.organizationId).toBe(org.id)
      })

      it('returns 201 and creates resource when owner', async () => {
        await request(app)
          .post(`/api/v1/orgs/${org.slug}/<resources>`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send(validPayload)
          .expect(201)
      })
    })
  })

  describe('DELETE /api/v1/orgs/:slug/<resources>/:id', () => {
    let resource: any

    beforeEach(async () => {
      resource = await prisma.<resource>.create({
        data: {
          organizationId: org.id,
          // ... other required fields
        },
      })
    })

    describe('Authentication & Authorization', () => {
      it('returns 401 when not authenticated', async () => {
        const response = await request(app)
          .delete(`/api/v1/orgs/${org.slug}/<resources>/${resource.id}`)
          .expect(401)

        expect(response.body.error.code).toBe('UNAUTHENTICATED')
      })

      it('returns 403 when user is member (not admin)', async () => {
        const response = await request(app)
          .delete(`/api/v1/orgs/${org.slug}/<resources>/${resource.id}`)
          .set('Authorization', `Bearer ${memberToken}`)
          .expect(403)

        expect(response.body.error.code).toBe('FORBIDDEN')
      })
    })

    describe('Not found cases', () => {
      it('returns 404 when resource does not exist', async () => {
        const response = await request(app)
          .delete(`/api/v1/orgs/${org.slug}/<resources>/nonexistent-id`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404)

        expect(response.body.error.code).toBe('<RESOURCE>_NOT_FOUND')
      })
    })

    describe('Success cases', () => {
      it('returns 204 and deletes resource when admin', async () => {
        await request(app)
          .delete(`/api/v1/orgs/${org.slug}/<resources>/${resource.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(204)

        // Verify deletion
        const deleted = await prisma.<resource>.findUnique({
          where: { id: resource.id },
        })
        expect(deleted).toBeNull()
      })

      it('returns 204 and deletes resource when owner', async () => {
        await request(app)
          .delete(`/api/v1/orgs/${org.slug}/<resources>/${resource.id}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .expect(204)
      })
    })
  })

  describe('Multi-tenant isolation', () => {
    it('prevents accessing resources from other orgs', async () => {
      // Create second org
      const orgB = await prisma.organization.create({
        data: { name: 'Org B', slug: 'org-b' },
      })

      // Create resource in org B
      const resourceInOrgB = await prisma.<resource>.create({
        data: {
          organizationId: orgB.id,
          // ... other required fields
        },
      })

      // Try to access org B's resource through org A context
      const response = await request(app)
        .get(`/api/v1/orgs/${org.slug}/<resources>/${resourceInOrgB.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404)

      expect(response.body.error.code).toBe('<RESOURCE>_NOT_FOUND')
    })

    it('only returns resources from current org', async () => {
      // Create second org with resource
      const orgB = await prisma.organization.create({
        data: { name: 'Org B', slug: 'org-b' },
      })

      await prisma.<resource>.create({
        data: {
          organizationId: orgB.id,
          // ... other fields
        },
      })

      // Create resource in current org
      await prisma.<resource>.create({
        data: {
          organizationId: org.id,
          // ... other fields
        },
      })

      // List should only return org A's resource
      const response = await request(app)
        .get(`/api/v1/orgs/${org.slug}/<resources>`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)

      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].organizationId).toBe(org.id)
    })
  })
})
```

## RBAC Edge Case Tests (if applicable)

Add these tests if the endpoint has special RBAC logic:

```typescript
describe('RBAC edge cases', () => {
  it('prevents last owner removal', async () => {
    const response = await request(app)
      .delete(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400)

    expect(response.body.error.code).toBe('LAST_OWNER')
  })

  it('prevents owner self-demotion', async () => {
    const response = await request(app)
      .patch(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'ADMIN' })
      .expect(403)

    expect(response.body.error.code).toBe('CANNOT_DEMOTE_SELF')
  })

  it('prevents admin from demoting owner', async () => {
    const response = await request(app)
      .patch(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' })
      .expect(403)

    expect(response.body.error.code).toBe('CANNOT_DEMOTE_OWNER')
  })
})
```

## Checklist

- [ ] Test file created in `src/routes/<resource>.test.ts`
- [ ] All authentication tests pass (401 cases)
- [ ] All authorization tests pass (403 cases)
- [ ] All not found tests pass (404 cases)
- [ ] All validation tests pass (400 cases)
- [ ] All success tests pass (200/201/204 cases)
- [ ] Multi-tenant isolation tests pass
- [ ] RBAC edge case tests added (if applicable)
- [ ] Tests run in CI/CD pipeline
- [ ] Coverage meets 80% threshold
