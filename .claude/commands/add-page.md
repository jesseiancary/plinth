# Add Page Command

Scaffold a new route/page component with React Router integration, layout, and proper protection.

## Usage

```
/add-page {PageName} {route-path} [--protected]
```

**Examples:**

- `/add-page MembersPage /orgs/:orgSlug/members --protected`
- `/add-page LoginPage /login`
- `/add-page AcceptInvitationPage /invite/:token`

## What This Command Creates

```
apps/web/src/features/{domain}/
├── {PageName}.tsx                  # Page component
├── {PageName}.test.tsx             # Page integration tests
└── components/                     # Page-specific components
    └── ...
```

Plus updates to:

- `apps/web/src/lib/router.tsx` — Add route definition

## Page Template Checklist

### Routing

- [ ] Route added to `router.tsx` with correct path
- [ ] Route nested under `ProtectedRoute` if authentication required
- [ ] URL parameters typed correctly (`useParams<{ orgSlug: string }>()`)
- [ ] Search params handled if needed (`useSearchParams()`)

### Data Fetching

- [ ] Page-level queries use React Query (`useQuery` at top of component)
- [ ] Loading state displayed while data fetches (full-page skeleton or spinner)
- [ ] Error state displayed with actionable retry
- [ ] Empty state handled if no data

### Layout

- [ ] Page wrapped in proper layout component (`<Layout>`, `<DashboardLayout>`)
- [ ] Page title/heading displayed (h1)
- [ ] Breadcrumbs added if nested route
- [ ] Back button if appropriate

### Auth & Permissions

- [ ] Protected routes enforce authentication
- [ ] Role requirements checked (e.g., ADMIN-only pages)
- [ ] Tenant context validated (user is member of org)
- [ ] 403/404 handled correctly (show error, don't crash)

### SEO & Meta

- [ ] Page title set (e.g., `<title>Members - Acme Inc</title>`)
- [ ] Meta description if public page

### Testing

- [ ] Test authenticated vs unauthenticated access
- [ ] Test loading state
- [ ] Test error state (network failure, 404, 403)
- [ ] Test successful render with data
- [ ] Test user interactions (button clicks, form submission)

## Example: Protected Page with Data Fetching

```tsx
// features/members/MembersPage.tsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { components } from '@plinth/types'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { MemberList } from './components/MemberList'
import { InviteMemberButton } from './components/InviteMemberButton'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'

type Member = components['schemas']['Membership']

export function MembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', orgSlug, 'members'],
    queryFn: () => api.get<{ data: Member[] }>(`/api/v1/orgs/${orgSlug}/members`),
    enabled: !!orgSlug,
  })

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page header */}
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
              Members
            </h1>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <InviteMemberButton orgSlug={orgSlug!} />
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && (
          <ErrorMessage
            error={error}
            title="Failed to load members"
            action={
              <button
                onClick={() => window.location.reload()}
                className="text-blue-600 hover:text-blue-500"
              >
                Try again
              </button>
            }
          />
        )}

        {data && <MemberList members={data.data} orgSlug={orgSlug!} />}
      </div>
    </DashboardLayout>
  )
}
```

## Example: Public Page (No Auth Required)

```tsx
// features/invitations/AcceptInvitationPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { components } from '@plinth/types'

type Invitation = components['schemas']['Invitation']

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  // Validate token (public endpoint)
  const {
    data: invitation,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['invitations', 'validate', token],
    queryFn: () => api.get<Invitation>(`/api/v1/invitations/validate/${token}`),
    enabled: !!token,
  })

  // Accept invitation (requires auth)
  const acceptMutation = useMutation({
    mutationFn: () => api.post('/api/v1/invitations/accept', { token }),
    onSuccess: () => {
      navigate(`/orgs/${invitation?.organization.slug}`)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">This invitation link is invalid or has expired.</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">You're Invited!</h1>

        <p className="text-gray-600 mb-6">
          You've been invited to join <strong>{invitation.organization.name}</strong> as a{' '}
          <strong>{invitation.role}</strong>.
        </p>

        {!isAuthenticated ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Sign in or create an account to accept this invitation.
            </p>
            <button
              onClick={() => navigate(`/login?redirect=/invite/${token}`)}
              className="w-full btn btn-primary"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate(`/register?redirect=/invite/${token}`)}
              className="w-full btn btn-secondary"
            >
              Create Account
            </button>
          </div>
        ) : (
          <button
            onClick={() => acceptMutation.mutate()}
            disabled={acceptMutation.isPending}
            className="w-full btn btn-primary"
          >
            {acceptMutation.isPending ? 'Accepting...' : 'Accept Invitation'}
          </button>
        )}
      </div>
    </div>
  )
}
```

## Router Configuration

### Add Route Definition

Update `apps/web/src/lib/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { MembersPage } from '@/features/members/MembersPage'
import { AcceptInvitationPage } from '@/features/invitations/AcceptInvitationPage'

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/invite/:token',
    element: <AcceptInvitationPage />,
  },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <DashboardPage />,
      },
      {
        path: '/orgs/:orgSlug/members',
        element: <MembersPage />,
      },
      // ... other protected routes
    ],
  },

  // 404 catch-all
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
```

## Layout Components

### DashboardLayout (for authenticated pages)

```tsx
// shared/components/DashboardLayout.tsx
import { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
```

## Common Page Patterns

### Page with Tabs

```tsx
function OrgSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [activeTab, setActiveTab] = useState<'general' | 'danger'>('general')

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Organization Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('general')}
              className={activeTab === 'general' ? 'tab-active' : 'tab'}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('danger')}
              className={activeTab === 'danger' ? 'tab-active' : 'tab'}
            >
              Danger Zone
            </button>
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'general' && <GeneralSettings orgSlug={orgSlug!} />}
        {activeTab === 'danger' && <DangerZone orgSlug={orgSlug!} />}
      </div>
    </DashboardLayout>
  )
}
```

### Page with Modal Trigger

```tsx
function ApiKeysPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <h1 className="text-2xl font-bold">API Keys</h1>
          <button onClick={() => setShowGenerateModal(true)} className="btn btn-primary">
            Generate Key
          </button>
        </div>

        <ApiKeyList orgSlug={orgSlug!} />

        {showGenerateModal && (
          <GenerateKeyModal orgSlug={orgSlug!} onClose={() => setShowGenerateModal(false)} />
        )}
      </div>
    </DashboardLayout>
  )
}
```

## Testing Pages

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MembersPage } from './MembersPage'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderPage(initialPath = '/orgs/acme/members') {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/orgs/:orgSlug/members" element={<MembersPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('MembersPage', () => {
  it('shows loading state initially', () => {
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('displays members when data loads', async () => {
    server.use(
      http.get('/api/v1/orgs/acme/members', () => {
        return HttpResponse.json({
          data: [
            {
              id: 'mem_1',
              role: 'OWNER',
              user: { name: 'Alice', email: 'alice@example.com' },
            },
          ],
        })
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument()
    })
  })

  it('shows error state on failure', async () => {
    server.use(
      http.get('/api/v1/orgs/acme/members', () => {
        return new HttpResponse(null, { status: 500 })
      }),
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })
})
```
