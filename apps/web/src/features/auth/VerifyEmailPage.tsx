import { useEffect, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'

import { api, RateLimitError } from '../../lib/api-client'
import { getApiErrorMessage } from '../../lib/api-error'
import { AuthShell } from '../../shared/components/AuthShell'
import { Button } from '../../shared/components/Button'
import { LoadingSpinner } from '../../shared/components/LoadingSpinner'
import { RateLimitMessage } from '../../shared/components/RateLimitMessage'

interface VerifyResponse {
  message: string
  // `verified` = account materialized by this request; `already_verified` =
  // the account already existed (double-submit / race), so this link was a
  // no-op. Drives the card title without coupling to the message copy.
  status: 'verified' | 'already_verified'
}

/**
 * Auto-submits the token from `/verify-email?token=` (or `/verify-email/:token`)
 * and renders distinct success, already-verified, and expired/invalid states.
 * Recovery for a dead link is re-registration, not a resend — there is no
 * resend-verification endpoint under the pending-registration model.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const { token: paramToken } = useParams<{ token?: string }>()
  const token = paramToken ?? searchParams.get('token') ?? ''

  const verifyMutation = useMutation<VerifyResponse, Error, string>({
    mutationFn: (verificationToken) =>
      api.post('/api/v1/auth/verify-email', { token: verificationToken }),
  })

  // Auto-submit once on mount when a token is present. A ref guards against
  // React 18 StrictMode's double-invoke and token changes re-firing the mutation.
  const submittedRef = useRef(false)
  const { mutate } = verifyMutation
  useEffect(() => {
    if (token && !submittedRef.current) {
      submittedRef.current = true
      mutate(token)
    }
  }, [token, mutate])

  if (!token) {
    return (
      <AuthShell title="Verify your email">
        <div className="text-center">
          <p className="text-base font-medium text-gray-900">This link is missing a token</p>
          <p className="mt-2 text-sm text-gray-600">
            The verification link looks incomplete. Request a fresh one by registering again.
          </p>
          <Link to="/register" className="mt-6 inline-block">
            <Button variant="secondary">Register again</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  if (verifyMutation.isPending || verifyMutation.isIdle) {
    return (
      <AuthShell title="Verify your email" subtitle="Confirming your email address">
        <div className="py-6">
          <LoadingSpinner size="lg" />
        </div>
      </AuthShell>
    )
  }

  if (verifyMutation.isError) {
    if (verifyMutation.error instanceof RateLimitError) {
      return (
        <AuthShell title="Verify your email">
          <RateLimitMessage
            error={verifyMutation.error}
            onRetry={() => verifyMutation.mutate(token)}
          />
        </AuthShell>
      )
    }
    return (
      <AuthShell title="Verify your email">
        <div className="text-center" role="alert">
          <p className="text-base font-medium text-gray-900">This link can't be used</p>
          <p className="mt-2 text-sm text-gray-600">{getApiErrorMessage(verifyMutation.error)}</p>
          <p className="mt-4 text-sm text-gray-600">
            Didn't get the email, or the link expired? Register again for a fresh link.
          </p>
          <Link to="/register" className="mt-6 inline-block">
            <Button variant="secondary">Register again</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  const alreadyVerified = verifyMutation.data.status === 'already_verified'

  return (
    <AuthShell title={alreadyVerified ? 'Already verified' : 'Email verified'}>
      <div className="text-center" role="status">
        <p className="text-base font-medium text-gray-900">{verifyMutation.data.message}</p>
        <Link to="/login" className="mt-6 inline-block">
          <Button>Continue to sign in</Button>
        </Link>
      </div>
    </AuthShell>
  )
}
