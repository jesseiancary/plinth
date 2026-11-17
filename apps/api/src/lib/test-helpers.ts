import { TIME } from './constants.js'
import { prisma } from './db.js'

/**
 * Clear all database tables for testing
 */
export async function clearDatabase(): Promise<void> {
  await prisma.apiKey.deleteMany()
  await prisma.invitation.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
  await prisma.pendingRegistration.deleteMany()
  await prisma.webhookEvent.deleteMany()
}

/**
 * Create a test user with a personal organization.
 *
 * Defaults to `emailVerified: true` so existing login-based tests work unchanged (mirrors
 * accounts created via the materialization path). Pass `emailVerified: false` to exercise the
 * unverified-login gate.
 */
export async function createTestUser(data?: {
  email?: string
  password?: string
  name?: string
  emailVerified?: boolean
}) {
  const { hashPassword } = await import('./password.js')
  const { generateUniqueSlug } = await import('./slug.js')

  const email = data?.email ?? 'test@example.com'
  const password = data?.password ?? 'P@ssword123'
  const name = data?.name ?? 'Test User'
  const emailVerified = data?.emailVerified ?? true

  const passwordHash = await hashPassword(password)
  const orgSlug = await generateUniqueSlug(name)

  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      name,
      emailVerified,
      memberships: {
        create: {
          role: 'OWNER',
          organization: {
            create: {
              name: `${name}'s Organization`,
              slug: orgSlug,
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

  return { user, password }
}

/**
 * Create a pending registration (a signup awaiting email verification) and return the
 * plaintext verification token. Mirrors what `POST /auth/register` records before the account
 * is materialized.
 */
export async function createTestPendingRegistration(data?: {
  email?: string
  password?: string
  name?: string
  expiresAt?: Date
}) {
  const { hashPassword } = await import('./password.js')
  const { generateVerificationToken, sha256 } = await import('./crypto.js')
  const { TIME } = await import('./constants.js')

  const email = data?.email ?? 'pending@example.com'
  const password = data?.password ?? 'P@ssword123'
  const name = data?.name ?? 'Pending User'
  const expiresAt = data?.expiresAt ?? new Date(Date.now() + TIME.ONE_DAY_MS)

  const passwordHash = await hashPassword(password)
  const token = generateVerificationToken()

  const pendingRegistration = await prisma.pendingRegistration.create({
    data: {
      email,
      name,
      passwordHash,
      verificationTokenHash: sha256(token),
      expiresAt,
    },
  })

  return { pendingRegistration, token, password }
}

/**
 * Create a test organization
 */
export async function createTestOrg(data?: { name?: string; slug?: string }) {
  const name = data?.name ?? 'Test Organization'
  const slug = data?.slug ?? 'test-org'

  return await prisma.organization.create({
    data: {
      name,
      slug,
    },
  })
}

/**
 * Create a test membership
 */
export async function createTestMembership(
  userId: string,
  organizationId: string,
  role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'MEMBER',
) {
  return await prisma.membership.create({
    data: {
      userId,
      organizationId,
      role,
    },
  })
}

/**
 * Generate an access token for testing
 */
export async function generateTestAccessToken(userId: string, email: string): Promise<string> {
  const { signAccessToken } = await import('./jwt.js')
  return signAccessToken({ userId, email, tokenVersion: 0 })
}

/**
 * Create a test invitation
 */
export async function createTestInvitation(data: {
  email: string
  organizationId: string
  invitedById: string
  role?: 'OWNER' | 'ADMIN' | 'MEMBER'
  status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
  expiresAt?: Date
}) {
  const { generateInvitationToken, sha256 } = await import('./crypto.js')

  const token = generateInvitationToken()
  const tokenHash = sha256(token)

  const expiresAt = data.expiresAt ?? new Date(Date.now() + TIME.THREE_DAYS_MS)

  const invitation = await prisma.invitation.create({
    data: {
      email: data.email,
      role: data.role ?? 'MEMBER',
      tokenHash,
      status: data.status ?? 'PENDING',
      expiresAt,
      organizationId: data.organizationId,
      invitedById: data.invitedById,
    },
  })

  return { invitation, token }
}

/**
 * Create a test API key
 */
export async function createTestApiKey(data: {
  name: string
  organizationId: string
  scopes?: string[]
  revokedAt?: Date | null
}) {
  const { generateApiKey, hashApiKey } = await import('./api-key.js')

  const key = generateApiKey()
  const keyHash = hashApiKey(key)

  const apiKey = await prisma.apiKey.create({
    data: {
      name: data.name,
      keyHash,
      scopes: data.scopes ?? ['org:read'],
      revokedAt: data.revokedAt ?? null,
      organizationId: data.organizationId,
    },
  })

  return { apiKey, key }
}
