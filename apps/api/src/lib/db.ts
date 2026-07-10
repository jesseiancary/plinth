import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { PrismaClient } from '../../prisma/generated/client/client.js'

/**
 * Database connection pool configuration
 * Uses PostgreSQL native driver with Prisma adapter
 */
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

/**
 * Prisma Client singleton with PostgreSQL adapter
 *
 * Prisma v7 requires explicit driver adapters (@prisma/adapter-pg)
 * and generates the client to ./prisma/generated/client
 */
const prismaClientSingleton = () =>
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

declare global {
  var prismaGlobal: PrismaClient | undefined
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

export { prisma }
