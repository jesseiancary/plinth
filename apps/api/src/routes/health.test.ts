import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { app } from '../app.js'

interface HealthResponse {
  status: string
  database: string
  timestamp: string
}

describe('GET /health', () => {
  it('returns 200 and health status', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
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
