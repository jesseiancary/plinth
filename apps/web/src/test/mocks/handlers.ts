import { http, HttpResponse } from 'msw'

// Default mock handlers - tests can override these
export const handlers = [
  // Health check
  http.get('/health', () =>
    HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    }),
  ),

  http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date().toISOString(),
    }),
  ),

  http.patch('/api/v1/auth/password', () => new HttpResponse(null, { status: 204 })),
]
