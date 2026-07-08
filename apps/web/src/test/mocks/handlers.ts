import { http, HttpResponse } from 'msw'

const API_URL = import.meta.env.VITE_API_URL

// Default mock handlers - tests can override these
export const handlers = [
  // Health check
  http.get(`${API_URL}/health`, () =>
    HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    }),
  ),

  http.get(`${API_URL}/api/v1/auth/me`, () =>
    HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    }),
  ),

  http.patch(`${API_URL}/api/v1/auth/password`, () => new HttpResponse(null, { status: 204 })),
]
