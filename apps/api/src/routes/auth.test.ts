import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { sha256 } from '../lib/crypto.js'
import { prisma } from '../lib/db.js'
import { clearTestOutbox, getTestOutbox } from '../lib/email.js'
import {
  clearDatabase,
  createTestPendingRegistration,
  createTestUser,
  createTestUserWithResetToken,
} from '../lib/test-helpers.js'

const extractVerificationToken = (html: string | undefined): string | undefined =>
  html?.match(/verify-email\?token=([a-z0-9_]+)/i)?.[1]

const extractResetToken = (html: string | undefined): string | undefined =>
  html?.match(/reset-password\?token=([a-z0-9_]+)/i)?.[1]

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('records a pending registration without creating a user or a session', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        name: 'New User',
      })
      .expect(201)

    // No account exists yet; the account is materialized on verification. The generic
    // acknowledgement carries no user object and no session.
    expect(response.body).not.toHaveProperty('accessToken')
    expect(response.body).not.toHaveProperty('user')
    expect(response.body).toHaveProperty('message')

    const user = await prisma.user.findUnique({ where: { email: 'newuser@example.com' } })
    expect(user).toBeNull()

    const pending = await prisma.pendingRegistration.findFirst({
      where: { email: 'newuser@example.com' },
    })
    expect(pending).not.toBeNull()
    expect(pending?.name).toBe('New User')
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

  it('sends a verification email with a link matching the stored pending token hash', async () => {
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

    // Extract the token from the emailed link and confirm it hashes to the pending row.
    const token = extractVerificationToken(verifyEmail?.html)
    expect(token).toBeTruthy()

    const pending = await prisma.pendingRegistration.findFirst({
      where: { email: 'newuser@example.com' },
    })
    expect(pending?.verificationTokenHash).toBe(sha256(token as string))
    expect(pending?.expiresAt).toBeTruthy()
  })

  it('re-registering the same email adds a coexisting pending row without invalidating the first link', async () => {
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newuser@example.com', password: 'FirstP@ss123', name: 'First Attempt' })
      .expect(201)

    const firstToken = extractVerificationToken(
      getTestOutbox().find((m) => m.to === 'newuser@example.com')?.html,
    )
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newuser@example.com', password: 'SecondP@ss123', name: 'Second Attempt' })
      .expect(201)

    // Both submissions coexist — neither can destroy the other's in-flight verification link.
    const pendings = await prisma.pendingRegistration.findMany({
      where: { email: 'newuser@example.com' },
    })
    expect(pendings).toHaveLength(2)

    // The first (own) link still works and materializes the first submitted password.
    await request(app).post('/api/v1/auth/verify-email').send({ token: firstToken }).expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@example.com', password: 'FirstP@ss123' })
      .expect(200)

    // Once the account exists, the second (now redundant) link collapses to already-verified
    // and is consumed — it does not overwrite the materialized password.
    const secondToken = extractVerificationToken(
      getTestOutbox().find((m) => m.to === 'newuser@example.com')?.html,
    )
    await request(app).post('/api/v1/auth/verify-email').send({ token: secondToken }).expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@example.com', password: 'SecondP@ss123' })
      .expect(401)
  })

  it('re-registering gives a fresh working link (recovers from a lost verification email)', async () => {
    // The original dead-end: user registers, never receives the email, re-registers. The new
    // link must work and materialize their account.
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newuser@example.com', password: 'FreshP@ss123', name: 'Fresh User' })
      .expect(201)
    clearTestOutbox()

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'newuser@example.com', password: 'FreshP@ss123', name: 'Fresh User' })
      .expect(201)

    const token = extractVerificationToken(
      getTestOutbox().find((m) => m.to === 'newuser@example.com')?.html,
    )
    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'newuser@example.com', password: 'FreshP@ss123' })
      .expect(200)
  })

  it('returns 400 with generic error if a verified account already exists (prevents enumeration)', async () => {
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

  it('does not create a pending registration for an already-verified account', async () => {
    await createTestUser({ email: 'existing@example.com' })

    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'existing@example.com', password: 'P@ssword123', name: 'Another User' })
      .expect(400)

    const pending = await prisma.pendingRegistration.findFirst({
      where: { email: 'existing@example.com' },
    })
    expect(pending).toBeNull()
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

  it('materializes the user, personal org, and OWNER membership, and enforces single use', async () => {
    const { token } = await createTestPendingRegistration({
      email: 'verify@example.com',
      password: 'correctPassword',
      name: 'Verify User',
    })

    await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(200)

    const user = await prisma.user.findUnique({
      where: { email: 'verify@example.com' },
      include: { memberships: { include: { organization: true } } },
    })
    expect(user?.emailVerified).toBe(true)
    expect(user?.memberships).toHaveLength(1)
    expect(user?.memberships[0]?.role).toBe('OWNER')
    expect(user?.memberships[0]?.organization.name).toContain('Verify User')

    // The pending row is consumed (single-use).
    const pending = await prisma.pendingRegistration.findFirst({
      where: { email: 'verify@example.com' },
    })
    expect(pending).toBeNull()

    // Replaying the now-consumed token is rejected.
    const replay = await request(app).post('/api/v1/auth/verify-email').send({ token }).expect(400)
    expect(replay.body.error.code).toBe('INVALID_VERIFICATION_TOKEN')
  })

  it('allows login with the submitted password after verification', async () => {
    const { token } = await createTestPendingRegistration({
      email: 'verify@example.com',
      password: 'correctPassword',
    })

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

  it('returns 400 VERIFICATION_TOKEN_EXPIRED, creates no user, and drops the pending row', async () => {
    const { token } = await createTestPendingRegistration({
      email: 'verify@example.com',
      expiresAt: new Date(Date.now() - 1000),
    })

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(400)

    expect(response.body.error.code).toBe('VERIFICATION_TOKEN_EXPIRED')

    const user = await prisma.user.findUnique({ where: { email: 'verify@example.com' } })
    expect(user).toBeNull()

    const pending = await prisma.pendingRegistration.findFirst({
      where: { email: 'verify@example.com' },
    })
    expect(pending).toBeNull()
  })

  it('collapses to an "already verified" response when the account already exists for the email', async () => {
    // Simulate a double-submit: the account was already materialized, but a stale pending row
    // for the same email is verified again. It must not collide — treat as already-verified, and
    // the message must NOT imply this link's just-submitted credentials were applied.
    const { token } = await createTestPendingRegistration({ email: 'verify@example.com' })
    await createTestUser({ email: 'verify@example.com', emailVerified: true })

    const response = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token })
      .expect(200)
    expect(response.body.message).toBe('This email is already verified. You can log in.')

    const pending = await prisma.pendingRegistration.findFirst({
      where: { email: 'verify@example.com' },
    })
    expect(pending).toBeNull()
  })

  it('returns 400 VALIDATION_ERROR when the token is missing', async () => {
    const response = await request(app).post('/api/v1/auth/verify-email').send({}).expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('POST /api/v1/auth/resend-verification (removed)', () => {
  // Resend was removed: an email-only resend cannot identify the real inbox owner's pending row
  // under the coexist model, so it could hand a requester an attacker's link. Recovery is
  // re-registration (self-authenticating), covered by the register tests above.
  it('no longer exists (404)', async () => {
    await request(app)
      .post('/api/v1/auth/resend-verification')
      .send({ email: 'someone@example.com' })
      .expect(404)
  })
})

describe('Registration — email squatting / account takeover regression', () => {
  beforeEach(async () => {
    await clearDatabase()
    clearTestOutbox()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  // The inbox owner, clicking the link for the password THEY submitted, must always get their
  // own credentials materialized — regardless of who else registered the address or in what
  // order. A third party's registration can neither invalidate the owner's link nor substitute
  // their own password into it. Both attacker-vs-victim orderings are covered.

  it('attacker registers first: the victim’s own link still materializes the victim’s password', async () => {
    const email = 'victim@example.com'

    // 1. Attacker registers the victim's email first, with a password they control.
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Attacker@123', name: 'Attacker' })
      .expect(201)
    const attackerToken = extractVerificationToken(
      getTestOutbox().find((m) => m.to === email)?.html,
    )
    clearTestOutbox()

    // 2. The victim registers the same address with their own password (a coexisting row).
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Victim@12345', name: 'Victim' })
      .expect(201)
    const victimToken = extractVerificationToken(getTestOutbox().find((m) => m.to === email)?.html)

    // 3. The victim verifies with their OWN link → account created with the victim's password.
    await request(app).post('/api/v1/auth/verify-email').send({ token: victimToken }).expect(200)

    // The attacker's password must NOT work; the victim's must.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Attacker@123' })
      .expect(401)
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Victim@12345' })
      .expect(200)

    // 4. The attacker's leftover link cannot take over the now-verified account — it collapses
    //    to already-verified without changing the password.
    await request(app).post('/api/v1/auth/verify-email').send({ token: attackerToken }).expect(200)
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Attacker@123' })
      .expect(401)
  })

  it('victim registers first: a later attacker registration cannot hijack the victim’s in-flight link', async () => {
    const email = 'victim@example.com'

    // 1. The victim legitimately registers and is waiting for their verification email.
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Victim@12345', name: 'Victim' })
      .expect(201)
    const victimToken = extractVerificationToken(getTestOutbox().find((m) => m.to === email)?.html)
    clearTestOutbox()

    // 2. The attacker re-registers the same address with their own password and name. This must
    //    NOT delete the victim's row or replace the credentials their link points at.
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email, password: 'Attacker@123', name: 'Victim' })
      .expect(201)

    // 3. The victim clicks the link they were waiting for → their OWN password is materialized.
    await request(app).post('/api/v1/auth/verify-email').send({ token: victimToken }).expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Attacker@123' })
      .expect(401)
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Victim@12345' })
      .expect(200)
  })

  it('a pending-only email is never loginable until its token is verified', async () => {
    // Absent any click, a pending row never becomes a User — there is nothing to log into.
    await createTestPendingRegistration({
      email: 'squat@example.com',
      password: 'Attacker@123',
      name: 'Attacker',
    })

    expect(await prisma.user.findUnique({ where: { email: 'squat@example.com' } })).toBeNull()

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'squat@example.com', password: 'Attacker@123' })
      .expect(401)
  })
})

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(async () => {
    await clearDatabase()
    clearTestOutbox()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('persists a reset token and emails a link when the email maps to a real account', async () => {
    const { user } = await createTestUser({ email: 'reset@example.com', name: 'Reset User' })

    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200)

    expect(response.body).toHaveProperty('message')

    // A single-use reset token (hash + expiry) is persisted on the user.
    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetTokenHash: true, passwordResetExpiresAt: true },
    })
    expect(updated?.passwordResetTokenHash).not.toBeNull()
    expect(updated?.passwordResetExpiresAt).not.toBeNull()
    expect(updated?.passwordResetExpiresAt?.getTime()).toBeGreaterThan(Date.now())

    // The emailed link carries the plaintext token whose hash was stored.
    const token = extractResetToken(getTestOutbox().find((m) => m.to === 'reset@example.com')?.html)
    expect(token).toBeDefined()
    expect(updated?.passwordResetTokenHash).toBe(sha256(token as string))
  })

  it('returns an identical generic 200 and sends no email for an unknown address', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200)

    expect(response.body).toHaveProperty('message')
    // Enumeration-safe: no reset email is dispatched for a non-existent account.
    expect(getTestOutbox().find((m) => m.to === 'nobody@example.com')).toBeUndefined()
  })

  it('returns the same message body for known and unknown emails', async () => {
    await createTestUser({ email: 'known@example.com' })

    const known = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'known@example.com' })
      .expect(200)

    const unknown = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'unknown@example.com' })
      .expect(200)

    expect(known.body).toEqual(unknown.body)
  })

  it('returns 400 VALIDATION_ERROR for a malformed email', async () => {
    const response = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('re-issuing overwrites the prior in-flight reset token', async () => {
    const { user } = await createTestUser({ email: 'reset@example.com' })

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200)
    const first = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetTokenHash: true },
    })

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(200)
    const second = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetTokenHash: true },
    })

    expect(second?.passwordResetTokenHash).not.toBe(first?.passwordResetTokenHash)
  })
})

describe('POST /api/v1/auth/reset-password', () => {
  beforeEach(async () => {
    await clearDatabase()
    clearTestOutbox()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('sets the new password, clears the token, and lets the user log in', async () => {
    const { user, token } = await createTestUserWithResetToken({
      email: 'reset@example.com',
      password: 'OldP@ssword123',
    })

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'NewP@ssword456' })
      .expect(200)

    // Reset fields are cleared (single-use).
    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetTokenHash: true, passwordResetExpiresAt: true },
    })
    expect(updated?.passwordResetTokenHash).toBeNull()
    expect(updated?.passwordResetExpiresAt).toBeNull()

    // New password works; old password does not.
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'NewP@ssword456' })
      .expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'OldP@ssword123' })
      .expect(401)
  })

  it('invalidates existing sessions by incrementing tokenVersion', async () => {
    const { user, token, password } = await createTestUserWithResetToken({
      email: 'reset@example.com',
    })

    // Establish a session before the reset.
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password })
      .expect(200)
    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    })

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'NewP@ssword456' })
      .expect(200)

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { tokenVersion: true },
    })
    expect(after?.tokenVersion).toBe((before?.tokenVersion ?? 0) + 1)

    // The pre-reset refresh token is now rejected.
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookies)
      .expect(401)
    expect(refreshResponse.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('returns 400 INVALID_RESET_TOKEN for an unknown token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: 'rst_does_not_exist', newPassword: 'NewP@ssword456' })
      .expect(400)

    expect(response.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('returns 400 RESET_TOKEN_EXPIRED and clears the dead token', async () => {
    const { user, token } = await createTestUserWithResetToken({
      email: 'reset@example.com',
      expiresAt: new Date(Date.now() - 1000),
    })

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'NewP@ssword456' })
      .expect(400)

    expect(response.body.error.code).toBe('RESET_TOKEN_EXPIRED')

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordResetTokenHash: true, passwordResetExpiresAt: true },
    })
    expect(updated?.passwordResetTokenHash).toBeNull()
    expect(updated?.passwordResetExpiresAt).toBeNull()
  })

  it('enforces single use: a consumed token cannot be replayed', async () => {
    const { token } = await createTestUserWithResetToken({ email: 'reset@example.com' })

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'NewP@ssword456' })
      .expect(200)

    const replay = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'AnotherP@ss789' })
      .expect(400)
    expect(replay.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('enforces single use under concurrent requests carrying the same token', async () => {
    // TOCTOU guard: two requests with the same still-valid token race. Consumption is an atomic
    // guarded update, so exactly one wins (200) and the other updates zero rows (400) — they can
    // never both succeed regardless of interleaving.
    const { token } = await createTestUserWithResetToken({ email: 'reset@example.com' })

    const [first, second] = await Promise.all([
      request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword: 'NewP@ssword456' }),
      request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token, newPassword: 'AnotherP@ss789' }),
    ])

    const statuses = [first.status, second.status].sort((a, b) => a - b)
    expect(statuses).toEqual([200, 400])
  })

  it('returns 400 VALIDATION_ERROR when the new password is too weak', async () => {
    const { token } = await createTestUserWithResetToken({ email: 'reset@example.com' })

    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'weak' })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 VALIDATION_ERROR when the token is missing', async () => {
    const response = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ newPassword: 'NewP@ssword456' })
      .expect(400)

    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('Password reset — enumeration-safe end-to-end', () => {
  beforeEach(async () => {
    await clearDatabase()
    clearTestOutbox()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('drives the full forgot → email → reset → login flow', async () => {
    await createTestUser({ email: 'flow@example.com', password: 'OldP@ssword123' })

    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'flow@example.com' })
      .expect(200)

    const token = extractResetToken(getTestOutbox().find((m) => m.to === 'flow@example.com')?.html)
    expect(token).toBeDefined()

    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'BrandNewP@ss1' })
      .expect(200)

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'flow@example.com', password: 'BrandNewP@ss1' })
      .expect(200)
  })
})
