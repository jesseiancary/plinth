import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsPage } from './SettingsPage'

import { AuthContext } from '@/features/auth/context/AuthContext'
import { OrgProvider } from '@/features/organizations/context/OrgContext'
import { queryKeys } from '@/lib/query-keys'
import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const organization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
}

const members = [
  {
    id: 'mem-owner',
    userId: 'user-owner',
    role: 'OWNER',
    user: {
      id: 'user-owner',
      email: 'me@acme.test',
      name: 'Me',
      createdAt: '2024-01-01T00:00:00Z',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'mem-other',
    userId: 'user-other',
    role: 'ADMIN',
    user: {
      id: 'user-other',
      email: 'other@acme.test',
      name: 'Other Person',
      createdAt: '2024-01-01T00:00:00Z',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

const meAs = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string) => ({
  id: userId,
  email: 'me@acme.test',
  name: 'Me',
  createdAt: '2024-01-01T00:00:00Z',
  memberships: [{ id: `mem-${userId}`, role, organization }],
})

const seedHandlers = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string) => {
  server.use(
    http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs(role, userId))),
    http.get(`${API_URL}/api/v1/orgs/:slug`, ({ params }) =>
      HttpResponse.json({ ...organization, slug: params['slug'] as string }),
    ),
  )
}

const authValue = {
  user: {
    id: 'user-owner',
    email: 'me@acme.test',
    name: 'Me',
    createdAt: '2024-01-01T00:00:00Z',
  },
  accessToken: 'test-token',
  isInitializing: false,
  login: vi.fn(),
  logout: vi.fn(),
  isAuthenticated: true,
}

function LocationDisplay() {
  const location = useLocation()
  return <div>path:{location.pathname}</div>
}

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/orgs/acme/settings']}>
          <OrgProvider>
            <Routes>
              <Route path="/orgs/:orgSlug/settings" element={<SettingsPage />} />
              <Route path="/" element={<div>Dashboard home</div>} />
            </Routes>
            <LocationDisplay />
          </OrgProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
  return queryClient
}

describe('SettingsPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('prefills the form with the organization name and slug for an admin', async () => {
    seedHandlers('ADMIN', 'user-admin')
    renderPage()

    expect(await screen.findByDisplayValue('Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('acme')).toBeInTheDocument()
  })

  it('renames the organization name and shows a saved confirmation', async () => {
    seedHandlers('ADMIN', 'user-admin')
    let patchedBody: { name?: string; slug?: string } | undefined
    server.use(
      http.patch(`${API_URL}/api/v1/orgs/:slug`, async ({ request, params }) => {
        patchedBody = (await request.json()) as { name?: string; slug?: string }
        return HttpResponse.json({
          ...organization,
          name: patchedBody.name ?? organization.name,
          slug: patchedBody.slug ?? (params['slug'] as string),
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    const nameInput = await screen.findByLabelText('Organization Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Acme Corp')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Organization updated.')).toBeInTheDocument()
    await waitFor(() => {
      expect(patchedBody).toEqual({ name: 'Acme Corp' })
    })
  })

  it('preserves unsaved form edits across a background refetch', async () => {
    seedHandlers('ADMIN', 'user-admin')
    const user = userEvent.setup()
    const queryClient = renderPage()

    const nameInput = await screen.findByLabelText('Organization Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Unsaved Draft')

    // A refetch driven by an unrelated invalidation must not clobber the edit.
    await act(async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.organizations.detail('acme'),
      })
    })

    expect(screen.getByLabelText('Organization Name')).toHaveValue('Unsaved Draft')
  })

  it('surfaces a slug conflict error and does not navigate', async () => {
    seedHandlers('ADMIN', 'user-admin')
    server.use(
      http.patch(`${API_URL}/api/v1/orgs/:slug`, () =>
        HttpResponse.json(
          { error: { code: 'ORG_SLUG_EXISTS', message: 'Organization slug already exists' } },
          { status: 409 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    const slugInput = await screen.findByLabelText('Organization Slug')
    await user.clear(slugInput)
    await user.type(slugInput, 'taken-slug')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('Organization slug already exists')).toBeInTheDocument()
    expect(screen.getByText('path:/orgs/acme/settings')).toBeInTheDocument()
  })

  it('navigates to the new slug URL after a slug change', async () => {
    seedHandlers('ADMIN', 'user-admin')
    server.use(
      http.patch(`${API_URL}/api/v1/orgs/:slug`, async ({ request }) => {
        const body = (await request.json()) as { name?: string; slug?: string }
        return HttpResponse.json({ ...organization, slug: body.slug ?? organization.slug })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    const slugInput = await screen.findByLabelText('Organization Slug')
    await user.clear(slugInput)
    await user.type(slugInput, 'acme-renamed')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(await screen.findByText('path:/orgs/acme-renamed/settings')).toBeInTheDocument()
  })

  it('shows the danger zone only to an owner', async () => {
    seedHandlers('OWNER', 'user-owner')
    renderPage()

    expect(await screen.findByRole('button', { name: 'Delete Organization' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transfer Ownership' })).toBeInTheDocument()
  })

  it('hides the danger zone from a non-owner admin', async () => {
    seedHandlers('ADMIN', 'user-admin')
    renderPage()

    // Rename form is present for admins...
    expect(await screen.findByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
    // ...but the owner-only danger zone is not.
    expect(screen.queryByRole('button', { name: 'Delete Organization' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transfer Ownership' })).not.toBeInTheDocument()
  })

  it('shows only read-only details to a plain member', async () => {
    seedHandlers('MEMBER', 'user-member')
    renderPage()

    expect(await screen.findByText('Organization Details')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
    expect(screen.queryByText('General Information')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Organization' })).not.toBeInTheDocument()
  })

  it('deletes the organization after typed confirmation and returns home', async () => {
    seedHandlers('OWNER', 'user-owner')
    let deleteCalled = false
    server.use(
      http.delete(`${API_URL}/api/v1/orgs/:slug`, () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Delete Organization' }))

    const dialog = await screen.findByRole('dialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete Organization' })
    expect(confirmButton).toBeDisabled()

    await user.type(within(dialog).getByLabelText('Type "acme" to confirm'), 'acme')
    expect(confirmButton).toBeEnabled()
    await user.click(confirmButton)

    await waitFor(() => {
      expect(deleteCalled).toBe(true)
    })
    expect(await screen.findByText('Dashboard home')).toBeInTheDocument()
  })

  it('transfers ownership to a selected member', async () => {
    seedHandlers('OWNER', 'user-owner')
    let transferBody: { newOwnerId: string } | undefined
    server.use(
      http.get(`${API_URL}/api/v1/orgs/:slug/members`, () =>
        HttpResponse.json({ data: members, nextCursor: null }),
      ),
      http.post(`${API_URL}/api/v1/orgs/:slug/transfer-ownership`, async ({ request }) => {
        transferBody = (await request.json()) as { newOwnerId: string }
        return HttpResponse.json({
          organization,
          newOwner: {
            id: 'mem-other',
            userId: transferBody.newOwnerId,
            role: 'OWNER',
            updatedAt: '2024-01-03T00:00:00Z',
          },
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Transfer Ownership' }))

    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('New owner'), 'user-other')
    await user.click(within(dialog).getByRole('button', { name: 'Transfer ownership' }))

    await waitFor(() => {
      expect(transferBody).toEqual({ newOwnerId: 'user-other' })
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
