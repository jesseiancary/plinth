import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding database...')

  // Create a test user
  const hashedPassword = await bcrypt.hash('password123', 10)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created user: ${user.email}`)

  // Create a test organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created organization: ${org.name}`)

  // Create membership (admin is owner of acme)
  const membership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: org.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      organizationId: org.id,
      role: 'OWNER',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created membership: ${user.email} -> ${org.slug} (${membership.role})`)

  // eslint-disable-next-line no-console
  console.log('✅ Seed completed!')
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
