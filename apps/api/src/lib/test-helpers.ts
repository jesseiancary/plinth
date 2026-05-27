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
  const password = data?.password ?? 'password123'
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
