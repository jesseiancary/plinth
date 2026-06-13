# Frontend Patterns & Implementation Guide

This guide documents established patterns and provides step-by-step instructions for implementing remaining frontend features.

---

## Established Patterns (Phase 5a-5f)

### 1. Tailwind v4 CSS-First Configuration

**All Tailwind configuration is in `apps/web/src/index.css`:**

```css
@import 'tailwindcss';
@plugin '@tailwindcss/forms';

@theme {
  --color-brand-500: #3b82f6;
  --color-danger: #ef4444;
  /* etc... */
}
```

**No `tailwind.config.ts` needed** - Tailwind v4 uses pure CSS configuration with `@theme` for colors and `@plugin` for plugins.

### 2. API Error Handling

**Use the `getApiErrorMessage()` helper:**

```tsx
import { getApiErrorMessage } from '@/lib/api-error'

{
  mutation.isError && (
    <div className="text-sm text-danger">{getApiErrorMessage(mutation.error)}</div>
  )
}
```

**Benefits:**

- Type-safe error extraction
- Consistent error messages
- Handles Axios errors properly

### 3. localStorage with Zod Validation

**For complex objects, always validate on retrieval:**

```tsx
import { z } from 'zod'

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
})

const [user, setUser] = useState<User | null>(() => {
  try {
    const stored = localStorage.getItem('user')
    if (!stored) return null

    const parsed: unknown = JSON.parse(stored)
    const result = userSchema.safeParse(parsed)

    if (!result.success) {
      localStorage.removeItem('user')
      return null
    }

    return result.data
  } catch (_error) {
    localStorage.removeItem('user')
    return null
  }
})
```

**Why:** Prevents crashes from corrupted localStorage, auto-cleans invalid data.

### 4. State Management Patterns

- **Server state:** TanStack Query (all API data)
- **Global client state:** React Context (auth, active org)
- **Local UI state:** useState (forms, modals)

### 5. Type Safety

**Import types from generated package:**

```tsx
import type { components } from '@plinth/types'

type User = components['schemas']['User']
type Organization = components['schemas']['Organization']
```

Types are auto-generated from OpenAPI spec.

---

## Phase 5g-5j: Implementation Guide

This section provides step-by-step instructions for implementing the remaining frontend features. All patterns and infrastructure are already established in phases 5a-5f.

---

## Phase 5g: Members Management

### File: `src/features/members/MembersPage.tsx`

**Purpose:** Display list of organization members with remove functionality.

**Implementation:**

```tsx
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '@/lib/api-client'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/Button'
import { Badge } from '@/shared/components/Badge'
import { Modal } from '@/shared/components/Modal'
import type { components } from '@plinth/types'

type Membership = components['schemas']['Membership']

export function MembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const queryClient = useQueryClient()
  const [memberToRemove, setMemberToRemove] = useState<Membership | null>(null)

  // Fetch members
  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', orgSlug, 'members'],
    queryFn: () => api.get<{ data: Membership[] }>(`/api/v1/orgs/${orgSlug}/members`),
    enabled: !!orgSlug,
  })

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/api/v1/orgs/${orgSlug}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'members'] })
      setMemberToRemove(null)
    },
  })

  const handleRemoveClick = (member: Membership) => {
    setMemberToRemove(member)
  }

  const handleConfirmRemove = () => {
    if (memberToRemove) {
      removeMutation.mutate(memberToRemove.id)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">Members</h1>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <Button
              onClick={() => {
                /* TODO: Open invite modal */
              }}
            >
              Invite Member
            </Button>
          </div>
        </div>

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
                className="text-brand-600 hover:text-brand-500 font-medium"
              >
                Try again
              </button>
            }
          />
        )}

        {data && data.data.length === 0 && (
          <EmptyState title="No members yet" message="Invite team members to collaborate" />
        )}

        {data && data.data.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul role="list" className="divide-y divide-gray-200">
              {data.data.map((member) => (
                <li key={member.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center">
                          <span className="text-brand-700 font-medium">
                            {member.user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.user.name}</p>
                        <p className="text-sm text-gray-500">{member.user.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <Badge
                      variant={
                        member.role === 'OWNER'
                          ? 'info'
                          : member.role === 'ADMIN'
                            ? 'success'
                            : 'info'
                      }
                    >
                      {member.role}
                    </Badge>
                    {member.role !== 'OWNER' && (
                      <Button variant="danger" size="sm" onClick={() => handleRemoveClick(member)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Remove confirmation modal */}
        <Modal
          isOpen={!!memberToRemove}
          onClose={() => setMemberToRemove(null)}
          title="Remove member"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to remove <strong>{memberToRemove?.user.name}</strong> from this
              organization?
            </p>
            {removeMutation.isError && (
              <ErrorMessage error={removeMutation.error} title="Failed to remove member" />
            )}
            <div className="flex space-x-3">
              <Button
                variant="danger"
                onClick={handleConfirmRemove}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? 'Removing...' : 'Remove'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMemberToRemove(null)}
                disabled={removeMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
```

**Update Router:** In `src/lib/router.tsx`, replace the Members placeholder:

```tsx
import { MembersPage } from '@/features/members/MembersPage'

// In router config:
{
  path: '/orgs/:orgSlug/members',
  element: <MembersPage />,
},
```

**Testing Checklist:**

- [ ] Navigate to `/orgs/{slug}/members` - shows loading spinner
- [ ] Members list displays with name, email, role badge
- [ ] Click "Remove" on a MEMBER - shows confirmation modal
- [ ] Confirm removal - member disappears from list
- [ ] OWNER role shows no "Remove" button
- [ ] Empty state shows when no members

---

## Phase 5h: Invitation System

### File: `src/features/invitations/components/InviteMemberModal.tsx`

**Purpose:** Modal form to invite new members to organization.

**Implementation:**

```tsx
import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api-client'
import { Modal } from '@/shared/components/Modal'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { ErrorMessage } from '@/shared/components/ErrorMessage'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER']),
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  orgSlug: string
}

export function InviteMemberModal({ isOpen, onClose, orgSlug }: InviteMemberModalProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: 'MEMBER',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof InviteFormData, string>>>({})

  const inviteMutation = useMutation({
    mutationFn: (data: InviteFormData) => api.post(`/api/v1/orgs/${orgSlug}/invitations`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'invitations'] })
      setFormData({ email: '', role: 'MEMBER' })
      onClose()
    },
  })

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()

    const result = inviteSchema.safeParse(formData)

    if (!result.success) {
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
    inviteMutation.mutate(result.data)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          error={errors.email}
          disabled={inviteMutation.isPending}
          placeholder="colleague@example.com"
        />

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="role"
            value={formData.role}
            onChange={(e) =>
              setFormData({ ...formData, role: e.target.value as 'ADMIN' | 'MEMBER' })
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            disabled={inviteMutation.isPending}
          >
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        {inviteMutation.isError && (
          <ErrorMessage error={inviteMutation.error} title="Failed to send invitation" />
        )}

        <div className="flex space-x-3">
          <Button type="submit" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? 'Sending...' : 'Send invitation'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={inviteMutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
```

### File: `src/features/invitations/components/PendingInvitationsList.tsx`

**Purpose:** Display pending invitations with revoke functionality.

**Implementation:**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/Button'
import { Badge } from '@/shared/components/Badge'
import { Modal } from '@/shared/components/Modal'
import type { components } from '@plinth/types'

type Invitation = components['schemas']['Invitation']

interface PendingInvitationsListProps {
  orgSlug: string
}

export function PendingInvitationsList({ orgSlug }: PendingInvitationsListProps) {
  const queryClient = useQueryClient()
  const [invitationToRevoke, setInvitationToRevoke] = useState<Invitation | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', orgSlug, 'invitations'],
    queryFn: () => api.get<{ data: Invitation[] }>(`/api/v1/orgs/${orgSlug}/invitations`),
  })

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) =>
      api.delete(`/api/v1/orgs/${orgSlug}/invitations/${invitationId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'invitations'] })
      setInvitationToRevoke(null)
    },
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage error={error} title="Failed to load invitations" />
  }

  const pendingInvitations = data?.data.filter((inv) => inv.status === 'PENDING') || []

  if (pendingInvitations.length === 0) {
    return (
      <EmptyState
        title="No pending invitations"
        message="All invitations have been accepted or revoked"
      />
    )
  }

  return (
    <>
      <div className="mt-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Pending Invitations</h2>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul role="list" className="divide-y divide-gray-200">
            {pendingInvitations.map((invitation) => (
              <li key={invitation.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{invitation.email}</p>
                  <p className="text-xs text-gray-500">
                    Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge variant="warning">{invitation.role}</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setInvitationToRevoke(invitation)}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Modal
        isOpen={!!invitationToRevoke}
        onClose={() => setInvitationToRevoke(null)}
        title="Revoke invitation"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to revoke the invitation for{' '}
            <strong>{invitationToRevoke?.email}</strong>?
          </p>
          {revokeMutation.isError && (
            <ErrorMessage error={revokeMutation.error} title="Failed to revoke invitation" />
          )}
          <div className="flex space-x-3">
            <Button
              variant="danger"
              onClick={() => invitationToRevoke && revokeMutation.mutate(invitationToRevoke.id)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setInvitationToRevoke(null)}
              disabled={revokeMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
```

**Update MembersPage:** Add invitation components:

```tsx
// At top of MembersPage.tsx
import { useState } from 'react'
import { InviteMemberModal } from '@/features/invitations/components/InviteMemberModal'
import { PendingInvitationsList } from '@/features/invitations/components/PendingInvitationsList'

// Inside MembersPage component
const [showInviteModal, setShowInviteModal] = useState(false)

// Update "Invite Member" button:
<Button onClick={() => setShowInviteModal(true)}>
  Invite Member
</Button>

// At end of return, before closing </DashboardLayout>:
{orgSlug && <PendingInvitationsList orgSlug={orgSlug} />}

<InviteMemberModal
  isOpen={showInviteModal}
  onClose={() => setShowInviteModal(false)}
  orgSlug={orgSlug!}
/>
```

**Testing Checklist:**

- [ ] Click "Invite Member" - modal opens
- [ ] Submit with invalid email - shows error
- [ ] Submit valid invitation - closes modal, appears in pending list
- [ ] Click "Revoke" on pending invitation - shows confirmation
- [ ] Confirm revoke - invitation disappears from list

---

## Phase 5i: Accept Invitation Flow

### File: `src/features/invitations/AcceptInvitationPage.tsx`

**Purpose:** Public page for accepting invitations (authenticated or not).

**Implementation:**

```tsx
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuth } from '@/features/auth/context/AuthContext'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { Button } from '@/shared/components/Button'
import type { components } from '@plinth/types'

type Invitation = components['schemas']['Invitation']

interface InvitationValidationResponse extends Invitation {
  organization: {
    id: string
    name: string
    slug: string
  }
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  // Validate token (public endpoint)
  const {
    data: invitation,
    isLoading,
    error,
  } = useQuery<InvitationValidationResponse>({
    queryKey: ['invitations', 'validate', token],
    queryFn: () => api.get(`/api/v1/invitations/validate/${token}`),
    enabled: !!token,
    retry: false,
  })

  // Accept invitation (requires auth)
  const acceptMutation = useMutation({
    mutationFn: () => api.post('/api/v1/invitations/accept', { token }),
    onSuccess: () => {
      navigate(`/orgs/${invitation?.organization.slug}/members`)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">
            This invitation link is invalid, has expired, or has already been used.
          </p>
          <Link to="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (invitation.status !== 'PENDING') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invitation Not Available</h1>
          <p className="text-gray-600 mb-6">
            This invitation has already been {invitation.status.toLowerCase()}.
          </p>
          <Link to="/login">
            <Button>Go to Login</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
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
            <Link to={`/login?redirect=/invite/${token}`} className="block">
              <Button className="w-full">Sign In</Button>
            </Link>
            <Link to={`/register?redirect=/invite/${token}`} className="block">
              <Button variant="secondary" className="w-full">
                Create Account
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {acceptMutation.isError && (
              <div className="mb-4">
                <ErrorMessage error={acceptMutation.error} title="Failed to accept invitation" />
              </div>
            )}
            <Button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="w-full"
            >
              {acceptMutation.isPending ? 'Accepting...' : 'Accept Invitation'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

**Update Router:** Replace invitation placeholder:

```tsx
import { AcceptInvitationPage } from '@/features/invitations/AcceptInvitationPage'

// In router config:
{
  path: '/invite/:token',
  element: <AcceptInvitationPage />,
},
```

**Update Login/RegisterPage:** Handle redirect query param:

```tsx
// In LoginPage.tsx and RegisterPage.tsx, add:
import { useSearchParams } from 'react-router-dom'

// Inside component:
const [searchParams] = useSearchParams()
const redirect = searchParams.get('redirect')

// In onSuccess handler:
onSuccess: (data) => {
  login(data.accessToken, data.user)
  navigate(redirect || '/')
},
```

**Testing Checklist:**

- [ ] Visit `/invite/{validToken}` while logged out - shows sign in/register buttons
- [ ] Click "Sign In" - redirects to login with `?redirect=/invite/{token}`
- [ ] After login - returns to invitation page
- [ ] Click "Accept Invitation" - joins org, redirects to members page
- [ ] Visit `/invite/{invalidToken}` - shows error message

---

## Phase 5j: Organization Settings & API Keys

### File: `src/features/organizations/OrgSettingsPage.tsx`

**Purpose:** Manage organization settings (rename, delete, transfer).

**Implementation:**

```tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api-client'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { Input } from '@/shared/components/Input'
import { Button } from '@/shared/components/Button'
import { Modal } from '@/shared/components/Modal'
import { Card } from '@/shared/components/Card'
import type { components } from '@plinth/types'

type Organization = components['schemas']['Organization']

const updateOrgSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
})

type UpdateOrgFormData = z.infer<typeof updateOrgSchema>

export function OrgSettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'general' | 'danger'>('general')
  const [formData, setFormData] = useState<UpdateOrgFormData>({ name: '', slug: '' })
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateOrgFormData, string>>>({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const { data: org, isLoading } = useQuery<Organization>({
    queryKey: ['organizations', orgSlug],
    queryFn: () => api.get(`/api/v1/orgs/${orgSlug}`),
    enabled: !!orgSlug,
    onSuccess: (data) => {
      setFormData({ name: data.name, slug: data.slug })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrgFormData) => api.patch(`/api/v1/orgs/${orgSlug}`, data),
    onSuccess: (updatedOrg: Organization) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      // If slug changed, redirect
      if (updatedOrg.slug !== orgSlug) {
        navigate(`/orgs/${updatedOrg.slug}/settings`)
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/orgs/${orgSlug}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
      navigate('/')
    },
  })

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault()

    const result = updateOrgSchema.safeParse(formData)
    if (!result.success) {
      const zodErrors: Partial<Record<keyof UpdateOrgFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          zodErrors[issue.path[0] as keyof UpdateOrgFormData] = issue.message
        }
      })
      setErrors(zodErrors)
      return
    }

    setErrors({})
    updateMutation.mutate(result.data)
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Organization Settings</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('danger')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'danger'
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Danger Zone
            </button>
          </nav>
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Organization name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={errors.name}
                disabled={updateMutation.isPending}
              />

              <Input
                label="Organization slug"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                error={errors.slug}
                helperText="Used in URLs (lowercase, numbers, hyphens only)"
                disabled={updateMutation.isPending}
              />

              {updateMutation.isError && (
                <ErrorMessage error={updateMutation.error} title="Failed to update organization" />
              )}

              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </form>
          </Card>
        )}

        {/* Danger Zone Tab */}
        {activeTab === 'danger' && (
          <Card className="border-danger">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Organization</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Permanently delete this organization and all associated data. This action cannot
                  be undone.
                </p>
                <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
                  Delete Organization
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete organization"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{org?.name}</strong>? This will permanently
              delete:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>All members and invitations</li>
              <li>All API keys</li>
              <li>All organization data</li>
            </ul>
            <p className="text-sm font-medium text-danger">This action cannot be undone.</p>

            {deleteMutation.isError && (
              <ErrorMessage error={deleteMutation.error} title="Failed to delete organization" />
            )}

            <div className="flex space-x-3">
              <Button
                variant="danger"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Organization'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
```

### File: `src/features/api-keys/ApiKeysPage.tsx`

**Purpose:** Manage API keys (list, generate, revoke).

**Implementation:**

```tsx
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { api } from '@/lib/api-client'
import { DashboardLayout } from '@/shared/components/DashboardLayout'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { ErrorMessage } from '@/shared/components/ErrorMessage'
import { EmptyState } from '@/shared/components/EmptyState'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { Modal } from '@/shared/components/Modal'
import { Badge } from '@/shared/components/Badge'
import type { components } from '@plinth/types'

type ApiKey = components['schemas']['ApiKey']

const generateKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  scopes: z.array(z.string()).min(1, 'Select at least one scope'),
})

type GenerateKeyFormData = z.infer<typeof generateKeySchema>

export function ApiKeysPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const queryClient = useQueryClient()
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null)
  const [formData, setFormData] = useState<GenerateKeyFormData>({
    name: '',
    scopes: ['read', 'write'],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof GenerateKeyFormData, string>>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', orgSlug, 'api-keys'],
    queryFn: () => api.get<{ data: ApiKey[] }>(`/api/v1/orgs/${orgSlug}/api-keys`),
    enabled: !!orgSlug,
  })

  const generateMutation = useMutation<{ key: string; id: string }, Error, GenerateKeyFormData>({
    mutationFn: (data) => api.post(`/api/v1/orgs/${orgSlug}/api-keys`, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'api-keys'] })
      setGeneratedKey(response.key)
      setShowGenerateModal(false)
      setFormData({ name: '', scopes: ['read', 'write'] })
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/api/v1/orgs/${orgSlug}/api-keys/${keyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', orgSlug, 'api-keys'] })
      setKeyToRevoke(null)
    },
  })

  const handleGenerate = (e: SubmitEvent) => {
    e.preventDefault()

    const result = generateKeySchema.safeParse(formData)
    if (!result.success) {
      const zodErrors: Partial<Record<keyof GenerateKeyFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          zodErrors[issue.path[0] as keyof GenerateKeyFormData] = issue.message
        }
      })
      setErrors(zodErrors)
      return
    }

    setErrors({})
    generateMutation.mutate(result.data)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <Button onClick={() => setShowGenerateModal(true)}>Generate Key</Button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {error && <ErrorMessage error={error} title="Failed to load API keys" />}

        {data && data.data.length === 0 && (
          <EmptyState
            title="No API keys yet"
            message="Generate an API key to access the Plinth API programmatically"
            action={
              <Button onClick={() => setShowGenerateModal(true)}>Generate your first key</Button>
            }
          />
        )}

        {data && data.data.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul role="list" className="divide-y divide-gray-200">
              {data.data.map((key) => (
                <li key={key.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{key.name}</p>
                      <div className="mt-1 flex items-center space-x-2">
                        {key.scopes.map((scope) => (
                          <Badge key={scope} variant="info">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsedAt &&
                          ` • Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button variant="danger" size="sm" onClick={() => setKeyToRevoke(key)}>
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Generate Key Modal */}
        <Modal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          title="Generate API key"
        >
          <form onSubmit={handleGenerate} className="space-y-4">
            <Input
              label="Key name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              error={errors.name}
              placeholder="Production server"
              disabled={generateMutation.isPending}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
              <div className="space-y-2">
                {['read', 'write'].map((scope) => (
                  <label key={scope} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.scopes.includes(scope)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({ ...formData, scopes: [...formData.scopes, scope] })
                        } else {
                          setFormData({
                            ...formData,
                            scopes: formData.scopes.filter((s) => s !== scope),
                          })
                        }
                      }}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{scope}</span>
                  </label>
                ))}
              </div>
              {errors.scopes && <p className="mt-1 text-sm text-danger">{errors.scopes}</p>}
            </div>

            {generateMutation.isError && (
              <ErrorMessage error={generateMutation.error} title="Failed to generate key" />
            )}

            <div className="flex space-x-3">
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowGenerateModal(false)}
                disabled={generateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Modal>

        {/* Show Generated Key Modal */}
        <Modal
          isOpen={!!generatedKey}
          onClose={() => setGeneratedKey(null)}
          title="API key generated"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Your API key has been generated. <strong>Copy it now</strong> — it won't be shown
              again.
            </p>
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200 flex items-center justify-between">
              <code className="text-sm font-mono text-gray-900 flex-1 break-all">
                {generatedKey}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => generatedKey && copyToClipboard(generatedKey)}
              >
                Copy
              </Button>
            </div>
            <Button onClick={() => setGeneratedKey(null)}>Done</Button>
          </div>
        </Modal>

        {/* Revoke Key Modal */}
        <Modal isOpen={!!keyToRevoke} onClose={() => setKeyToRevoke(null)} title="Revoke API key">
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to revoke the key <strong>{keyToRevoke?.name}</strong>?
              Applications using this key will no longer be able to access the API.
            </p>

            {revokeMutation.isError && (
              <ErrorMessage error={revokeMutation.error} title="Failed to revoke key" />
            )}

            <div className="flex space-x-3">
              <Button
                variant="danger"
                onClick={() => keyToRevoke && revokeMutation.mutate(keyToRevoke.id)}
                disabled={revokeMutation.isPending}
              >
                {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setKeyToRevoke(null)}
                disabled={revokeMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </DashboardLayout>
  )
}
```

**Update Router:** Replace placeholders:

```tsx
import { OrgSettingsPage } from '@/features/organizations/OrgSettingsPage'
import { ApiKeysPage } from '@/features/api-keys/ApiKeysPage'

// In router config:
{
  path: '/orgs/:orgSlug/settings',
  element: <OrgSettingsPage />,
},
{
  path: '/orgs/:orgSlug/api-keys',
  element: <ApiKeysPage />,
},
```

**Testing Checklist:**

- [ ] Navigate to Settings - shows general tab
- [ ] Update org name - saves successfully
- [ ] Switch to Danger Zone tab
- [ ] Click Delete - shows confirmation modal
- [ ] Navigate to API Keys - shows empty state
- [ ] Click Generate Key - shows modal with form
- [ ] Submit - shows "key generated" modal with copy button
- [ ] Click Copy - copies to clipboard
- [ ] Close - key appears in list
- [ ] Click Revoke - shows confirmation
- [ ] Confirm - key disappears from list

---

## Final Steps

1. **Run TypeScript Check:**

   ```bash
   cd apps/web
   pnpm typecheck
   ```

2. **Test All Features:**
   - Register new account
   - Login
   - View members page
   - Invite a member
   - Accept invitation (in new incognito window)
   - Remove a member
   - Generate API key
   - Revoke API key
   - Update org settings
   - Test protected route redirects

3. **Run `/review` Command** (when ready)

4. **Create PR** with all completed features

---

## Common Patterns Summary

### Query Pattern

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => api.get(`/api/v1/resource/${id}`),
})
```

### Mutation Pattern

```tsx
const mutation = useMutation({
  mutationFn: (data) => api.post('/api/v1/resource', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resource'] })
  },
})
```

### Form Validation Pattern

```tsx
const schema = z.object({ field: z.string().min(1) })
const result = schema.safeParse(formData)
if (!result.success) {
  // Extract and set errors
}
```

### Modal Pattern

```tsx
const [isOpen, setIsOpen] = useState(false)
<Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="...">
  {/* content */}
</Modal>
```
