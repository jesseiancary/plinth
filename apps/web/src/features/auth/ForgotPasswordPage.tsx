import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { z } from 'zod'

import { requestPasswordResetSchema } from '@plinth/validation'

import { api } from '../../lib/api-client'
import { AuthShell } from '../../shared/components/AuthShell'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { MutationError } from '../../shared/components/MutationError'

interface ForgotPasswordResponse {
  message: string
}

type ForgotPasswordFormData = z.infer<typeof requestPasswordResetSchema>

/**
 * Collects an email and asks the API to begin a reset. The response is an
 * enumeration-safe generic 200 regardless of whether the email is registered,
 * so success always renders the same "check your email" confirmation.
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | undefined>()

  const forgotMutation = useMutation<ForgotPasswordResponse, Error, ForgotPasswordFormData>({
    mutationFn: (data) => api.post('/api/v1/auth/forgot-password', data),
  })

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    const result = requestPasswordResetSchema.safeParse({ email })
    if (!result.success) {
      setError(result.error.issues[0]?.message)
      return
    }

    setError(undefined)
    forgotMutation.mutate(result.data)
  }

  if (forgotMutation.isSuccess) {
    return (
      <AuthShell title="Check your email">
        <div className="text-center" role="status">
          <p className="text-base font-medium text-gray-900">{forgotMutation.data.message}</p>
          <p className="mt-2 text-sm text-gray-600">
            If an account exists for that address, a password reset link is on its way.
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button variant="secondary">Back to sign in</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Forgot your password?" subtitle="We'll email you a reset link">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(String(e.currentTarget.value))
            if (error) {
              setError(undefined)
            }
          }}
          onBlur={() => {
            const result = requestPasswordResetSchema.shape.email.safeParse(email)
            if (!result.success) {
              setError(result.error.issues[0]?.message)
            }
          }}
          error={error}
          disabled={forgotMutation.isPending}
          autoComplete="email"
          required
        />

        {forgotMutation.isError && (
          <MutationError
            error={forgotMutation.error}
            onRetry={() => forgotMutation.mutate({ email })}
          />
        )}

        <Button type="submit" className="w-full" disabled={forgotMutation.isPending}>
          {forgotMutation.isPending ? 'Sending...' : 'Send reset link'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <Link to="/login" className="text-brand-600 hover:text-brand-500 font-medium">
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  )
}
