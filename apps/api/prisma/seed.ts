/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import * as crypto from 'crypto'

import { TIME } from '../src/lib/constants.js'
import { logger } from '../src/lib/logger.js'

const prisma = new PrismaClient()

// Helper function to generate SHA-256 hash
function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

async function main() {
  logger.info('Seeding database', { environment: process.env.NODE_ENV })

  // Create test users
  const hashedPassword = await bcrypt.hash('P@ssword123', 10)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
    },
  })

  logger.info('Created user', { email: adminUser.email })

  const memberUser = await prisma.user.upsert({
    where: { email: 'member@example.com' },
    update: {},
    create: {
      email: 'member@example.com',
      password: hashedPassword,
      name: 'Member User',
    },
  })

  logger.info('Created user', { email: memberUser.email })

  const guestUser = await prisma.user.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      password: hashedPassword,
      name: 'Guest User',
    },
  })

  logger.info('Created user', { email: guestUser.email })

  // Create test organizations
  const acmeOrg = await prisma.organization.upsert({
    where: { slug: 'acme' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme',
    },
  })

  logger.info('Created organization', { name: acmeOrg.name, slug: acmeOrg.slug })

  const globexOrg = await prisma.organization.upsert({
    where: { slug: 'globex' },
    update: {},
    create: {
      name: 'Globex Corporation',
      slug: 'globex',
    },
  })

  logger.info('Created organization', { name: globexOrg.name, slug: globexOrg.slug })

  // Create memberships
  // Admin user: Owner of Acme, Admin of Globex
  const acmeOwnerMembership = await prisma.membership.upsert({
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

  logger.info('Created membership', {
    user: adminUser.email,
    organization: acmeOrg.slug,
    role: acmeOwnerMembership.role,
  })

  const globexAdminMembership = await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: globexOrg.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: globexOrg.id,
      role: 'ADMIN',
    },
  })

  logger.info('Created membership', {
    user: adminUser.email,
    organization: globexOrg.slug,
    role: globexAdminMembership.role,
  })

  // Member user: Member of Acme only
  const acmeMemberMembership = await prisma.membership.upsert({
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

  logger.info('Created membership', {
    user: memberUser.email,
    organization: acmeOrg.slug,
    role: acmeMemberMembership.role,
  })

  // Guest user: Owner of Globex (to test different user scenarios)
  const globexOwnerMembership = await prisma.membership.upsert({
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
      role: 'OWNER',
    },
  })

  logger.info('Created membership', {
    user: guestUser.email,
    organization: globexOrg.slug,
    role: globexOwnerMembership.role,
  })

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
      expiresAt: new Date(Date.now() + TIME.THREE_DAYS_MS),
      organizationId: acmeOrg.id,
      invitedById: adminUser.id,
    },
  })

  logger.info('Created pending invitation', {
    email: pendingInvite.email,
    organization: acmeOrg.slug,
    token: pendingInviteToken,
  })

  const expiredInviteToken = 'invite_expired_' + crypto.randomBytes(16).toString('hex')
  const expiredInvite = await prisma.invitation.upsert({
    where: { tokenHash: sha256(expiredInviteToken) },
    update: {},
    create: {
      email: 'expired@example.com',
      role: 'MEMBER',
      tokenHash: sha256(expiredInviteToken),
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - TIME.ONE_DAY_MS),
      organizationId: acmeOrg.id,
      invitedById: adminUser.id,
    },
  })

  logger.info('Created expired invitation', {
    email: expiredInvite.email,
    organization: acmeOrg.slug,
  })

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

  logger.info('Created API key', { name: prodKey.name, key: prodApiKey })

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

  logger.info('Created API key', { name: ciKey.name, key: ciApiKey })

  const revokedApiKey = 'sk_live_' + crypto.randomBytes(24).toString('hex')
  const revokedKey = await prisma.apiKey.upsert({
    where: { keyHash: sha256(revokedApiKey) },
    update: {},
    create: {
      name: 'Revoked API Key',
      keyHash: sha256(revokedApiKey),
      scopes: ['org:read', 'members:read'],
      revokedAt: new Date(Date.now() - TIME.ONE_WEEK_MS),
      organizationId: acmeOrg.id,
    },
  })

  logger.info('Created revoked API key', { name: revokedKey.name })

  logger.info('Seed completed successfully', { totalRecords: 11 })
}

main()
  .catch((e) => {
    logger.error('Seed failed', {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    })
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
