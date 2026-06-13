import { prisma } from './prisma.js'

/**
 * Clear all database tables for testing
 */
export async function clearDatabase(): Promise<void> {
  await prisma.apiKey.deleteMany()
  await prisma.invitation.deleteMany()
  await prisma.membership.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
  await prisma.webhookEvent.deleteMany()
}

/**
 * Create a test user with a personal organization
 */
export async function createTestUser(data?: { email?: string; password?: string; name?: string }) {
  const { hashPassword } = await import('./password.js')
  const { generateUniqueSlug } = await import('./slug.js')

  const email = data?.email ?? 'test@example.com'
  const password = data?.password ?? 'P@ssword123'
  const name = data?.name ?? 'Test User'

  const passwordHash = await hashPassword(password)
  const orgSlug = await generateUniqueSlug(name)

  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      name,
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

  const expiresAt = data.expiresAt ?? new Date(Date.now() + 72 * 60 * 60 * 1000)

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
