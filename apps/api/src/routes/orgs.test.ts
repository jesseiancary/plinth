import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { prisma } from '../lib/prisma.js'
import {
  clearDatabase,
  createTestMembership,
  createTestOrg,
  createTestUser,
  generateTestAccessToken,
} from '../lib/test-helpers.js'

describe('POST /api/v1/orgs', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('creates a new organization and assigns caller as OWNER', async () => {
    const { user } = await createTestUser({ email: 'owner@example.com' })
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .post('/api/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Organization',
        slug: 'new-org',
      })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      name: 'New Organization',
      slug: 'new-org',
      membership: {
        role: 'OWNER',
      },
    })

    // Verify in database
    const org = await prisma.organization.findUnique({
      where: { slug: 'new-org' },
      include: { memberships: true },
    })

    expect(org).toBeDefined()
    expect(org?.memberships).toHaveLength(1)
    expect(org?.memberships[0]?.role).toBe('OWNER')
    expect(org?.memberships[0]?.userId).toBe(user.id)
  })

  it('returns 401 if not authenticated', async () => {
    const response = await request(app).post('/api/v1/orgs').send({
      name: 'New Organization',
      slug: 'new-org',
    })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 400 if slug is invalid format', async () => {
    const { user } = await createTestUser()
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .post('/api/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'New Organization',
        slug: 'Invalid_Slug!',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 409 if slug already exists', async () => {
    await createTestOrg({ slug: 'existing-org' })

    const { user } = await createTestUser()
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .post('/api/v1/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Another Organization',
        slug: 'existing-org',
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('ORG_SLUG_EXISTS')
  })
})

describe('GET /api/v1/orgs/:slug', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('returns organization details for members', async () => {
    const { user } = await createTestUser({ email: 'member@example.com' })
    const org = await createTestOrg({ name: 'Test Org', slug: 'test-org' })
    await createTestMembership(user.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      name: 'Test Org',
      slug: 'test-org',
    })
  })

  it('returns 404 if organization does not exist', async () => {
    const { user } = await createTestUser()
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .get('/api/v1/orgs/nonexistent')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('ORG_NOT_FOUND')
  })

  it('returns 404 if user is not a member (404 vs 403)', async () => {
    await createTestOrg({ slug: 'private-org' })
    const { user } = await createTestUser()
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .get('/api/v1/orgs/private-org')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('ORG_NOT_FOUND')
  })

  it('returns 401 if not authenticated', async () => {
    await createTestOrg({ slug: 'test-org' })

    const response = await request(app).get('/api/v1/orgs/test-org')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })
})

describe('PATCH /api/v1/orgs/:slug', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('updates organization name as ADMIN', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(user.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .patch('/api/v1/orgs/test-org')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
      })

    expect(response.status).toBe(200)
    expect(response.body.name).toBe('Updated Name')
    expect(response.body.slug).toBe('test-org')
  })

  it('updates organization slug as OWNER', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'old-slug' })
    await createTestMembership(user.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .patch('/api/v1/orgs/old-slug')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'new-slug',
      })

    expect(response.status).toBe(200)
    expect(response.body.slug).toBe('new-slug')
  })

  it('returns 409 if new slug already exists', async () => {
    await createTestOrg({ slug: 'existing-slug' })

    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'my-org' })
    await createTestMembership(user.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .patch('/api/v1/orgs/my-org')
      .set('Authorization', `Bearer ${token}`)
      .send({
        slug: 'existing-slug',
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('ORG_SLUG_EXISTS')
  })

  it('returns 403 if user is MEMBER (requires ADMIN)', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(user.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .patch('/api/v1/orgs/test-org')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
      })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('DELETE /api/v1/orgs/:slug', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('deletes organization as OWNER', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'delete-me' })
    await createTestMembership(user.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .delete('/api/v1/orgs/delete-me')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)

    // Verify deleted
    const deleted = await prisma.organization.findUnique({
      where: { slug: 'delete-me' },
    })

    expect(deleted).toBeNull()
  })

  it('cascades delete to memberships', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'delete-me' })
    const membership = await createTestMembership(user.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(user.id, user.email)

    await request(app).delete('/api/v1/orgs/delete-me').set('Authorization', `Bearer ${token}`)

    // Verify membership deleted
    const deletedMembership = await prisma.membership.findUnique({
      where: { id: membership.id },
    })

    expect(deletedMembership).toBeNull()
  })

  it('returns 403 if user is ADMIN (requires OWNER)', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(user.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .delete('/api/v1/orgs/test-org')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 if organization does not exist', async () => {
    const { user } = await createTestUser()
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .delete('/api/v1/orgs/nonexistent')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('ORG_NOT_FOUND')
  })
})
