import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { generateApiKey, hashApiKey } from '../lib/api-key.js'
import { hashPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'

describe('CSRF Protection', () => {
  let accessToken: string
  let refreshTokenCookie: string
  let csrfToken: string
  let orgId: string
  let orgSlug: string
  let originalNodeEnv: string | undefined

  // Temporarily disable test mode for CSRF tests
  // These tests specifically need to test the CSRF middleware behavior
  beforeAll(() => {
    originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  beforeEach(async () => {
    // Clean database
    await prisma.$transaction([
      prisma.apiKey.deleteMany(),
      prisma.invitation.deleteMany(),
      prisma.membership.deleteMany(),
      prisma.organization.deleteMany(),
      prisma.user.deleteMany(),
    ])

    // Create test user with organization
    const passwordHash = await hashPassword('SecurePass123!')
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: passwordHash,
        name: 'Test User',
        memberships: {
          create: {
            role: 'OWNER',
            organization: {
              create: {
                name: 'Test Org',
                slug: 'test-org',
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    })

    orgId = user.memberships[0]?.organization.id ?? ''
    orgSlug = user.memberships[0]?.organization.slug ?? ''

    // Login to get tokens
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'SecurePass123!',
    })

    accessToken = loginRes.body.accessToken as string
    const cookies = loginRes.headers['set-cookie'] as unknown as string[]
    refreshTokenCookie = cookies.find((c) => c.startsWith('refreshToken=')) ?? ''

    // Get CSRF token by making a GET request
    const getRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)

    const csrfCookies = getRes.headers['set-cookie'] as unknown as string[]
    const csrfCookie = csrfCookies?.find((c) => c.startsWith('csrf-token='))
    if (csrfCookie) {
      csrfToken = csrfCookie.split(';')[0]?.split('=')[1] ?? ''
    }
  })

  describe('GET requests', () => {
    it('should set CSRF token cookie on GET requests', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(200)
      const cookies = res.headers['set-cookie'] as unknown as string[]
      const csrfCookie = cookies?.find((c) => c.startsWith('csrf-token='))
      expect(csrfCookie).toBeDefined()
      expect(csrfCookie).toContain('SameSite=Strict')
    })
  })

  describe('POST requests', () => {
    it('should reject POST request without CSRF token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', refreshTokenCookie)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING')
    })

    it('should reject POST request with invalid CSRF token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `${refreshTokenCookie}; csrf-token=validbutdifferenttoken1234567890abcdef`)
        .set('X-CSRF-Token', 'invalid-token')

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID')
    })

    it('should accept POST request with valid CSRF token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `${refreshTokenCookie}; csrf-token=${csrfToken}`)
        .set('X-CSRF-Token', csrfToken)

      expect(res.status).toBe(204)
    })

    it('should allow login without CSRF token (public endpoint)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
    })

    it('should allow register without CSRF token (public endpoint)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'new@example.com',
        password: 'NewSecurePass123!',
        name: 'New User',
      })

      expect(res.status).toBe(201)
      expect(res.body.accessToken).toBeDefined()
    })

    it('should allow login with trailing slash (no CSRF token required)', async () => {
      const res = await request(app).post('/api/v1/auth/login/').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
    })

    it('should allow register with trailing slash (no CSRF token required)', async () => {
      const res = await request(app).post('/api/v1/auth/register/').send({
        email: 'trailing@example.com',
        password: 'TrailingSlash123!',
        name: 'Trailing User',
      })

      expect(res.status).toBe(201)
      expect(res.body.accessToken).toBeDefined()
    })

    it('should handle refresh endpoint with trailing slash', async () => {
      // First login to get refresh token
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'test@example.com',
        password: 'SecurePass123!',
      })

      const cookies = loginRes.headers['set-cookie'] as unknown as string[]

      // Test refresh with trailing slash (should work without CSRF)
      const res = await request(app).post('/api/v1/auth/refresh/').set('Cookie', cookies)

      expect(res.status).toBe(200)
      expect(res.body.accessToken).toBeDefined()
    })
  })

  describe('PATCH requests', () => {
    it('should reject PATCH request without CSRF token', async () => {
      const res = await request(app)
        .patch(`/api/v1/orgs/${orgSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Org' })

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING')
    })

    it('should accept PATCH request with valid CSRF token', async () => {
      const res = await request(app)
        .patch(`/api/v1/orgs/${orgSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `csrf-token=${csrfToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Updated Org' })

      expect(res.status).toBe(200)
      expect(res.body.name).toBe('Updated Org')
    })
  })

  describe('DELETE requests', () => {
    it('should reject DELETE request without CSRF token', async () => {
      const res = await request(app)
        .delete(`/api/v1/orgs/${orgSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING')
    })

    it('should accept DELETE request with valid CSRF token', async () => {
      const res = await request(app)
        .delete(`/api/v1/orgs/${orgSlug}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `csrf-token=${csrfToken}`)
        .set('X-CSRF-Token', csrfToken)

      expect(res.status).toBe(204)
    })
  })

  describe('API Key authentication', () => {
    it('should bypass CSRF protection for API key authentication', async () => {
      // Create an API key
      const apiKey = generateApiKey()
      const keyHash = hashApiKey(apiKey)

      await prisma.apiKey.create({
        data: {
          name: 'Test API Key',
          keyHash,
          scopes: [],
          organizationId: orgId,
        },
      })

      // Use API key without CSRF token
      // We're testing that CSRF doesn't block it - 401 from auth is fine
      // as long as it's not 403 from CSRF
      const res = await request(app)
        .post(`/api/v1/orgs/${orgSlug}/invitations`)
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          email: 'invited@example.com',
          role: 'MEMBER',
        })

      // Should not be blocked by CSRF (403)
      // May be 401 if API key auth fails, but that's not CSRF-related
      expect(res.status).not.toBe(403)
    })
  })

  describe('Timing attack prevention', () => {
    it('should use constant-time comparison for CSRF tokens', async () => {
      // Make multiple requests with different invalid tokens
      // and measure response times - they should be similar
      const invalidTokens = [
        'a',
        'ab',
        'abc',
        csrfToken.substring(0, 10), // Partial match
        csrfToken.substring(0, 20), // Longer partial match
        'x'.repeat(csrfToken.length), // Same length, wrong content
      ]

      const timings: number[] = []

      for (const token of invalidTokens) {
        const start = Date.now()
        await request(app)
          .post('/api/v1/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .set('Cookie', `csrf-token=${csrfToken}`)
          .set('X-CSRF-Token', token)

        const elapsed = Date.now() - start
        timings.push(elapsed)
      }

      // Calculate variance - should be low for constant-time comparison
      const mean = timings.reduce((sum, t) => sum + t, 0) / timings.length
      const variance = timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length
      const stdDev = Math.sqrt(variance)

      // Standard deviation should be relatively small
      // (allowing for some network/system variance)
      // More lenient threshold for CI environments where load varies
      const maxVariance = process.env.CI === 'true' ? 1.0 : 0.5
      expect(stdDev).toBeLessThan(mean * maxVariance)
    })
  })

  describe('Error messages', () => {
    it('should return user-friendly error message for missing token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)

      expect(res.status).toBe(403)
      expect(res.body.error.message).toContain('refresh the page')
      expect(res.body.error.code).toBe('CSRF_TOKEN_MISSING')
    })

    it('should return user-friendly error message for invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', `csrf-token=${csrfToken}`)
        .set('X-CSRF-Token', 'wrong-token')

      expect(res.status).toBe(403)
      expect(res.body.error.message).toContain('refresh the page')
      expect(res.body.error.code).toBe('CSRF_TOKEN_INVALID')
    })
  })

  describe('Cookie security', () => {
    it('should set CSRF cookie with correct security attributes', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)

      const cookies = res.headers['set-cookie'] as unknown as string[]
      const csrfCookie = cookies?.find((c) => c.startsWith('csrf-token='))

      expect(csrfCookie).toBeDefined()
      expect(csrfCookie).toContain('SameSite=Strict')
      expect(csrfCookie).not.toContain('HttpOnly') // Must be readable by JS
      expect(csrfCookie).toContain('Max-Age=3600') // 1 hour
    })
  })
})
