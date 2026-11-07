import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MembersPage } from './MembersPage'

import { AuthContext } from '@/features/auth/context/AuthContext'
import { OrgProvider } from '@/features/organizations/context/OrgContext'
import { server } from '@/test/mocks/server'

const API_URL = import.meta.env.VITE_API_URL

const members = [
  {
    id: 'm-owner',
    role: 'OWNER',
    userId: 'user-owner',
    user: {
      id: 'user-owner',
      email: 'olivia@acme.test',
      name: 'Olivia Owner',
      createdAt: '2024-01-01T00:00:00Z',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'm-admin',
    role: 'ADMIN',
    userId: 'user-admin',
    user: {
      id: 'user-admin',
      email: 'adam@acme.test',
      name: 'Adam Admin',
      createdAt: '2024-01-02T00:00:00Z',
    },
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'm-member',
    role: 'MEMBER',
    userId: 'user-member',
    user: {
      id: 'user-member',
      email: 'mia@acme.test',
      name: 'Mia Member',
      createdAt: '2024-01-03T00:00:00Z',
    },
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-03T00:00:00Z',
  },
]

const meAs = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string) => ({
  id: userId,
  email: 'me@acme.test',
  name: 'Me',
  createdAt: '2024-01-01T00:00:00Z',
  memberships: [
    {
      id: `mem-${userId}`,
      role,
      organization: {
        id: 'org-1',
        name: 'Acme',
        slug: 'acme',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
  ],
})

const seedHandlers = (role: 'OWNER' | 'ADMIN' | 'MEMBER', userId: string) => {
  server.use(
    http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs(role, userId))),
    http.get(`${API_URL}/api/v1/orgs/:slug/members`, () =>
      HttpResponse.json({ data: members, nextCursor: null }),
    ),
  )
}

const authValue = {
  user: {
    id: 'user-admin',
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

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/orgs/acme/members']}>
          <OrgProvider>
            <Routes>
              <Route path="/orgs/:orgSlug/members" element={<MembersPage />} />
              <Route path="/" element={<div>Home</div>} />
            </Routes>
          </OrgProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('MembersPage', () => {
  afterEach(() => {
    server.resetHandlers()
  })

  it('renders the member list', async () => {
    seedHandlers('ADMIN', 'user-admin')
    renderPage()

    expect(await screen.findByText('Olivia Owner')).toBeInTheDocument()
    expect(screen.getByText('Mia Member')).toBeInTheDocument()
    expect(screen.getByText('adam@acme.test')).toBeInTheDocument()
  })

  it('gates actions by role for an admin', async () => {
    seedHandlers('ADMIN', 'user-admin')
    renderPage()

    await screen.findByText('Mia Member')

    // Admin cannot edit the owner's role (shown as a read-only badge) or remove them.
    const ownerRow = screen.getByText('Olivia Owner').closest('tr')
    expect(within(ownerRow as HTMLElement).queryByRole('combobox')).not.toBeInTheDocument()
    expect(within(ownerRow as HTMLElement).queryByRole('button')).not.toBeInTheDocument()

    // Own row shows a "Leave" action, not a role editor.
    const selfRow = screen.getByText('Adam Admin').closest('tr')
    expect(
      within(selfRow as HTMLElement).getByRole('button', { name: 'Leave' }),
    ).toBeInTheDocument()
    expect(within(selfRow as HTMLElement).queryByRole('combobox')).not.toBeInTheDocument()

    // Member row is editable and removable.
    const memberRow = screen.getByText('Mia Member').closest('tr')
    expect(within(memberRow as HTMLElement).getByRole('combobox')).toHaveValue('MEMBER')
    expect(
      within(memberRow as HTMLElement).getByRole('button', { name: 'Remove' }),
    ).toBeInTheDocument()
  })

  it('shows no management controls for a plain member', async () => {
    seedHandlers('MEMBER', 'user-member')
    renderPage()

    await screen.findByText('Olivia Owner')

    // No role editors anywhere.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    // Only the member's own row has an action ("Leave").
    const selfRow = screen.getByText('Mia Member').closest('tr')
    expect(
      within(selfRow as HTMLElement).getByRole('button', { name: 'Leave' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('sends a PATCH when an admin changes a role', async () => {
    seedHandlers('ADMIN', 'user-admin')
    let patchedBody: { role: string } | null = null
    server.use(
      http.patch(`${API_URL}/api/v1/orgs/:slug/members/:memberId`, async ({ request }) => {
        patchedBody = (await request.json()) as { role: string }
        return HttpResponse.json({ ...members[2], role: patchedBody.role })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Mia Member')
    const memberRow = screen.getByText('Mia Member').closest('tr') as HTMLElement
    await user.selectOptions(within(memberRow).getByRole('combobox'), 'ADMIN')

    await waitFor(() => {
      expect(patchedBody).toEqual({ role: 'ADMIN' })
    })
  })

  it('removes a member after confirmation', async () => {
    seedHandlers('ADMIN', 'user-admin')
    let deleteCalled = false
    server.use(
      http.delete(`${API_URL}/api/v1/orgs/:slug/members/:memberId`, () => {
        deleteCalled = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Mia Member')
    const memberRow = screen.getByText('Mia Member').closest('tr') as HTMLElement
    await user.click(within(memberRow).getByRole('button', { name: 'Remove' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(deleteCalled).toBe(true)
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not leak a failed role-change error into the remove dialog', async () => {
    seedHandlers('ADMIN', 'user-admin')
    server.use(
      http.patch(`${API_URL}/api/v1/orgs/:slug/members/:memberId`, () =>
        HttpResponse.json(
          { error: { code: 'CANNOT_DEMOTE_OWNER', message: 'Cannot demote the owner.' } },
          { status: 403 },
        ),
      ),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Mia Member')
    const memberRow = screen.getByText('Mia Member').closest('tr') as HTMLElement
    await user.selectOptions(within(memberRow).getByRole('combobox'), 'ADMIN')

    // The failed role change surfaces in the top banner.
    expect(await screen.findByText('Cannot demote the owner.')).toBeInTheDocument()

    // Opening the remove dialog must clear the unrelated error, not carry it in.
    await user.click(within(memberRow).getByRole('button', { name: 'Remove' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText('Cannot demote the owner.')).not.toBeInTheDocument()
  })

  it('optimistically shows the new role before the request resolves', async () => {
    seedHandlers('ADMIN', 'user-admin')
    let resolvePatch: (() => void) | undefined
    server.use(
      http.patch(`${API_URL}/api/v1/orgs/:slug/members/:memberId`, async ({ request }) => {
        const body = (await request.json()) as { role: string }
        await new Promise<void>((resolve) => {
          resolvePatch = resolve
        })
        return HttpResponse.json({ ...members[2], role: body.role })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Mia Member')
    const memberRow = screen.getByText('Mia Member').closest('tr') as HTMLElement
    const select = within(memberRow).getByRole('combobox')
    await user.selectOptions(select, 'ADMIN')

    // Reflected immediately from the optimistic cache update, before the PATCH resolves.
    await waitFor(() => {
      expect(select).toHaveValue('ADMIN')
    })

    resolvePatch?.()
  })

  it('loads more members when "Load more" is clicked', async () => {
    server.use(
      http.get(`${API_URL}/api/v1/auth/me`, () => HttpResponse.json(meAs('ADMIN', 'user-admin'))),
      http.get(`${API_URL}/api/v1/orgs/:slug/members`, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('cursor') === 'cursor-1') {
          return HttpResponse.json({ data: [members[2]], nextCursor: null })
        }
        return HttpResponse.json({ data: [members[0], members[1]], nextCursor: 'cursor-1' })
      }),
    )
    const user = userEvent.setup()
    renderPage()

    await screen.findByText('Olivia Owner')
    expect(screen.queryByText('Mia Member')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('Mia Member')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })
})
