/**
 * Prisma Configuration (v7+)
 *
 * In Prisma v7, the DATABASE_URL is no longer specified in schema.prisma.
 * This file provides the connection URL for CLI commands (migrate, db push, etc.)
 *
 * Runtime database connections use the adapter pattern in src/lib/db.ts
 *
 * @see https://pris.ly/d/config-datasource
 * @see https://pris.ly/d/prisma7-client-config
 */

import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: env('DATABASE_URL'),
  },
})
