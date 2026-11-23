import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'

import { resetPasswordSchema } from '@plinth/validation'

import { api } from '../../lib/api-client'
import { AuthShell } from '../../shared/components/AuthShell'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { MutationError } from '../../shared/components/MutationError'

interface ResetPasswordResponse {
  message: string
}

/**
 * New-password form for `/reset-password?token=`. Reuses `strongPasswordSchema`
 * (via `resetPasswordSchema`) and, on success, sends the user to sign in with
 * their new credentials — the reset invalidated every existing session.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | undefined>()

  const resetMutation = useMutation<ResetPasswordResponse, Error, string>({
    mutationFn: (password) =>
      api.post('/api/v1/auth/reset-password', { token, newPassword: password }),
    onSuccess: () => {
      void navigate('/login', { replace: true, state: { passwordReset: true } })
    },
  })

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    const result = resetPasswordSchema.safeParse({ token, newPassword })
    if (!result.success) {
      // Surface the password issue; a missing token is handled by its own state below.
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'newPassword')
      setError(passwordIssue?.message ?? 'Unable to reset password')
      return
    }

    setError(undefined)
    resetMutation.mutate(result.data.newPassword)
  }

  if (!token) {
    return (
      <AuthShell title="Reset your password">
        <div className="text-center">
          <p className="text-base font-medium text-gray-900">This link is missing a token</p>
          <p className="mt-2 text-sm text-gray-600">
            The reset link looks incomplete. Request a fresh one to continue.
          </p>
          <Link to="/forgot-password" className="mt-6 inline-block">
            <Button variant="secondary">Request a new link</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Reset your password" subtitle="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(String(e.currentTarget.value))
            if (error) {
              setError(undefined)
            }
          }}
          onBlur={() => {
            const result = resetPasswordSchema.shape.newPassword.safeParse(newPassword)
            if (!result.success) {
              setError(result.error.issues[0]?.message)
            }
          }}
          error={error}
          helperText="Must be 8+ characters with uppercase, lowercase, number, and special character"
          disabled={resetMutation.isPending}
          autoComplete="new-password"
          required
        />

        {resetMutation.isError && (
          <MutationError
            error={resetMutation.error}
            onRetry={() => resetMutation.mutate(newPassword)}
          />
        )}

        <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
          {resetMutation.isPending ? 'Resetting...' : 'Reset password'}
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
