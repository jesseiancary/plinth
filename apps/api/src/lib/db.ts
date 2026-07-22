import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { PrismaClient } from '../../prisma/generated/client/client.js'

import { env } from './env.js'

/**
 * Database connection pool configuration
 * Uses PostgreSQL native driver with Prisma adapter
 */
const connectionString = env.DATABASE_URL

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
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

declare global {
  var prismaGlobal: PrismaClient | undefined
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

export { prisma }
