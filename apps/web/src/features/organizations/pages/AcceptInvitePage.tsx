import { useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { components } from '@plinth/types'

import { useActiveOrg } from '../context/OrgContext'
import type { Role } from '../hooks/useCurrentMembership'

import { useAuth } from '@/features/auth/context/AuthContext'
import { api, RateLimitError } from '@/lib/api-client'
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error'
import { pendingInviteStorage } from '@/lib/pending-invite'
import { queryKeys } from '@/lib/query-keys'
import { sanitizeDisplayText } from '@/lib/sanitize'
import { AuthShell } from '@/shared/components/AuthShell'
import { Badge } from '@/shared/components/Badge'
import { Button } from '@/shared/components/Button'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import { RateLimitMessage } from '@/shared/components/RateLimitMessage'

type Organization = components['schemas']['Organization']

interface ValidateResponse {
  email: string
  role: Role
  organization: { name: string; slug: string }
  expiresAt: string
}

interface AcceptResponse {
  organization: Organization
}

// Codes that mean the invitation can never be accepted again — once seen, the
// accept button is withdrawn rather than offered for a doomed retry.
const TERMINAL_ACCEPT_CODES = new Set([
  'INVALID_TOKEN',
  'INVITATION_NOT_FOUND',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'INVITATION_ALREADY_ACCEPTED',
])

const roleLabel = (role: Role) => role.charAt(0) + role.slice(1).toLowerCase()

/**
 * Terminal state for an invitation that can't be acted on (invalid, expired,
 * revoked, already accepted). Uses a neutral header rather than the invite
 * welcome, since there is nothing to accept.
 */
function UnusableInvite({ message, onSignIn }: { message: string; onSignIn: () => void }) {
  return (
    <AuthShell title="Invitation">
      <div className="text-center">
        <p className="text-base font-medium text-gray-900">This invitation can't be used</p>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <Button variant="secondary" className="mt-6" onClick={onSignIn}>
          Go to sign in
        </Button>
      </div>
    </AuthShell>
  )
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuth()
  const { setActiveOrgSlug } = useActiveOrg()

  const {
    data: invitation,
    isLoading,
    error: validateError,
    refetch,
  } = useQuery<ValidateResponse>({
    queryKey: queryKeys.invitations.validate(token ?? ''),
    queryFn: (): Promise<ValidateResponse> =>
      api.get(`/api/v1/invitations/validate/${encodeURIComponent(token ?? '')}`),
    enabled: Boolean(token),
    // 404 (invalid) and 410 (expired/revoked/accepted) are terminal — retrying
    // a bad or spent token only burns the public rate limit.
    retry: false,
  })

  // A valid invite viewed while signed out is stashed so the invitation survives
  // the register → verify → login round-trip (which crosses sessions, losing
  // router state). `LoginPage` consumes it to resume here after login. Only a
  // successfully-validated invite is stashed, so dead tokens never get saved.
  useEffect(() => {
    if (token && !isAuthenticated && invitation) {
      pendingInviteStorage.set(token)
    }
  }, [token, isAuthenticated, invitation])

  const acceptMutation = useMutation<AcceptResponse, Error, void>({
    mutationFn: (): Promise<AcceptResponse> => api.post('/api/v1/invitations/accept', { token }),
    onSuccess: async (result) => {
      // Accepted — the stash (if any) has served its purpose.
      pendingInviteStorage.remove()
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() })
      setActiveOrgSlug(result.organization.slug)
      void navigate('/')
    },
  })

  const goToOrg = (slug: string) => {
    setActiveOrgSlug(slug)
    void navigate('/')
  }

  if (isLoading) {
    return (
      <AuthShell title="Join an organization" subtitle="You've been invited to Plinth">
        <div className="py-6">
          <LoadingSpinner size="lg" />
        </div>
      </AuthShell>
    )
  }

  if (validateError) {
    if (validateError instanceof RateLimitError) {
      return (
        <AuthShell title="Invitation">
          <RateLimitMessage error={validateError} onRetry={() => void refetch()} />
        </AuthShell>
      )
    }
    return (
      <UnusableInvite
        message={getApiErrorMessage(validateError)}
        onSignIn={() => void navigate('/login')}
      />
    )
  }

  if (!invitation) {
    return (
      <UnusableInvite
        message="This invitation link is invalid."
        onSignIn={() => void navigate('/login')}
      />
    )
  }

  const acceptCode = getApiErrorCode(acceptMutation.error)
  const alreadyMember = acceptCode === 'USER_ALREADY_MEMBER'
  const acceptTerminal = acceptCode !== null && TERMINAL_ACCEPT_CODES.has(acceptCode)

  return (
    <AuthShell title="Join an organization" subtitle="You've been invited to Plinth">
      <dl className="space-y-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">Organization</dt>
          <dd className="mt-1 text-lg font-semibold text-gray-900">
            {sanitizeDisplayText(invitation.organization.name)}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Role</dt>
          <dd className="mt-1">
            <Badge variant="info">{roleLabel(invitation.role)}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Invited email</dt>
          <dd className="mt-1 text-sm text-gray-900">{sanitizeDisplayText(invitation.email)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Expires</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {new Date(invitation.expiresAt).toLocaleString()}
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-gray-200 pt-6">
        {!isAuthenticated ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Sign in or create an account to accept.</p>
            <Button
              className="w-full"
              onClick={() => void navigate('/login', { state: { from: location } })}
            >
              Sign in to accept
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => void navigate('/register')}
            >
              Create an account
            </Button>
          </div>
        ) : alreadyMember ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">You're already a member of this organization.</p>
            <Button className="w-full" onClick={() => goToOrg(invitation.organization.slug)}>
              Go to organization
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {acceptMutation.isError &&
              (acceptMutation.error instanceof RateLimitError ? (
                <RateLimitMessage
                  error={acceptMutation.error}
                  onRetry={() => acceptMutation.mutate()}
                />
              ) : (
                <div className="rounded-md bg-red-50 p-3" role="alert">
                  <p className="text-sm text-danger">{getApiErrorMessage(acceptMutation.error)}</p>
                </div>
              ))}

            {!acceptTerminal && (
              <Button
                className="w-full"
                disabled={acceptMutation.isPending}
                onClick={() => acceptMutation.mutate()}
              >
                {acceptMutation.isPending ? 'Accepting…' : 'Accept invitation'}
              </Button>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  )
}
