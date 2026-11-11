import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { errorHandler } from '../middleware/error-handler.js'
import { createHealthTokenGuard } from '../middleware/health-auth.js'

const HEALTH_TOKEN = 'test-health-check-token-0123456789'

interface HealthResponse {
  status: string
  database: string
  timestamp: string
}

interface DetailedHealthResponse {
  status: string
  timestamp: string
  database: { status: string; latencyMs?: number }
  uptimeSeconds: number
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number }
  version: string
  nodeVersion: string
  environment: string
}

describe('GET /health', () => {
  it('returns 200 and health status', async () => {
    const response = await request(app).get('/health').expect(200)

    expect(response.body as HealthResponse).toMatchObject({
      status: 'ok',
      database: expect.any(String) as string,
      timestamp: expect.any(String) as string,
    })
  })

  it('includes timestamp in ISO format', async () => {
    const response = await request(app).get('/health')
    const body = response.body as HealthResponse

    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('GET /health/detailed', () => {
  it('returns 200 and detailed status with a valid token', async () => {
    const response = await request(app)
      .get('/health/detailed')
      .set('Authorization', `Bearer ${HEALTH_TOKEN}`)
      .expect(200)

    const body = response.body as DetailedHealthResponse
    expect(body.status).toBe('ok')
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(body.database.status).toBe('connected')
    expect(body.database.latencyMs).toEqual(expect.any(Number))
    expect(body.uptimeSeconds).toEqual(expect.any(Number))
    expect(body.memory.rssMb).toEqual(expect.any(Number))
    expect(body.memory.heapUsedMb).toEqual(expect.any(Number))
    expect(body.memory.heapTotalMb).toEqual(expect.any(Number))
    expect(body.version).toEqual(expect.any(String))
    expect(body.nodeVersion).toEqual(expect.any(String))
    expect(body.environment).toBe('test')
  })

  it('returns 401 when the token is missing', async () => {
    const response = await request(app).get('/health/detailed').expect(401)

    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 401 when the token is wrong', async () => {
    const response = await request(app)
      .get('/health/detailed')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401)

    expect(response.body.error.code).toBe('UNAUTHENTICATED')
  })

  it('returns 404 when no token is configured (endpoint disabled)', async () => {
    const disabledApp = express()
    disabledApp.get(
      '/health/detailed',
      createHealthTokenGuard({ token: undefined }),
      (_req, res) => {
        res.json({ status: 'ok' })
      },
    )
    disabledApp.use(errorHandler)

    const response = await request(disabledApp)
      .get('/health/detailed')
      .set('Authorization', `Bearer ${HEALTH_TOKEN}`)
      .expect(404)

    expect(response.body.error.code).toBe('NOT_FOUND')
  })
})
