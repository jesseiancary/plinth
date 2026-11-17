import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import vitestOpenAPI from 'vitest-openapi'

import { app } from '../app.js'
import {
  clearDatabase,
  createTestMembership,
  createTestOrg,
  createTestUser,
  createTestUserWithResetToken,
  generateTestAccessToken,
} from '../lib/test-helpers.js'

const HEALTH_TOKEN = 'test-health-check-token-0123456789'

// Register the `toSatisfyApiSpec()` matcher against the OpenAPI contract — the
// same spec the app serves at /docs. Co-located here since this is the only
// suite that asserts against it.
const specPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../packages/openapi/openapi.yaml',
)
vitestOpenAPI(specPath)

// Contract tests: assert representative responses conform to the OpenAPI spec
// via the `toSatisfyApiSpec()` matcher. One case per response shape rather than
// retrofitting every route test.
describe('OpenAPI contract', () => {
  beforeEach(clearDatabase)

  describe('success responses', () => {
    it('GET /health', async () => {
      const response = await request(app).get('/health').expect(200)
      expect(response).toSatisfyApiSpec()
    })

    it('GET /health/detailed', async () => {
      const response = await request(app)
        .get('/health/detailed')
        .set('Authorization', `Bearer ${HEALTH_TOKEN}`)
        .expect(200)
      expect(response).toSatisfyApiSpec()
    })

    it('POST /api/v1/auth/register', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'new@example.com', password: 'Password123!', name: 'New User' })
        .expect(201)
      expect(response).toSatisfyApiSpec()
    })

    it('POST /api/v1/auth/forgot-password (generic 200)', async () => {
      await createTestUser({ email: 'reset@example.com' })
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'reset@example.com' })
        .expect(200)
      expect(response).toSatisfyApiSpec()
    })

    it('POST /api/v1/auth/reset-password (200 message)', async () => {
      const { token } = await createTestUserWithResetToken({ email: 'reset@example.com' })
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword: 'NewSecureP@ss1' })
        .expect(200)
      expect(response).toSatisfyApiSpec()
    })

    it('GET /api/v1/orgs/:slug/members (paginated, nullable nextCursor)', async () => {
      const { user: owner } = await createTestUser({ email: 'owner@example.com' })
      const org = await createTestOrg({ slug: 'test-org' })
      await createTestMembership(owner.id, org.id, 'OWNER')
      const token = await generateTestAccessToken(owner.id, owner.email)

      const response = await request(app)
        .get('/api/v1/orgs/test-org/members')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
      expect(response).toSatisfyApiSpec()
    })

    it('POST /api/v1/orgs/:slug/invitations (201 envelope)', async () => {
      const { user: owner } = await createTestUser({ email: 'owner@example.com' })
      const org = await createTestOrg({ slug: 'test-org' })
      await createTestMembership(owner.id, org.id, 'OWNER')
      const token = await generateTestAccessToken(owner.id, owner.email)

      const response = await request(app)
        .post('/api/v1/orgs/test-org/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'invitee@example.com', role: 'MEMBER' })
        .expect(201)
      expect(response).toSatisfyApiSpec()
    })
  })

  describe('error responses', () => {
    it('400 validation error with array details (non-auth route)', async () => {
      const { user: owner } = await createTestUser({ email: 'owner@example.com' })
      const org = await createTestOrg({ slug: 'test-org' })
      await createTestMembership(owner.id, org.id, 'OWNER')
      const token = await generateTestAccessToken(owner.id, owner.email)

      const response = await request(app)
        .post('/api/v1/orgs/test-org/invitations')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email', role: 'MEMBER' })
        .expect(400)

      expect(Array.isArray(response.body.error.details)).toBe(true)
      expect(response).toSatisfyApiSpec()
    })

    it('400 validation error with array details (auth route — canonical shape)', async () => {
      // Auth routes now let ZodErrors flow to the global error handler like every other route,
      // so their validation-error `details` is the same `err.issues` array (no per-route wrap).
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', name: '' })
        .expect(400)

      expect(Array.isArray(response.body.error.details)).toBe(true)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response).toSatisfyApiSpec()
    })

    it('401 unauthenticated', async () => {
      const response = await request(app).get('/api/v1/orgs/test-org/members').expect(401)
      expect(response).toSatisfyApiSpec()
    })

    it('404 organization not found', async () => {
      const { user } = await createTestUser({ email: 'nobody@example.com' })
      const token = await generateTestAccessToken(user.id, user.email)

      const response = await request(app)
        .get('/api/v1/orgs/does-not-exist/members')
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
      expect(response).toSatisfyApiSpec()
    })
  })
})
