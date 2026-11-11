import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'

import type { Request, Response } from 'express'
import { Router } from 'express'

import { prisma } from '../lib/db.js'
import { env } from '../lib/env.js'
import { requireHealthToken } from '../middleware/health-auth.js'

const currentDir = dirname(fileURLToPath(import.meta.url))

const readVersion = (): string => {
  try {
    const pkg = JSON.parse(readFileSync(join(currentDir, '../../package.json'), 'utf-8')) as {
      version?: string
    }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// Resolve once at startup — the version is static for the process lifetime.
const VERSION = readVersion()

const toMb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 100) / 100

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw<unknown[]>`SELECT 1`

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    })
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    })
  }
})

router.get('/detailed', requireHealthToken, async (_req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage()
  const memory = {
    rssMb: toMb(memoryUsage.rss),
    heapUsedMb: toMb(memoryUsage.heapUsed),
    heapTotalMb: toMb(memoryUsage.heapTotal),
  }

  const base = {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory,
    version: VERSION,
    nodeVersion: process.version,
    environment: env.NODE_ENV,
  }

  try {
    const start = performance.now()
    await prisma.$queryRaw<unknown[]>`SELECT 1`
    const latencyMs = Math.round(performance.now() - start)

    res.json({
      status: 'ok',
      ...base,
      database: { status: 'connected', latencyMs },
    })
  } catch {
    res.status(503).json({
      status: 'error',
      ...base,
      database: { status: 'disconnected' },
    })
  }
})

export { router as healthRouter }
