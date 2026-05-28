import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { prisma } from '../lib/prisma.js'
import {
  clearDatabase,
  createTestApiKey,
  createTestMembership,
  createTestOrg,
  createTestUser,
  generateTestAccessToken,
} from '../lib/test-helpers.js'

describe('POST /api/v1/orgs/:slug/api-keys', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('generates API key as ADMIN and returns plaintext key once', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Production API Key',
        scopes: ['org:read', 'members:read'],
      })

    expect(response.status).toBe(201)
    expect(response.body.name).toBe('Production API Key')
    expect(response.body.key).toBeDefined()
    expect(response.body.key).toMatch(/^sk_live_/)
    expect(response.body.scopes).toEqual(['org:read', 'members:read'])
  })

  it('uses default scope if not provided', async () => {
    const { user: owner } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Key',
      })

    expect(response.status).toBe(201)
    expect(response.body.scopes).toEqual(['org:read'])
  })

  it('returns 400 for invalid scopes', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Key',
        scopes: ['invalid:scope'],
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 403 when MEMBER tries to create API key', async () => {
    const { user: member } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(member.id, member.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/api-keys')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Key',
        scopes: ['org:read'],
      })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/v1/orgs/:slug/api-keys', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('lists all API keys for the organization', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    await createTestApiKey({
      name: 'Key 1',
      organizationId: org.id,
      scopes: ['org:read'],
    })

    await createTestApiKey({
      name: 'Key 2',
      organizationId: org.id,
      scopes: ['members:read'],
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/api-keys')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(2)
    expect(response.body.nextCursor).toBeNull()

    // Verify plaintext key is not included
    expect(response.body.data[0]).not.toHaveProperty('key')
    expect(response.body.data[0]).not.toHaveProperty('keyHash')
  })

  it('filters active keys only', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    await createTestApiKey({
      name: 'Active Key',
      organizationId: org.id,
      revokedAt: null,
    })

    await createTestApiKey({
      name: 'Revoked Key',
      organizationId: org.id,
      revokedAt: new Date(),
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/api-keys?active=true')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].name).toBe('Active Key')
    expect(response.body.data[0].revokedAt).toBeNull()
  })

  it('supports pagination', async () => {
    const { user: owner } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')

    // Create 25 API keys
    for (let i = 0; i < 25; i++) {
      await createTestApiKey({
        name: `Key ${i}`,
        organizationId: org.id,
      })
    }

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/api-keys?limit=10')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(10)
    expect(response.body.nextCursor).toBeDefined()
    expect(response.body.nextCursor).not.toBeNull()
  })

  it('returns 403 when MEMBER tries to list API keys', async () => {
    const { user: member } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(member.id, member.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/api-keys')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('DELETE /api/v1/orgs/:slug/api-keys/:keyId', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('revokes API key as ADMIN (soft delete)', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { apiKey } = await createTestApiKey({
      name: 'Test Key',
      organizationId: org.id,
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/api-keys/${apiKey.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)

    // Verify soft deleted (revokedAt set)
    const revoked = await prisma.apiKey.findUnique({
      where: { id: apiKey.id },
    })

    expect(revoked).toBeDefined()
    expect(revoked?.revokedAt).toBeDefined()
    expect(revoked?.revokedAt).toBeInstanceOf(Date)
  })

  it('returns 404 for already revoked key', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { apiKey } = await createTestApiKey({
      name: 'Test Key',
      organizationId: org.id,
      revokedAt: new Date(),
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/api-keys/${apiKey.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('API_KEY_NOT_FOUND')
  })

  it('returns 404 for non-existent key', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete('/api/v1/orgs/test-org/api-keys/nonexistent-id')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('API_KEY_NOT_FOUND')
  })

  it('returns 403 when MEMBER tries to revoke API key', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: member } = await createTestUser({ email: 'member@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    await createTestMembership(member.id, org.id, 'MEMBER')

    const { apiKey } = await createTestApiKey({
      name: 'Test Key',
      organizationId: org.id,
    })

    const token = await generateTestAccessToken(member.id, member.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/api-keys/${apiKey.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('prevents cross-tenant key revocation', async () => {
    const { user: admin1 } = await createTestUser({ email: 'admin1@example.com' })
    const { user: admin2 } = await createTestUser({ email: 'admin2@example.com' })

    const org1 = await createTestOrg({ slug: 'org-1' })
    const org2 = await createTestOrg({ slug: 'org-2' })

    await createTestMembership(admin1.id, org1.id, 'ADMIN')
    await createTestMembership(admin2.id, org2.id, 'ADMIN')

    const { apiKey } = await createTestApiKey({
      name: 'Org 2 Key',
      organizationId: org2.id,
    })

    const token = await generateTestAccessToken(admin1.id, admin1.email)

    // Try to revoke org2's key using org1 admin
    const response = await request(app)
      .delete(`/api/v1/orgs/org-1/api-keys/${apiKey.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('API_KEY_NOT_FOUND')

    // Verify key is still active
    const stillActive = await prisma.apiKey.findUnique({
      where: { id: apiKey.id },
    })

    expect(stillActive?.revokedAt).toBeNull()
  })
})
