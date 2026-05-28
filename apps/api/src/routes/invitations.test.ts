import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { sha256 } from '../lib/crypto.js'
import { prisma } from '../lib/prisma.js'
import {
  clearDatabase,
  createTestInvitation,
  createTestMembership,
  createTestOrg,
  createTestUser,
  generateTestAccessToken,
} from '../lib/test-helpers.js'

describe('POST /api/v1/orgs/:slug/invitations', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('creates invitation as ADMIN and returns token', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser@example.com',
        role: 'MEMBER',
      })

    expect(response.status).toBe(201)
    expect(response.body.invitation).toMatchObject({
      email: 'newuser@example.com',
      role: 'MEMBER',
      status: 'PENDING',
    })
    expect(response.body.token).toBeDefined()
    expect(response.body.token).toMatch(/^inv_/)
  })

  it('returns 409 if user is already a member', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: existing } = await createTestUser({ email: 'existing@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    await createTestMembership(existing.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'existing@example.com',
        role: 'MEMBER',
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('USER_ALREADY_MEMBER')
  })

  it('returns 409 if pending invitation already exists', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    await createTestInvitation({
      email: 'invited@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'invited@example.com',
        role: 'MEMBER',
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('INVITATION_ALREADY_EXISTS')
  })

  it('returns 403 when MEMBER tries to create invitation', async () => {
    const { user: member } = await createTestUser({ email: 'member@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(member.id, member.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser@example.com',
        role: 'MEMBER',
      })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('GET /api/v1/orgs/:slug/invitations', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('lists all invitations with pagination', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    await createTestInvitation({
      email: 'user1@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
    })

    await createTestInvitation({
      email: 'user2@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'ACCEPTED',
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/invitations')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(2)
    expect(response.body.nextCursor).toBeNull()
  })

  it('filters invitations by status', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    await createTestInvitation({
      email: 'pending@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
    })

    await createTestInvitation({
      email: 'accepted@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'ACCEPTED',
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/invitations?status=PENDING')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].status).toBe('PENDING')
  })

  it('returns 403 when MEMBER tries to list invitations', async () => {
    const { user: member } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(member.id, member.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/invitations')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('DELETE /api/v1/orgs/:slug/invitations/:invitationId', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('revokes pending invitation as ADMIN', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { invitation } = await createTestInvitation({
      email: 'invited@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/invitations/${invitation.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)

    // Verify status updated
    const updated = await prisma.invitation.findUnique({
      where: { id: invitation.id },
    })

    expect(updated?.status).toBe('REVOKED')
  })

  it('returns 410 when trying to revoke already accepted invitation', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { invitation } = await createTestInvitation({
      email: 'invited@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'ACCEPTED',
    })

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/invitations/${invitation.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(410)
    expect(response.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED')
  })

  it('returns 404 for non-existent invitation', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete('/api/v1/orgs/test-org/invitations/nonexistent-id')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('INVITATION_NOT_FOUND')
  })
})

describe('GET /api/v1/invitations/validate/:token', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('validates and returns invitation details (public endpoint)', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ name: 'Test Org', slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { token } = await createTestInvitation({
      email: 'invited@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      role: 'MEMBER',
      status: 'PENDING',
    })

    // No authentication required
    const response = await request(app).get(`/api/v1/invitations/validate/${token}`)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      email: 'invited@example.com',
      role: 'MEMBER',
      organization: {
        name: 'Test Org',
        slug: 'test-org',
      },
    })
    expect(response.body.expiresAt).toBeDefined()
  })

  it('returns 404 for invalid token', async () => {
    const response = await request(app).get('/api/v1/invitations/validate/invalid-token')

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('INVALID_TOKEN')
  })

  it('returns 410 for expired invitation', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { token } = await createTestInvitation({
      email: 'invited@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    })

    const response = await request(app).get(`/api/v1/invitations/validate/${token}`)

    expect(response.status).toBe(410)
    expect(response.body.error.code).toBe('INVITATION_EXPIRED')
  })

  it('returns 410 for revoked invitation', async () => {
    const { user: admin } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { token } = await createTestInvitation({
      email: 'invited@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'REVOKED',
    })

    const response = await request(app).get(`/api/v1/invitations/validate/${token}`)

    expect(response.status).toBe(410)
    expect(response.body.error.code).toBe('INVITATION_REVOKED')
  })
})

describe('POST /api/v1/invitations/accept', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('accepts invitation and creates membership', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: invitee } = await createTestUser({ email: 'invitee@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { token: inviteToken } = await createTestInvitation({
      email: 'invitee@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      role: 'MEMBER',
      status: 'PENDING',
    })

    const accessToken = await generateTestAccessToken(invitee.id, invitee.email)

    const response = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: inviteToken,
      })

    expect(response.status).toBe(201)
    expect(response.body.membership.role).toBe('MEMBER')
    expect(response.body.organization.slug).toBe('test-org')

    // Verify membership created
    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: invitee.id,
          organizationId: org.id,
        },
      },
    })

    expect(membership).toBeDefined()
    expect(membership?.role).toBe('MEMBER')

    // Verify invitation marked as accepted
    const tokenHash = sha256(inviteToken)
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash },
    })

    expect(invitation?.status).toBe('ACCEPTED')
    expect(invitation?.acceptedAt).toBeDefined()
  })

  it('returns 409 if user is already a member', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: existing } = await createTestUser({ email: 'existing@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    await createTestMembership(existing.id, org.id, 'MEMBER')

    const { token: inviteToken } = await createTestInvitation({
      email: 'existing@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
    })

    const accessToken = await generateTestAccessToken(existing.id, existing.email)

    const response = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: inviteToken,
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('USER_ALREADY_MEMBER')
  })

  it('returns 410 for expired invitation', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: invitee } = await createTestUser({ email: 'invitee@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')

    const { token: inviteToken } = await createTestInvitation({
      email: 'invitee@example.com',
      organizationId: org.id,
      invitedById: admin.id,
      status: 'PENDING',
      expiresAt: new Date(Date.now() - 1000), // Expired
    })

    const accessToken = await generateTestAccessToken(invitee.id, invitee.email)

    const response = await request(app)
      .post('/api/v1/invitations/accept')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        token: inviteToken,
      })

    expect(response.status).toBe(410)
    expect(response.body.error.code).toBe('INVITATION_EXPIRED')
  })

  it('returns 401 if not authenticated', async () => {
    const response = await request(app).post('/api/v1/invitations/accept').send({
      token: 'some-token',
    })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })
})
