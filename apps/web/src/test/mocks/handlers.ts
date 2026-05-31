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
]
