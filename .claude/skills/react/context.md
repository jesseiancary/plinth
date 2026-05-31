# React Skill Context

This skill is auto-loaded when working on React components (`.tsx` files) or frontend development tasks.

## Project Structure

The `apps/web` frontend follows **feature-based organization** (NOT technical type grouping):

```
apps/web/src/
├── features/               # Feature-based modules
│   ├── auth/
│   │   ├── components/     # Auth-specific components
│   │   │   ├── LoginForm.tsx
│   │   │   ├── LoginForm.test.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── RegisterForm.test.tsx
│   │   ├── hooks/          # Auth-specific hooks
│   │   │   ├── useAuth.ts
│   │   │   └── useLogout.ts
│   │   ├── types.ts        # Auth-specific types
│   │   ├── LoginPage.tsx   # Page component
│   │   └── RegisterPage.tsx
│   ├── organizations/
│   │   ├── components/
│   │   │   ├── OrgSwitcher.tsx
│   │   │   ├── CreateOrgModal.tsx
│   │   │   └── DeleteOrgDialog.tsx
│   │   ├── hooks/
│   │   │   ├── useOrganizations.ts
│   │   │   ├── useActiveOrg.ts
│   │   │   └── useOrgMutations.ts
│   │   ├── types.ts
│   │   ├── OrganizationsPage.tsx
│   │   └── OrgSettingsPage.tsx
│   ├── members/
│   │   ├── components/
│   │   │   ├── MemberList.tsx
│   │   │   ├── InviteMemberModal.tsx
│   │   │   └── RoleBadge.tsx
│   │   ├── hooks/
│   │   │   ├── useMembers.ts
│   │   │   └── useMemberMutations.ts
│   │   ├── types.ts
│   │   └── MembersPage.tsx
│   ├── invitations/
│   │   ├── components/
│   │   │   ├── InvitationDetails.tsx
│   │   │   └── InvitationExpired.tsx
│   │   ├── hooks/
│   │   │   └── useInvitation.ts
│   │   └── AcceptInvitationPage.tsx
│   └── api-keys/
│       ├── components/
│       │   ├── ApiKeyList.tsx
│       │   ├── GenerateKeyModal.tsx
│       │   └── ShowKeyOnceModal.tsx
│       ├── hooks/
│       │   └── useApiKeys.ts
│       ├── types.ts
│       └── ApiKeysPage.tsx
├── shared/                 # Shared UI components and utilities
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── EmptyState.tsx
│   │   └── Layout.tsx
│   ├── hooks/
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   └── useDisclosure.ts
│   └── utils/
│       ├── formatters.ts
│       └── validators.ts
├── lib/                    # Core infrastructure
│   ├── api-client.ts       # Axios instance with interceptors
│   ├── query-client.ts     # TanStack Query configuration
│   └── router.tsx          # React Router configuration
├── App.tsx                 # Root component
└── main.tsx                # Entry point
```

**Why feature-based?**

- Features are self-contained and easier to reason about
- Easier to delete a feature (delete one folder)
- Scales better than `/components`, `/hooks`, `/utils` at root
- Mirrors how developers think about the product

## State Management Strategy

### Server State → TanStack Query (React Query)

**NEVER store API response data in `useState` or Context** — React Query handles caching, refetching, and invalidation.

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

// ✅ GOOD - Server state in React Query
function MemberList({ orgSlug }: { orgSlug: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', orgSlug, 'members'],
    queryFn: () => api.get(`/api/v1/orgs/${orgSlug}/members`),
  })

  // ...
}

// ❌ BAD - Server state in useState
function MemberList({ orgSlug }: { orgSlug: string }) {
  const [members, setMembers] = useState([])

  useEffect(() => {
    fetch(`/api/v1/orgs/${orgSlug}/members`)
      .then((res) => res.json())
      .then((data) => setMembers(data))
  }, [orgSlug])

  // ...
}
```

### Global Client State → React Context

Use Context for:

- Authentication state (current user, access token)
- Active organization selection (which org is active in nav)
- Theme (light/dark mode)
- Global UI state (sidebar open/closed)

**Example: Auth Context**

```tsx
// features/auth/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { components } from '@plinth/types'

type User = components['schemas']['User']

interface AuthContextValue {
  user: User | null
  accessToken: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem('accessToken'),
  )

  const login = (token: string, user: User) => {
    setAccessToken(token)
    setUser(user)
    localStorage.setItem('accessToken', token)
  }

  const logout = () => {
    setAccessToken(null)
    setUser(null)
    localStorage.removeItem('accessToken')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        logout,
        isAuthenticated: !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### Local Component State → useState / useReducer

Use for:

- Form input values (controlled components)
- Modal open/closed state
- Accordion expanded/collapsed
- Client-side filtering/sorting (before sending to API)

```tsx
function InviteMemberModal() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER')
  const [isOpen, setIsOpen] = useState(false)

  // ...
}
```

### URL State → React Router

Use for:

- Current page/route
- Search filters (query params)
- Pagination cursor
- Selected resource ID

```tsx
import { useParams, useSearchParams } from 'react-router-dom'

function MembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const cursor = searchParams.get('cursor') ?? undefined
  const search = searchParams.get('search') ?? ''

  // ...
}
```

## TanStack Query Patterns

### Query Keys Convention

Use hierarchical query keys for automatic cache invalidation:

```tsx
// Query key structure: [resource, ...identifiers, ...filters]

// List all organizations
queryKey: ['organizations']

// Get specific organization
queryKey: ['organizations', orgSlug]

// List organization members
queryKey: ['organizations', orgSlug, 'members']

// List organization members with filters
queryKey: ['organizations', orgSlug, 'members', { role: 'ADMIN' }]

// List invitations for organization
queryKey: ['organizations', orgSlug, 'invitations']
```

**Why this matters:** Invalidating `['organizations', orgSlug]` will also invalidate all nested queries.

### Mutations with Cache Invalidation

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'

function useRemoveMember(orgSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memberId: string) => api.delete(`/api/v1/orgs/${orgSlug}/members/${memberId}`),
    onSuccess: () => {
      // Invalidate and refetch members list
      queryClient.invalidateQueries({
        queryKey: ['organizations', orgSlug, 'members'],
      })

      // Also invalidate org details (member count may have changed)
      queryClient.invalidateQueries({
        queryKey: ['organizations', orgSlug],
      })
    },
  })
}
```

### Optimistic Updates

For better UX, update the UI immediately before the API responds:

```tsx
function useUpdateMemberRole(orgSlug: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      api.patch(`/api/v1/orgs/${orgSlug}/members/${memberId}`, { role }),

    // Before mutation runs
    onMutate: async ({ memberId, role }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ['organizations', orgSlug, 'members'],
      })

      // Snapshot previous value
      const previousMembers = queryClient.getQueryData(['organizations', orgSlug, 'members'])

      // Optimistically update
      queryClient.setQueryData(['organizations', orgSlug, 'members'], (old: any) => ({
        ...old,
        data: old.data.map((m: any) => (m.id === memberId ? { ...m, role } : m)),
      }))

      return { previousMembers }
    },

    // On error, rollback
    onError: (_err, _variables, context) => {
      queryClient.setQueryData(['organizations', orgSlug, 'members'], context?.previousMembers)
    },

    // Always refetch after error or success
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['organizations', orgSlug, 'members'],
      })
    },
  })
}
```

## API Client Setup

### Axios Instance (`lib/api-client.ts`)

```tsx
import axios from 'axios'
import { useAuth } from '@/features/auth/context/AuthContext'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Send httpOnly cookies for refresh token
})

// Request interceptor: Add access token to all requests
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem('accessToken')
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Response interceptor: Refresh token on 401
api.interceptors.response.use(
  (response) => response.data, // Unwrap data automatically
  async (error) => {
    const originalRequest = error.config

    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Refresh the token
        const { accessToken } = await api.post('/api/v1/auth/refresh')

        // Save new token
        localStorage.setItem('accessToken', accessToken)

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed → logout user
        localStorage.removeItem('accessToken')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
```

## Route Protection

### Protected Route Wrapper

```tsx
// lib/router.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/AuthContext'

function ProtectedRoute() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

// Usage in router config
const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
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
      // ... all protected routes
    ],
  },
])
```

## Form Patterns

### Controlled Components with Zod Validation

```tsx
import type { FormEvent } from 'react'
import { useState } from 'react'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER']),
})

type InviteFormData = z.infer<typeof inviteSchema>

function InviteMemberModal({ orgSlug }: { orgSlug: string }) {
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: 'MEMBER',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({})

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) => api.post(`/api/v1/orgs/${orgSlug}/invitations`, data),
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    // Validate with Zod before submitting
    const result = inviteSchema.safeParse(formData)

    if (!result.success) {
      // Extract Zod errors
      const zodErrors: Partial<Record<keyof InviteFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          zodErrors[issue.path[0] as keyof InviteFormData] = issue.message
        }
      })
      setErrors(zodErrors)
      return
    }

    setErrors({})

    try {
      await inviteMutation.mutateAsync(result.data)
      // Success - close modal, show toast, etc.
    } catch (error) {
      // Handle API errors
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-red-600 text-sm">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="role">Role</label>
        <select
          id="role"
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'MEMBER' })}
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      <button type="submit" disabled={inviteMutation.isPending}>
        {inviteMutation.isPending ? 'Sending...' : 'Send Invitation'}
      </button>
    </form>
  )
}
```

## Common Pitfalls

### ❌ Don't store server data in useState

```tsx
// BAD
const [organizations, setOrganizations] = useState([])
useEffect(() => {
  api.get('/api/v1/orgs').then((data) => setOrganizations(data))
}, [])
```

### ✅ Use React Query

```tsx
// GOOD
const { data: organizations } = useQuery({
  queryKey: ['organizations'],
  queryFn: () => api.get('/api/v1/orgs'),
})
```

### ❌ Don't forget to handle all states

```tsx
// BAD - will crash on loading
return <div>{organizations.map(...)}</div>
```

### ✅ Handle loading, error, and empty states

```tsx
// GOOD
if (isLoading) return <LoadingSkeleton />
if (error) return <ErrorMessage error={error} />
if (!organizations?.length) return <EmptyState />
return <div>{organizations.map(...)}</div>
```

### ❌ Don't use `any` for event handlers

```tsx
// BAD
function handleChange(e: any) {
  setEmail(e.target.value)
}
```

### ✅ Use proper types

```tsx
// GOOD
function handleChange(e: ChangeEvent<HTMLInputElement>) {
  setEmail(e.target.value)
}
```

## TypeScript with Generated Types

Import types from `@plinth/types` package (auto-generated from OpenAPI spec):

```tsx
import type { components, paths } from '@plinth/types'

// Schema types
type User = components['schemas']['User']
type Organization = components['schemas']['Organization']
type Membership = components['schemas']['Membership']

// Response types
type GetMembersResponse =
  paths['/api/v1/orgs/{slug}/members']['get']['responses']['200']['content']['application/json']

// Request body types
type CreateOrgRequest = paths['/api/v1/orgs']['post']['requestBody']['content']['application/json']
```

This ensures frontend and backend types stay in sync — any API change that breaks the frontend will fail at compile time.
