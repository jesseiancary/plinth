import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { generateVerificationToken, sha256 } from '../lib/crypto.js'
import { prisma } from '../lib/db.js'
import { clearTestOutbox, getTestOutbox } from '../lib/email.js'
import { clearDatabase, createTestUser } from '../lib/test-helpers.js'

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('creates an unverified user without issuing a session (verification required)', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
      })
      .expect(201)

    // Login is gated on verification, so registration must not auto-issue a session.
    expect(response.body).not.toHaveProperty('accessToken')
    expect(response.body).toHaveProperty('message')
    expect(response.body.user).toMatchObject({
      email: 'newuser@example.com',
      name: 'New User',
      emailVerified: false,
    })
  })

  it('does not set a refresh token cookie on registration', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
      })
      .expect(201)

    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('sends a verification email with a link matching the stored token hash', async () => {
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
      })
      .expect(201)

    const outbox = getTestOutbox()
    const verifyEmail = outbox.find((m) => m.to === 'newuser@example.com')
    expect(verifyEmail?.subject).toBe('Verify your email')

    // Extract the token from the emailed link and confirm it hashes to what we persisted.
    const match = verifyEmail?.html.match(/verify-email\?token=([a-z0-9_]+)/i)
    const token = match?.[1]
    expect(token).toBeTruthy()

    const user = await prisma.user.findUnique({ where: { email: 'newuser@example.com' } })
    expect(user?.emailVerified).toBe(false)
    expect(user?.verificationTokenHash).toBe(sha256(token as string))
    expect(user?.verificationExpiresAt).toBeTruthy()
  })

  it('creates personal organization for new user', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
      })
      .expect(201)

    const user = await prisma.user.findUnique({
      where: { email: 'newuser@example.com' },
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
      },
    })

    expect(user).toBeDefined()
    expect(user?.memberships).toHaveLength(1)
    expect(user?.memberships[0]?.role).toBe('OWNER')
    expect(user?.memberships[0]?.organization.name).toContain('New User')
  })

  it('returns 400 with generic error if email already exists (prevents enumeration)', async () => {
    await createTestUser({ email: 'existing@example.com' })

    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'existing@example.com',
        password: 'P@ssword123',
        name: 'Another User',
      })
      .expect(400)

    expect(response.body.error.code).toBe('REGISTRATION_FAILED')
    expect(response.body.error.message).toBe('Unable to complete registration')
  })

  it('normalizes timing on duplicate email to prevent timing attacks', async () => {
    await createTestUser({ email: 'existing@example.com' })

    const startTime = Date.now()
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'existing@example.com',
        password: 'P@ssword123',
        name: 'Another User',
      })
      .expect(400)
    const elapsed = Date.now() - startTime

    // Response should take at least 200ms due to timing normalization
    expect(elapsed).toBeGreaterThanOrEqual(200)
  })

  it('returns 400 for invalid email', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'invalid-email',
        password: 'P@ssword123',
        name: 'Test User',
      })
      .expect(400)
  })

  it('returns 400 for short password', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'short',
        name: 'Test User',
      })
      .expect(400)
  })

  it('returns 400 for password without uppercase letter', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'p@ssword123',
        name: 'Test User',
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(response.body.error.details)).toContain('uppercase')
  })

  it('returns 400 for password without lowercase letter', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'P@SSWORD123',
        name: 'Test User',
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(response.body.error.details)).toContain('lowercase')
  })

  it('returns 400 for password without number', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'P@sswordABC',
        name: 'Test User',
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(response.body.error.details)).toContain('number')
  })

  it('returns 400 for password without special character', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123',
        name: 'Test User',
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(response.body.error.details)).toContain('special')
  })
})

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('authenticates user and returns access token', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'correctPassword',
      })
      .expect(200)

    expect(response.body).toHaveProperty('accessToken')
    expect(response.body).toHaveProperty('user')
    expect(response.body.user.email).toBe('user@example.com')
    expect(response.body.user.emailVerified).toBe(true)
  })

  it('sets refresh token as httpOnly cookie', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'correctPassword',
      })
      .expect(200)
      .expect('set-cookie', /refreshToken=/)
  })

  it('returns 401 for non-existent user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'P@ssword123',
      })
      .expect(401)

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 401 for wrong password', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'wrongPassword',
      })
      .expect(401)

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('POST /api/v1/auth/refresh', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('returns new access token when refresh token is valid', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    // Login to get refresh token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    // Use refresh token to get new access token
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(200)

    expect(refreshResponse.body).toHaveProperty('accessToken')
  })

  it('returns 401 when refresh token is missing', async () => {
    const response = await request(app).post('/api/v1/auth/refresh').expect(401)

    expect(response.body.error.code).toBe('REFRESH_TOKEN_MISSING')
  })

  it('returns 401 when refresh token is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['refreshToken=invalid-token'])
      .expect(401)

    expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('returns 401 when token version is outdated', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    // Login to get refresh token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    // Increment token version (simulate logout)
    const user = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    })

    await prisma.user.update({
      where: { id: user!.id },
      data: { tokenVersion: { increment: 1 } },
    })

    // Try to refresh with old token
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(401)

    expect(refreshResponse.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })
})

describe('POST /api/v1/auth/logout', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('invalidates refresh token by incrementing token version', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    // Login
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    const userBefore = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    })

    // Logout
    await request(app).post('/api/v1/auth/logout').set('Cookie', cookies).expect(204)

    const userAfter = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    })

    expect(userAfter!.tokenVersion).toBe(userBefore!.tokenVersion + 1)
  })

  it('clears refresh token cookie', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    const logoutResponse = await request(app).post('/api/v1/auth/logout').set('Cookie', cookies)

    const setCookieHeaders = logoutResponse.headers['set-cookie']
    expect(setCookieHeaders).toBeDefined()
    expect(
      Array.isArray(setCookieHeaders) &&
        setCookieHeaders.some((cookie: string) => cookie.includes('refreshToken=')),
    ).toBe(true)
  })

  it('returns 204 even when no refresh token provided', async () => {
    await request(app).post('/api/v1/auth/logout').expect(204)
  })

  it('returns 204 even when refresh token is invalid', async () => {
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', ['refreshToken=invalid-token'])
      .expect(204)
  })
})

describe('GET /api/v1/auth/me', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('returns current user with memberships when authenticated', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    // Login to get access token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'P@ssword123',
    })

    const { accessToken } = loginResponse.body

    // Get current user
    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(meResponse.body).toMatchObject({
      email: 'user@example.com',
      name: expect.any(String) as string,
      emailVerified: true,
    })
    expect(meResponse.body.memberships).toBeInstanceOf(Array)
    expect(meResponse.body.memberships.length).toBeGreaterThan(0)
    expect(meResponse.body.memberships[0]).toHaveProperty('role')
    expect(meResponse.body.memberships[0]).toHaveProperty('organization')
  })

  it('returns 401 when not authenticated', async () => {
    const response = await request(app).get('/api/v1/auth/me').expect(401)

    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 with invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })
})

describe('Security Headers', () => {
  it('sets security headers on all responses', async () => {
    const response = await request(app).get('/api/v1/auth/me')

    // Helmet sets these security headers
    expect(response.headers['x-dns-prefetch-control']).toBeDefined()
    expect(response.headers['x-frame-options']).toBeDefined()
    expect(response.headers['x-content-type-options']).toBeDefined()
    expect(response.headers['x-xss-protection']).toBeDefined()
  })

  it('does not set HSTS in test/dev environment', async () => {
    const response = await request(app).get('/api/v1/auth/me')

    // HSTS should not be set in development/test
    expect(response.headers['strict-transport-security']).toBeUndefined()
  })

  it('does not set CSP in test/dev environment', async () => {
    const response = await request(app).get('/api/v1/auth/me')

    // CSP should be disabled in development/test for easier debugging
    expect(response.headers['content-security-policy']).toBeUndefined()
  })
})

describe('PATCH /api/v1/auth/password', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('changes password and invalidates all sessions', async () => {
    // Create user with known password
    const { user } = await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    // Login to get tokens
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string
    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    // Get initial token version
    const userBefore = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    })

    // Change password
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })
      .expect(204)

    // Verify token version was incremented
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    })

    expect(userAfter?.tokenVersion).toBe((userBefore?.tokenVersion ?? 0) + 1)

    // Old refresh token should now be invalid
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(401)

    expect(refreshResponse.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('allows login with new password immediately', async () => {
    const { user } = await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    // Login to get access token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    // Change password
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })

    // Login with new password should work
    const newLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'NewP@ssword456',
      })
      .expect(200)

    expect(newLoginResponse.body).toHaveProperty('accessToken')
    expect(newLoginResponse.body.user.id).toBe(user.id)
  })

  it('prevents login with old password after change', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    // Change password
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })

    // Login with old password should fail
    const oldLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'user@example.com',
        password: 'OldP@ssword123',
      })
      .expect(401)

    expect(oldLoginResponse.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 401 when current password is incorrect', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'CorrectP@ssword123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'CorrectP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongP@ssword123',
        newPassword: 'NewP@ssword456',
      })
      .expect(401)

    expect(response.body.error.code).toBe('INVALID_PASSWORD')
    expect(response.body.error.message).toContain('Current password is incorrect')
  })

  it('returns 400 when new password is weak', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    // Try weak password (no special character)
    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'weakpassword',
      })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 401 when not authenticated', async () => {
    await request(app)
      .patch('/api/v1/auth/password')
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })
      .expect(401)
  })

  it('invalidates multiple active sessions', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    // Create two sessions (simulate two devices)
    const session1 = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const session2 = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken1 = session1.body.accessToken as string
    const cookies1 = session1.headers['set-cookie'] as unknown as string[]
    const cookies2 = session2.headers['set-cookie'] as unknown as string[]

    // Change password using session 1
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken1}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })
      .expect(204)

    // Both refresh tokens should now be invalid
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies1).expect(401)

    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies2).expect(401)
  })

  it('enforces strong password policy', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    // Test missing uppercase
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'newp@ssword123',
      })
      .expect(400)

    // Test missing lowercase
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NEWP@SSWORD123',
      })
      .expect(400)

    // Test missing number
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword',
      })
      .expect(400)

    // Test missing special character
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewPassword123',
      })
      .expect(400)

    // Test too short
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'Np@ss1',
      })
      .expect(400)
  })

  it('clears refresh token cookie on success', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })
      .expect(204)

    // Check that cookie is cleared
    const cookies = response.headers['set-cookie'] as unknown as string[]
    expect(cookies).toBeDefined()
    expect(
      Array.isArray(cookies) && cookies.some((cookie: string) => cookie.includes('refreshToken=;')),
    ).toBe(true)
  })

  it('invalidates active access token immediately after password change', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    // Login to get access token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'OldP@ssword123',
    })

    const accessToken = loginResponse.body.accessToken as string

    // Verify token works before password change
    const beforeChange = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)

    expect(beforeChange.body.email).toBe('user@example.com')

    // Change password
    await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'OldP@ssword123',
        newPassword: 'NewP@ssword456',
      })

    // Old access token should now be INVALID (token version mismatch)
    const afterChange = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401)

    expect(afterChange.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('prevents setting new password to same as current password', async () => {
    const { user } = await createTestUser({
      email: 'user@example.com',
      password: 'SecureP@ss123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'SecureP@ss123',
    })

    const accessToken = loginResponse.body.accessToken as string

    // Get initial token version
    const userBefore = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true, password: true },
    })

    // Attempt to change password to same value
    const response = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'SecureP@ss123',
        newPassword: 'SecureP@ss123', // Same password
      })
      .expect(400)

    expect(response.body.error.code).toBe('SAME_PASSWORD')
    expect(response.body.error.message).toContain('must be different')

    // Verify password and tokenVersion were NOT changed
    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true, password: true },
    })

    expect(userAfter?.password).toBe(userBefore?.password)
    expect(userAfter?.tokenVersion).toBe(userBefore?.tokenVersion)
  })
})

describe('Registration — duplicate email notification', () => {
  beforeEach(async () => {
    await clearDatabase()
    clearTestOutbox()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('sends an account-exists email on duplicate registration (enumeration-safe)', async () => {
    await createTestUser({ email: 'existing@example.com', name: 'Existing User' })
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'existing@example.com',
        password: 'P@ssword123',
        name: 'Impersonator',
      })
      .expect(400)

    const outbox = getTestOutbox()
    const notice = outbox.find((m) => m.to === 'existing@example.com')
    expect(notice?.subject).toBe('You already have a Plinth account')
  })
})

describe('POST /api/v1/auth/login — email verification gate', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('returns 403 EMAIL_NOT_VERIFIED when the account is not verified', async () => {
    await createTestUser({
      email: 'unverified@example.com',
      password: 'correctPassword',
      emailVerified: false,
    })

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unverified@example.com', password: 'correctPassword' })
      .expect(403)

    expect(response.body.error.code).toBe('EMAIL_NOT_VERIFIED')
    expect(response.headers['set-cookie']).toBeUndefined()
  })

  it('does not reveal verification status for a wrong password (returns 401, not 403)', async () => {
    await createTestUser({
      email: 'unverified@example.com',
      password: 'correctPassword',
      emailVerified: false,
    })

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unverified@example.com', password: 'wrongPassword' })
      .expect(401)

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
  })
})

describe('POST /api/v1/auth/verify-email', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  const seedUnverifiedWithToken = async (overrides?: { expiresAt?: Date; email?: string }) => {
    const token = generateVerificationToken()
    const { user } = await createTestUser({
      email: overrides?.email ?? 'verify@example.com',
      password: 'correctPassword',
      emailVerified: false,
      verificationTokenHash: sha256(token),
      verificationExpiresAt: overrides?.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    })
    return { user, token }
  }

  it('verifies the email with a valid token and enforces single use', async () => {
    const { token } = await seedUnverifiedWithToken()

    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200)

    const user = await prisma.user.findUnique({ where: { email: 'verify@example.com' } })
    expect(user?.emailVerified).toBe(true)
    expect(user?.verificationTokenHash).toBeNull()
    expect(user?.verificationExpiresAt).toBeNull()

    // Replaying the now-consumed token is rejected.
    const replay = await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(400)
    expect(replay.body.error.code).toBe('INVALID_VERIFICATION_TOKEN')
  })

  it('allows login after the email is verified', async () => {
    const { token } = await seedUnverifiedWithToken()

    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'verify@example.com', password: 'correctPassword' })
      .expect(200)
  })

  it('returns 400 INVALID_VERIFICATION_TOKEN for an unknown token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: 'ver_does_not_exist' })
      .expect(400)

    expect(response.body.error.code).toBe('INVALID_VERIFICATION_TOKEN')
  })

  it('returns 400 VERIFICATION_TOKEN_EXPIRED and leaves the account unverified', async () => {
    const { token } = await seedUnverifiedWithToken({ expiresAt: new Date(Date.now() - 1000) })

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(400)

    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_EXPIRED')

    const user = await prisma.user.findUnique({ where: { email: 'verify@example.com' } })
    expect(user?.emailVerified).toBe(false)
  })

  it('returns 400 VALIDATION_ERROR when the token is missing', async () => {
    const response = await request(app).post('/api/v1/auth/verify-email').send({}).expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/v1/auth/resend-verification', () => {
  beforeEach(async () => {
    await clearDatabase()
    clearTestOutbox()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('resends a verification email and rotates the stored token for an unverified account', async () => {
    const { user } = await createTestUser({
      email: 'unverified@example.com',
      emailVerified: false,
      verificationTokenHash: sha256('ver_old_token'),
      verificationExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    })
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'unverified@example.com' })
      .expect(200)

    const outbox = getTestOutbox()
    expect(outbox.find((m) => m.to === 'unverified@example.com')?.subject).toBe('Verify your email')

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    expect(updated?.verificationTokenHash).not.toBe(sha256('ver_old_token'))
    expect(updated?.verificationTokenHash).toBeTruthy()
  })

  it('returns a generic 200 for an unknown email and sends nothing', async () => {
    await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'nobody@example.com' })
      .expect(200)

    expect(getTestOutbox()).toHaveLength(0)
  })

  it('returns a generic 200 for an already-verified account and sends nothing', async () => {
    await createTestUser({ email: 'verified@example.com', emailVerified: true })
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'verified@example.com' })
      .expect(200)

    expect(getTestOutbox()).toHaveLength(0)
  })

  it('returns 400 VALIDATION_ERROR for an invalid email format', async () => {
    const response = await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'not-an-email' })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})
