import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { generateApiKey } from '../lib/api-key.js'
import {
  clearDatabase,
  createTestApiKey,
  createTestInvitation,
  createTestMembership,
  createTestOrg,
  createTestUser,
} from '../lib/test-helpers.js'

/**
 * Dual-auth behavior for org-scoped endpoints: each may be driven by a JWT
 * member (covered in the per-route suites) OR an API key scoped to the org.
 * These tests exercise the API-key path only: scope sufficiency, cross-tenant
 * isolation (404, no leak), and revocation (401). Destructive / privilege-
 * escalating endpoints stay JWT-only and must reject API keys outright.
 */
describe('API key authentication (dual-auth endpoints)', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  describe('GET /api/v1/orgs/:slug (org:read)', () => {
    it('returns 200 with a key carrying org:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Reader',
        organizationId: org.id,
        scopes: ['org:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .expect(200)

      expect(response.body.slug).toBe('acme')
    })

    it('returns 403 INSUFFICIENT_SCOPE when the key lacks org:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Members only',
        organizationId: org.id,
        scopes: ['members:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE')
    })

    it('returns 404 when the key belongs to a different org', async () => {
      const orgA = await createTestOrg({ slug: 'acme' })
      const orgB = await createTestOrg({ slug: 'other' })
      const { key } = await createTestApiKey({
        name: 'Org B key',
        organizationId: orgB.id,
        scopes: ['org:read'],
      })

      const response = await request(app)
        .get(`/api/v1/orgs/${orgA.slug}`)
        .set('Authorization', `Bearer ${key}`)
        .expect(404)

      expect(response.body.error.code).toBe('ORG_NOT_FOUND')
    })

    it('returns 401 when the key is revoked', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Revoked',
        organizationId: org.id,
        scopes: ['org:read'],
        revokedAt: new Date(),
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .expect(401)

      expect(response.body.error.code).toBe('API_KEY_REVOKED')
    })

    it('returns 401 when the key is unknown', async () => {
      await createTestOrg({ slug: 'acme' })

      // A well-formed key that was never issued (never persisted) -> unknown.
      const unknownKey = generateApiKey()

      const response = await request(app)
        .get('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${unknownKey}`)
        .expect(401)

      expect(response.body.error.code).toBe('INVALID_API_KEY')
    })
  })

  describe('PATCH /api/v1/orgs/:slug (org:write)', () => {
    it('returns 200 with a key carrying org:write', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Writer',
        organizationId: org.id,
        scopes: ['org:write'],
      })

      const response = await request(app)
        .patch('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .send({ name: 'Acme Renamed' })
        .expect(200)

      expect(response.body.name).toBe('Acme Renamed')
    })

    it('returns 403 when the key only has org:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Reader',
        organizationId: org.id,
        scopes: ['org:read'],
      })

      const response = await request(app)
        .patch('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .send({ name: 'Nope' })
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE')
    })
  })

  describe('GET /api/v1/orgs/:slug/members (members:read)', () => {
    it('returns 200 with a key carrying members:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { user } = await createTestUser({ email: 'member@example.com' })
      await createTestMembership(user.id, org.id, 'MEMBER')
      const { key } = await createTestApiKey({
        name: 'Members reader',
        organizationId: org.id,
        scopes: ['members:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme/members')
        .set('Authorization', `Bearer ${key}`)
        .expect(200)

      expect(response.body.data).toBeInstanceOf(Array)
    })

    it('returns 403 when the key lacks members:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Org reader',
        organizationId: org.id,
        scopes: ['org:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme/members')
        .set('Authorization', `Bearer ${key}`)
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE')
    })
  })

  describe('GET /api/v1/orgs/:slug/invitations (invitations:read)', () => {
    it('returns 200 with a key carrying invitations:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Invites reader',
        organizationId: org.id,
        scopes: ['invitations:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme/invitations')
        .set('Authorization', `Bearer ${key}`)
        .expect(200)

      expect(response.body.data).toBeInstanceOf(Array)
    })

    it('returns 403 when the key lacks invitations:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Org reader',
        organizationId: org.id,
        scopes: ['org:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme/invitations')
        .set('Authorization', `Bearer ${key}`)
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE')
    })
  })

  describe('DELETE /api/v1/orgs/:slug/invitations/:id (invitations:write)', () => {
    it('revokes an invitation with a key carrying invitations:write', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { user: inviter } = await createTestUser({ email: 'inviter@example.com' })
      await createTestMembership(inviter.id, org.id, 'ADMIN')
      const { invitation } = await createTestInvitation({
        email: 'invitee@example.com',
        organizationId: org.id,
        invitedById: inviter.id,
      })
      const { key } = await createTestApiKey({
        name: 'Invites writer',
        organizationId: org.id,
        scopes: ['invitations:write'],
      })

      await request(app)
        .delete(`/api/v1/orgs/acme/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${key}`)
        .expect(204)
    })

    it('returns 403 when the key only has invitations:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { user: inviter } = await createTestUser({ email: 'inviter@example.com' })
      await createTestMembership(inviter.id, org.id, 'ADMIN')
      const { invitation } = await createTestInvitation({
        email: 'invitee@example.com',
        organizationId: org.id,
        invitedById: inviter.id,
      })
      const { key } = await createTestApiKey({
        name: 'Invites reader',
        organizationId: org.id,
        scopes: ['invitations:read'],
      })

      const response = await request(app)
        .delete(`/api/v1/orgs/acme/invitations/${invitation.id}`)
        .set('Authorization', `Bearer ${key}`)
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE')
    })
  })

  describe('GET /api/v1/orgs/:slug/api-keys (api-keys:read)', () => {
    it('returns 200 with a key carrying api-keys:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Keys reader',
        organizationId: org.id,
        scopes: ['api-keys:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme/api-keys')
        .set('Authorization', `Bearer ${key}`)
        .expect(200)

      expect(response.body.data).toBeInstanceOf(Array)
    })

    it('returns 403 when the key lacks api-keys:read', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Org reader',
        organizationId: org.id,
        scopes: ['org:read'],
      })

      const response = await request(app)
        .get('/api/v1/orgs/acme/api-keys')
        .set('Authorization', `Bearer ${key}`)
        .expect(403)

      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE')
    })
  })

  describe('JWT-only endpoints reject API keys', () => {
    it('rejects a key on DELETE /orgs/:slug even with org:delete', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Deleter',
        organizationId: org.id,
        scopes: ['org:delete'],
      })

      const response = await request(app)
        .delete('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .expect(401)

      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    })

    it('rejects a key on POST /orgs/:slug/invitations even with invitations:write', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Inviter',
        organizationId: org.id,
        scopes: ['invitations:write'],
      })

      const response = await request(app)
        .post('/api/v1/orgs/acme/invitations')
        .set('Authorization', `Bearer ${key}`)
        .send({ email: 'new@example.com', role: 'MEMBER' })
        .expect(401)

      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    })

    it('rejects a key on POST /orgs/:slug/api-keys even with api-keys:write', async () => {
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Minter',
        organizationId: org.id,
        scopes: ['api-keys:write'],
      })

      const response = await request(app)
        .post('/api/v1/orgs/acme/api-keys')
        .set('Authorization', `Bearer ${key}`)
        .send({ name: 'Spawned key', scopes: ['org:read'] })
        .expect(401)

      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    })

    it('returns UNAUTHENTICATED (not API_KEY_REVOKED) for a revoked key on a JWT-only route', async () => {
      // Guards that authenticateApiKeyOptional is NOT wired on JWT-only routes: if it
      // were, verifyApiKey would reject the revoked key with 401 API_KEY_REVOKED. Since
      // it isn't, the non-JWT token falls through to requireRole -> 401 UNAUTHENTICATED.
      const org = await createTestOrg({ slug: 'acme' })
      const { key } = await createTestApiKey({
        name: 'Revoked deleter',
        organizationId: org.id,
        scopes: ['org:delete'],
        revokedAt: new Date(),
      })

      const response = await request(app)
        .delete('/api/v1/orgs/acme')
        .set('Authorization', `Bearer ${key}`)
        .expect(401)

      expect(response.body.error.code).toBe('UNAUTHENTICATED')
    })
  })
})
