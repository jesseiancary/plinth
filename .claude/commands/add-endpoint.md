# Add Endpoint Command

Scaffold a new API endpoint with all required files.

## Steps

1. **Create route file** in `apps/api/src/routes/<resource>.ts`
2. **Create controller** in `apps/api/src/controllers/<resource>.ts`
3. **Create Zod schema** in `packages/types/src/<resource>.ts`
4. **Add OpenAPI entry** in `packages/openapi/openapi.yaml`
5. **Create test file** in `apps/api/src/routes/<resource>.test.ts`
6. **Register route** in `apps/api/src/app.ts`

## Template Structure

### Route File

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { validateRequest } from '../middleware/validation'
import { <Resource>Controller } from '../controllers/<resource>'
import { <Resource>Schema } from '@plinth/types'

const router = Router()

router.get(
  '/orgs/:slug/<resources>',
  authenticate,
  requireRole('member'),
  validateRequest({ params: ParamsSchema }),
  <Resource>Controller.list
)

export { router as <resource>Router }
```

### Controller File

```typescript
import { RequestHandler } from 'express'
import { prisma } from '../lib/prisma'
import { AppError } from '../lib/errors'

export const <Resource>Controller = {
  list: (async (req, res) => {
    const { slug } = req.params
    const tenantId = req.tenantId!

    const resources = await prisma.<resource>.findMany({
      where: { organizationId: tenantId },
    })

    res.json({ data: resources })
  }) as RequestHandler,
}
```

### Test File

```typescript
import request from 'supertest'
import { app } from '../app'
import { resetDatabase, seedTestUser } from '../test-helpers/db'
import { generateToken } from '../test-helpers/auth'

beforeEach(async () => {
  await resetDatabase()
})

describe('GET /api/v1/orgs/:slug/<resources>', () => {
  it('returns 401 when not authenticated', async () => {
    await request(app)
      .get('/api/v1/orgs/acme/<resources>')
      .expect(401)
  })

  it('returns 200 and resources list when authenticated', async () => {
    const user = await seedTestUser({ orgSlug: 'acme' })
    const token = generateToken(user)

    const response = await request(app)
      .get('/api/v1/orgs/acme/<resources>')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body.data).toBeInstanceOf(Array)
  })
})
```

## Checklist

- [ ] Route file created
- [ ] Controller file created
- [ ] Zod schema created
- [ ] OpenAPI entry added
- [ ] Test file created with 401, 403, 404 cases
- [ ] Route registered in app
- [ ] Types regenerated
- [ ] Tests pass
