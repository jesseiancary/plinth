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

describe('GET /api/v1/orgs/:slug/members', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('lists all members with pagination', async () => {
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: member } = await createTestUser({ email: 'member@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')
    await createTestMembership(admin.id, org.id, 'ADMIN')
    await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/members')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(3)
    expect(response.body.nextCursor).toBeNull()
  })

  it('returns paginated results with cursor', async () => {
    const { user: owner } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')

    // Create 25 members
    for (let i = 0; i < 25; i++) {
      const { user } = await createTestUser({ email: `member${i}@example.com` })
      await createTestMembership(user.id, org.id, 'MEMBER')
    }

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .get('/api/v1/orgs/test-org/members?limit=10')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(10)
    expect(response.body.nextCursor).toBeDefined()
    expect(response.body.nextCursor).not.toBeNull()
  })

  it('returns 403 for non-members', async () => {
    await createTestOrg({ slug: 'private-org' })
    const { user } = await createTestUser()
    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .get('/api/v1/orgs/private-org/members')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(404) // 404 vs 403 decision
    expect(response.body.error.code).toBe('ORG_NOT_FOUND')
  })
})

describe('PATCH /api/v1/orgs/:slug/members/:memberId', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('updates member role as ADMIN', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: member } = await createTestUser({ email: 'member@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    const membershipToUpdate = await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .patch(`/api/v1/orgs/test-org/members/${membershipToUpdate.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ADMIN',
      })

    expect(response.status).toBe(200)
    expect(response.body.role).toBe('ADMIN')
  })

  it('returns 403 when ADMIN tries to demote OWNER', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    const ownerMembership = await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .patch(`/api/v1/orgs/test-org/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'MEMBER',
      })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('CANNOT_DEMOTE_OWNER')
  })

  it('returns 409 when trying to remove last OWNER', async () => {
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    const ownerMembership = await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .patch(`/api/v1/orgs/test-org/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ADMIN',
      })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('LAST_OWNER_PROTECTION')
  })

  it('allows OWNER to demote another OWNER if multiple exist', async () => {
    const { user: owner1 } = await createTestUser({ email: 'owner1@example.com' })
    const { user: owner2 } = await createTestUser({ email: 'owner2@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner1.id, org.id, 'OWNER')
    const owner2Membership = await createTestMembership(owner2.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(owner1.id, owner1.email)

    const response = await request(app)
      .patch(`/api/v1/orgs/test-org/members/${owner2Membership.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ADMIN',
      })

    expect(response.status).toBe(200)
    expect(response.body.role).toBe('ADMIN')
  })

  it('returns 404 for non-existent member', async () => {
    const { user } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(user.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(user.id, user.email)

    const response = await request(app)
      .patch('/api/v1/orgs/test-org/members/nonexistent-id')
      .set('Authorization', `Bearer ${token}`)
      .send({
        role: 'ADMIN',
      })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('MEMBER_NOT_FOUND')
  })
})

describe('DELETE /api/v1/orgs/:slug/members/:memberId', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('removes member as ADMIN', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: member } = await createTestUser({ email: 'member@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    const membershipToRemove = await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/members/${membershipToRemove.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)

    // Verify deleted
    const deleted = await prisma.membership.findUnique({
      where: { id: membershipToRemove.id },
    })

    expect(deleted).toBeNull()
  })

  it('allows member to remove themselves (self-leave)', async () => {
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })
    const { user: member } = await createTestUser({ email: 'member@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')
    const membershipToRemove = await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(member.id, member.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/members/${membershipToRemove.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(204)
  })

  it('returns 403 when ADMIN tries to remove OWNER', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    const ownerMembership = await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('CANNOT_REMOVE_OWNER')
  })

  it('returns 409 when trying to remove last OWNER', async () => {
    const { user: owner } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    const ownerMembership = await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/members/${ownerMembership.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('LAST_OWNER_PROTECTION')
  })

  it('returns 403 when MEMBER tries to remove another MEMBER', async () => {
    const { user: member1 } = await createTestUser({ email: 'member1@example.com' })
    const { user: member2 } = await createTestUser({ email: 'member2@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(member1.id, org.id, 'MEMBER')
    const member2Membership = await createTestMembership(member2.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(member1.id, member1.email)

    const response = await request(app)
      .delete(`/api/v1/orgs/test-org/members/${member2Membership.id}`)
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})

describe('POST /api/v1/orgs/:slug/transfer-ownership', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('transfers ownership from current OWNER to another member', async () => {
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })
    const { user: newOwner } = await createTestUser({ email: 'newowner@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')
    await createTestMembership(newOwner.id, org.id, 'ADMIN')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/transfer-ownership')
      .set('Authorization', `Bearer ${token}`)
      .send({
        newOwnerId: newOwner.id,
      })

    expect(response.status).toBe(200)
    expect(response.body.newOwner.role).toBe('OWNER')
    expect(response.body.newOwner.userId).toBe(newOwner.id)
    expect(response.body.formerOwner.role).toBe('ADMIN')
    expect(response.body.formerOwner.userId).toBe(owner.id)
  })

  it('returns 400 when trying to transfer to self', async () => {
    const { user: owner } = await createTestUser()
    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/transfer-ownership')
      .set('Authorization', `Bearer ${token}`)
      .send({
        newOwnerId: owner.id,
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('CANNOT_TRANSFER_TO_SELF')
  })

  it('returns 404 when new owner is not a member', async () => {
    const { user: owner } = await createTestUser({ email: 'owner@example.com' })
    const { user: outsider } = await createTestUser({ email: 'outsider@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(owner.id, org.id, 'OWNER')

    const token = await generateTestAccessToken(owner.id, owner.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/transfer-ownership')
      .set('Authorization', `Bearer ${token}`)
      .send({
        newOwnerId: outsider.id,
      })

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe('NEW_OWNER_NOT_MEMBER')
  })

  it('returns 403 when ADMIN tries to transfer ownership', async () => {
    const { user: admin } = await createTestUser({ email: 'admin@example.com' })
    const { user: member } = await createTestUser({ email: 'member@example.com' })

    const org = await createTestOrg({ slug: 'test-org' })
    await createTestMembership(admin.id, org.id, 'ADMIN')
    await createTestMembership(member.id, org.id, 'MEMBER')

    const token = await generateTestAccessToken(admin.id, admin.email)

    const response = await request(app)
      .post('/api/v1/orgs/test-org/transfer-ownership')
      .set('Authorization', `Bearer ${token}`)
      .send({
        newOwnerId: member.id,
      })

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })
})
