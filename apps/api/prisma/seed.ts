/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'

const prisma = new PrismaClient()

// Helper function to generate SHA-256 hash
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding database...')

  // Create test users
  const hashedPassword = await bcrypt.hash('password123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created user: ${adminUser.email}`)

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      password: hashedPassword,
      name: 'Member User',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created user: ${memberUser.email}`)

  const guestUser = await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      password: hashedPassword,
      name: 'Guest User',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created user: ${guestUser.email}`)

  // Create test organizations
  const acmeOrg = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created organization: ${acmeOrg.name}`)

  const globexOrg = await prisma.organization.upsert({
    where: { slug: 'globex' },
    update: {},
    create: {
      name: 'Globex Corporation',
      slug: 'globex',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created organization: ${globexOrg.name}`)

  // Create memberships
  const ownerMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: acmeOrg.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: acmeOrg.id,
      role: 'OWNER',
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created membership: ${adminUser.email} -> ${acmeOrg.slug} (${ownerMembership.role})`)

  const memberMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: memberUser.id,
        organizationId: acmeOrg.id,
      },
    },
    update: {},
    create: {
      userId: memberUser.id,
      organizationId: acmeOrg.id,
      role: 'MEMBER',
    },
  })

  // eslint-disable-next-line no-console
  console.log(
    `Created membership: ${memberUser.email} -> ${acmeOrg.slug} (${memberMembership.role})`,
  )

  const adminMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: guestUser.id,
        organizationId: globexOrg.id,
      },
    },
    update: {},
    create: {
      userId: guestUser.id,
      organizationId: globexOrg.id,
      role: 'ADMIN',
    },
  })

  // eslint-disable-next-line no-console
  console.log(
    `Created membership: ${guestUser.email} -> ${globexOrg.slug} (${adminMembership.role})`,
  )

  // Create sample invitations
  const pendingInviteToken = 'invite_pending_' + crypto.randomBytes(16).toString('hex')
  const pendingInvite = await prisma.invitation.upsert({
    where: { tokenHash: sha256(pendingInviteToken) },
    update: {},
    create: {
      email: 'newuser@example.com',
      role: 'MEMBER',
      tokenHash: sha256(pendingInviteToken),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
      organizationId: acmeOrg.id,
      invitedById: adminUser.id,
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created pending invitation: ${pendingInvite.email} -> ${acmeOrg.slug}`)
  // eslint-disable-next-line no-console
  console.log(`  Token (for testing): ${pendingInviteToken}`)

  const expiredInviteToken = 'invite_expired_' + crypto.randomBytes(16).toString('hex')
  const expiredInvite = await prisma.invitation.upsert({
    where: { tokenHash: sha256(expiredInviteToken) },
    update: {},
    create: {
      email: 'expired@example.com',
      role: 'MEMBER',
      tokenHash: sha256(expiredInviteToken),
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      organizationId: acmeOrg.id,
      invitedById: adminUser.id,
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created expired invitation: ${expiredInvite.email} -> ${acmeOrg.slug}`)

  // Create sample API keys
  const prodApiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex')
  const prodKey = await prisma.apiKey.upsert({
    where: { keyHash: sha256(prodApiKey) },
    update: {},
    create: {
      name: 'Production API Key',
      keyHash: sha256(prodApiKey),
      scopes: ['org:read', 'members:read', 'members:write'],
      organizationId: acmeOrg.id,
      lastUsedAt: new Date(),
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created API key: ${prodKey.name}`)
  // eslint-disable-next-line no-console
  console.log(`  Key (for testing): ${prodApiKey}`)

  const ciApiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex')
  const ciKey = await prisma.apiKey.upsert({
    where: { keyHash: sha256(ciApiKey) },
    update: {},
    create: {
      name: 'CI/CD Pipeline',
      keyHash: sha256(ciApiKey),
      scopes: ['org:read'],
      organizationId: acmeOrg.id,
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created API key: ${ciKey.name}`)
  // eslint-disable-next-line no-console
  console.log(`  Key (for testing): ${ciApiKey}`)

  const revokedApiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex')
  const revokedKey = await prisma.apiKey.upsert({
    where: { keyHash: sha256(revokedApiKey) },
    update: {},
    create: {
      name: 'Revoked API Key',
      keyHash: sha256(revokedApiKey),
      scopes: ['org:read', 'members:read'],
      revokedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      organizationId: acmeOrg.id,
    },
  })

  // eslint-disable-next-line no-console
  console.log(`Created revoked API key: ${revokedKey.name}`)

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
