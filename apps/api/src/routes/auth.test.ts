import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { prisma } from '../lib/prisma.js'
import { clearDatabase, createTestUser } from '../lib/test-helpers.js'

describe('POST /api/v1/auth/register', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  afterEach(async () => {
    await clearDatabase()
  })

  it('creates a new user and returns access token', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'New User',
    })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('accessToken')
    expect(response.body).toHaveProperty('user')
    expect(response.body.user).toMatchObject({
      email: 'newuser@example.com',
      name: 'New User',
    })
  })

  it('sets refresh token as httpOnly cookie', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'New User',
    })

    const cookies = response.headers['set-cookie']
    expect(cookies).toBeDefined()
    expect(
      Array.isArray(cookies) &&
        cookies.some((cookie: string) => cookie.startsWith('refreshToken=')),
    ).toBe(true)
  })

  it('creates personal organization for new user', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'newuser@example.com',
      password: 'securePassword123',
      name: 'New User',
    })

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
    expect(response.status).toBe(201)
  })

  it('returns 409 if email already exists', async () => {
    await createTestUser({ email: 'existing@example.com' })

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'existing@example.com',
      password: 'password123',
      name: 'Another User',
    })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('EMAIL_EXISTS')
  })

  it('returns 400 for invalid email', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'invalid-email',
      password: 'password123',
      name: 'Test User',
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 for short password', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      password: 'short',
      name: 'Test User',
    })

    expect(response.status).toBe(400)
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

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('accessToken')
    expect(response.body).toHaveProperty('user')
    expect(response.body.user.email).toBe('user@example.com')
  })

  it('sets refresh token as httpOnly cookie', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    const cookies = response.headers['set-cookie']
    expect(cookies).toBeDefined()
    expect(
      Array.isArray(cookies) &&
        cookies.some((cookie: string) => cookie.startsWith('refreshToken=')),
    ).toBe(true)
  })

  it('returns 401 for non-existent user', async () => {
    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'nonexistent@example.com',
      password: 'password123',
    })

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('returns 401 for wrong password', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'correctPassword',
    })

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'wrongPassword',
    })

    expect(response.status).toBe(401)
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
      password: 'password123',
    })

    // Login to get refresh token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    })

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    // Use refresh token to get new access token
    const refreshResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies)

    expect(refreshResponse.status).toBe(200)
    expect(refreshResponse.body).toHaveProperty('accessToken')
  })

  it('returns 401 when refresh token is missing', async () => {
    const response = await request(app).post('/api/v1/auth/refresh')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('REFRESH_TOKEN_MISSING')
  })

  it('returns 401 when refresh token is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['refreshToken=invalid-token'])

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })

  it('returns 401 when token version is outdated', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })

    // Login to get refresh token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
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
    const refreshResponse = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies)

    expect(refreshResponse.status).toBe(401)
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
      password: 'password123',
    })

    // Login
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    })

    const cookies = loginResponse.headers['set-cookie'] as unknown as string[]

    const userBefore = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    })

    // Logout
    const logoutResponse = await request(app).post('/api/v1/auth/logout').set('Cookie', cookies)

    expect(logoutResponse.status).toBe(204)

    const userAfter = await prisma.user.findUnique({
      where: { email: 'user@example.com' },
    })

    expect(userAfter!.tokenVersion).toBe(userBefore!.tokenVersion + 1)
  })

  it('clears refresh token cookie', async () => {
    await createTestUser({
      email: 'user@example.com',
      password: 'password123',
    })

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
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
    const response = await request(app).post('/api/v1/auth/logout')

    expect(response.status).toBe(204)
  })

  it('returns 204 even when refresh token is invalid', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', ['refreshToken=invalid-token'])

    expect(response.status).toBe(204)
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
      password: 'password123',
    })

    // Login to get access token
    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'password123',
    })

    const { accessToken } = loginResponse.body

    // Get current user
    const meResponse = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)

    expect(meResponse.status).toBe(200)
    expect(meResponse.body).toMatchObject({
      email: 'user@example.com',
      name: expect.any(String) as string,
    })
    expect(meResponse.body.memberships).toBeInstanceOf(Array)
    expect(meResponse.body.memberships.length).toBeGreaterThan(0)
    expect(meResponse.body.memberships[0]).toHaveProperty('role')
    expect(meResponse.body.memberships[0]).toHaveProperty('organization')
  })

  it('returns 401 when not authenticated', async () => {
    const response = await request(app).get('/api/v1/auth/me')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 with invalid token', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')

    expect(response.status).toBe(401)
    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })
})
