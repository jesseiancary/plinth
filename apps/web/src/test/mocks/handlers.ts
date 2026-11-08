import { http, HttpResponse } from 'msw'

const API_URL = import.meta.env.VITE_API_URL

// Default mock handlers - tests can override these with server.use(...)
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

  // Organization detail + settings
  http.get<{ slug: string }>(`${API_URL}/api/v1/orgs/:slug`, ({ params }) =>
    HttpResponse.json({
      id: 'org-id',
      name: 'Acme',
      slug: params.slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  ),

  http.patch<{ slug: string }>(`${API_URL}/api/v1/orgs/:slug`, async ({ request, params }) => {
    const body = (await request.json()) as { name?: string; slug?: string }
    return HttpResponse.json({
      id: 'org-id',
      name: body.name ?? 'Acme',
      slug: body.slug ?? params.slug,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }),

  http.delete(`${API_URL}/api/v1/orgs/:slug`, () => new HttpResponse(null, { status: 204 })),

  http.post<{ slug: string }>(
    `${API_URL}/api/v1/orgs/:slug/transfer-ownership`,
    async ({ request, params }) => {
      const body = (await request.json()) as { newOwnerId: string }
      return HttpResponse.json({
        organization: {
          id: 'org-id',
          name: 'Acme',
          slug: params.slug,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        newOwner: {
          id: 'membership-id',
          userId: body.newOwnerId,
          role: 'OWNER',
          updatedAt: new Date().toISOString(),
        },
      })
    },
  ),

  // Members
  http.get(`${API_URL}/api/v1/orgs/:slug/members`, () =>
    HttpResponse.json({ data: [], nextCursor: null }),
  ),

  http.patch<{ slug: string; memberId: string }>(
    `${API_URL}/api/v1/orgs/:slug/members/:memberId`,
    async ({ request, params }) => {
      const body = (await request.json()) as { role: string }
      return HttpResponse.json({
        id: params.memberId,
        role: body.role,
        userId: 'member-user-id',
        user: {
          id: 'member-user-id',
          email: 'member@example.com',
          name: 'Member',
          createdAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    },
  ),

  http.delete(
    `${API_URL}/api/v1/orgs/:slug/members/:memberId`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Invitations
  http.get(`${API_URL}/api/v1/orgs/:slug/invitations`, () =>
    HttpResponse.json({ data: [], nextCursor: null }),
  ),

  http.post(`${API_URL}/api/v1/orgs/:slug/invitations`, async ({ request }) => {
    const body = (await request.json()) as { email: string; role: string }
    return HttpResponse.json(
      {
        invitation: {
          id: 'invitation-id',
          email: body.email,
          role: body.role,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
        token: 'inv_test_token',
      },
      { status: 201 },
    )
  }),

  http.delete(
    `${API_URL}/api/v1/orgs/:slug/invitations/:invitationId`,
    () => new HttpResponse(null, { status: 204 }),
  ),

  // Public invitation validation + acceptance (accept-invite page)
  http.get(`${API_URL}/api/v1/invitations/validate/:token`, () =>
    HttpResponse.json({
      email: 'invitee@example.com',
      role: 'MEMBER',
      organization: { name: 'Acme', slug: 'acme' },
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    }),
  ),

  http.post(`${API_URL}/api/v1/invitations/accept`, () =>
    HttpResponse.json(
      {
        membership: {
          id: 'membership-id',
          role: 'MEMBER',
          userId: 'test-user-id',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        organization: {
          id: 'org-id',
          name: 'Acme',
          slug: 'acme',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    ),
  ),

  // API keys
  http.get(`${API_URL}/api/v1/orgs/:slug/api-keys`, () =>
    HttpResponse.json({ data: [], nextCursor: null }),
  ),

  http.post(`${API_URL}/api/v1/orgs/:slug/api-keys`, async ({ request }) => {
    const body = (await request.json()) as { name: string; scopes: string[] }
    return HttpResponse.json(
      {
        id: 'api-key-id',
        name: body.name,
        key: 'sk_live_test_key',
        scopes: body.scopes,
        createdAt: new Date().toISOString(),
      },
      { status: 201 },
    )
  }),

  http.delete(
    `${API_URL}/api/v1/orgs/:slug/api-keys/:keyId`,
    () => new HttpResponse(null, { status: 204 }),
  ),
]
