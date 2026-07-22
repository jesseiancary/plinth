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

import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    // Use process.env directly instead of env() helper to avoid throwing during build
    // The env() helper validates at config load time, but build/typecheck don't need DB access
    url: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/placeholder',
  },
})
