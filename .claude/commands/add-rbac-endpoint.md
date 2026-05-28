# Add RBAC Endpoint Command

Scaffold a new organization-scoped API endpoint with RBAC enforcement and multi-tenant isolation.

## Usage

Specify the resource name and required role:

```
/add-rbac-endpoint members admin
/add-rbac-endpoint invitations admin
/add-rbac-endpoint keys owner
```

## Steps

1. **Create route file** in `apps/api/src/routes/<resource>.ts`
2. **Create controller** in `apps/api/src/controllers/<resource>.ts`
3. **Create Zod schema** in `packages/types/src/<resource>.ts`
4. **Add OpenAPI entry** in `packages/openapi/openapi.yaml`
5. **Create test file** in `apps/api/src/routes/<resource>.test.ts`
6. **Register route** in `apps/api/src/app.ts`

## Template: Route File

```typescript
import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth.js'
import { requireRole } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validation.js'
import { <Resource>Controller } from '../controllers/<resource>.js'
import { <Resource>Schema, ParamsSchema } from '@plinth/types'

const router = Router()

// List resources (member+)
router.get(
  '/orgs/:slug/<resources>',
  authenticateJWT,
  requireRole('member', 'admin', 'owner'),
  validateRequest({ params: ParamsSchema }),
  <Resource>Controller.list
)

// Get single resource (member+)
router.get(
  '/orgs/:slug/<resources>/:id',
  authenticateJWT,
  requireRole('member', 'admin', 'owner'),
  validateRequest({ params: ParamsSchema }),
  <Resource>Controller.get
)

// Create resource (admin+)
router.post(
  '/orgs/:slug/<resources>',
  authenticateJWT,
  requireRole('admin', 'owner'),
  validateRequest({ params: ParamsSchema, body: Create<Resource>Schema }),
  <Resource>Controller.create
)

// Update resource (admin+)
router.patch(
  '/orgs/:slug/<resources>/:id',
  authenticateJWT,
  requireRole('admin', 'owner'),
  validateRequest({ params: ParamsSchema, body: Update<Resource>Schema }),
  <Resource>Controller.update
)

// Delete resource (admin+)
router.delete(
  '/orgs/:slug/<resources>/:id',
  authenticateJWT,
  requireRole('admin', 'owner'),
  validateRequest({ params: ParamsSchema }),
  <Resource>Controller.remove
)

export { router as <resource>Router }
```

## Template: Controller File

```typescript
import type { RequestHandler } from 'express'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../lib/errors.js'

export const <Resource>Controller = {
  list: (async (req, res) => {
    const tenantId = req.tenantId!

    const resources = await prisma.<resource>.findMany({
      where: { organizationId: tenantId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ data: resources })
  }) as RequestHandler,

  get: (async (req, res) => {
    const { id } = req.params
    const tenantId = req.tenantId!

    const resource = await prisma.<resource>.findFirst({
      where: {
        id,
        organizationId: tenantId, // CRITICAL: tenant isolation
      },
    })

    if (!resource) {
      throw new AppError('<Resource> not found', 404, '<RESOURCE>_NOT_FOUND')
    }

    res.json(resource)
  }) as RequestHandler,

  create: (async (req, res) => {
    const tenantId = req.tenantId!
    const data = req.body

    const resource = await prisma.<resource>.create({
      data: {
        ...data,
        organizationId: tenantId, // CRITICAL: set from req.tenantId
      },
    })

    res.status(201).json(resource)
  }) as RequestHandler,

  update: (async (req, res) => {
    const { id } = req.params
    const tenantId = req.tenantId!
    const data = req.body

    // Verify resource exists and belongs to tenant
    const existing = await prisma.<resource>.findFirst({
      where: {
        id,
        organizationId: tenantId,
      },
    })

    if (!existing) {
      throw new AppError('<Resource> not found', 404, '<RESOURCE>_NOT_FOUND')
    }

    const updated = await prisma.<resource>.update({
      where: { id },
      data,
    })

    res.json(updated)
  }) as RequestHandler,

  remove: (async (req, res) => {
    const { id } = req.params
    const tenantId = req.tenantId!

    // Verify resource exists and belongs to tenant
    const existing = await prisma.<resource>.findFirst({
      where: {
        id,
        organizationId: tenantId,
      },
    })

    if (!existing) {
      throw new AppError('<Resource> not found', 404, '<RESOURCE>_NOT_FOUND')
    }

    await prisma.<resource>.delete({
      where: { id },
    })

    res.status(204).send()
  }) as RequestHandler,
}
```

## Template: Test File

```typescript
import request from 'supertest'
import { app } from '../app.js'
import { prisma } from '../lib/prisma.js'
import { generateAccessToken } from '../lib/jwt.js'

describe('GET /api/v1/orgs/:slug/<resources>', () => {
  let user: any
  let org: any
  let token: string

  beforeEach(async () => {
    // Seed test data
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashed',
        name: 'Test User',
      },
    })

    org = await prisma.organization.create({
      data: {
        name: 'Test Org',
        slug: 'test-org',
      },
    })

    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'ADMIN',
      },
    })

    token = generateAccessToken({ userId: user.id })
  })

  it('returns 401 when not authenticated', async () => {
    const response = await request(app)
      .get('/api/v1/orgs/test-org/<resources>')
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 404 when org does not exist', async () => {
    const response = await request(app)
      .get('/api/v1/orgs/nonexistent/<resources>')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)

    expect(response.body.error.code).toBe('ORG_NOT_FOUND')
  })

  it('returns 403 when user is not org member', async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: 'Other Org', slug: 'other-org' },
    })

    const response = await request(app)
      .get(`/api/v1/orgs/${otherOrg.slug}/<resources>`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)

    expect(response.body.error.code).toBe('NOT_ORG_MEMBER')
  })

  it('returns 403 when user has insufficient role', async () => {
    // Update membership to MEMBER role
    await prisma.membership.updateMany({
      where: { userId: user.id, organizationId: org.id },
      data: { role: 'MEMBER' },
    })

    const response = await request(app)
      .post('/api/v1/orgs/test-org/<resources>')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test' })
      .expect(403)

    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 200 and resources list when authenticated', async () => {
    const response = await request(app)
      .get('/api/v1/orgs/test-org/<resources>')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body.data).toBeInstanceOf(Array)
  })
})

describe('Cross-tenant isolation', () => {
  it('prevents accessing resources from other orgs', async () => {
    // Create two orgs
    const user = await prisma.user.create({
      data: { email: 'test@example.com', password: 'hashed', name: 'Test' },
    })

    const orgA = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a' },
    })

    const orgB = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b' },
    })

    // User is member of org-a
    await prisma.membership.create({
      data: { userId: user.id, organizationId: orgA.id, role: 'ADMIN' },
    })

    // Create resource in org-b
    const resourceInOrgB = await prisma.<resource>.create({
      data: {
        organizationId: orgB.id,
        // ... other fields
      },
    })

    const token = generateAccessToken({ userId: user.id })

    // Try to access org-b's resource through org-a context
    const response = await request(app)
      .get(`/api/v1/orgs/org-a/<resources>/${resourceInOrgB.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404) // Should not find it (tenant isolation)

    expect(response.body.error.code).toBe('<RESOURCE>_NOT_FOUND')
  })
})
```

## RBAC Edge Cases Checklist

Add these checks to your controller if applicable:

### Last Owner Protection

```typescript
// Prevent removing/demoting last owner
const ownerCount = await prisma.membership.count({
  where: { organizationId: tenantId, role: 'OWNER' },
})

if (ownerCount === 1 && targetMembership.role === 'OWNER') {
  throw new AppError('Cannot remove last owner', 400, 'LAST_OWNER')
}
```

### Self-Demotion Protection

```typescript
// Prevent owner from demoting themselves
if (req.user!.id === userId && currentRole === 'OWNER') {
  throw new AppError('Cannot demote yourself', 403, 'CANNOT_DEMOTE_SELF')
}
```

### Admin Cannot Demote Owner

```typescript
// Prevent admin from modifying owner
const requesterMembership = await prisma.membership.findUnique({
  where: {
    userId_organizationId: {
      userId: req.user!.id,
      organizationId: tenantId,
    },
  },
})

if (requesterMembership?.role === 'ADMIN' && targetMembership.role === 'OWNER') {
  throw new AppError('Cannot modify owner', 403, 'CANNOT_DEMOTE_OWNER')
}
```

## Checklist

- [ ] Route file created with correct role requirements
- [ ] Controller file created with tenant isolation
- [ ] All Prisma queries filter by `organizationId: req.tenantId`
- [ ] Zod schema created
- [ ] OpenAPI entry added with `x-required-role` extension
- [ ] Test file created with 401, 403, 404 cases
- [ ] Cross-tenant isolation test added
- [ ] Route registered in app
- [ ] Types regenerated
- [ ] Tests pass
- [ ] RBAC edge cases handled (if applicable)
