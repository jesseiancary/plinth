import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { z } from 'zod'

import type { components } from '@plinth/types'
import { loginSchema } from '@plinth/validation'

import { api } from '../../lib/api-client'
import { pendingInviteStorage } from '../../lib/pending-invite'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { MutationError } from '../../shared/components/MutationError'

import { useAuth } from './context/AuthContext'

type User = components['schemas']['User']
type LoginFormData = z.infer<typeof loginSchema>

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string | undefined>>>({})

  // Set by ResetPasswordPage after a successful reset — prompt the user to sign
  // in with their new password (the reset invalidated every existing session).
  const justResetPassword = Boolean(
    (location.state as { passwordReset?: boolean } | null)?.passwordReset,
  )

  const loginMutation = useMutation<{ accessToken: string; user: User }, Error, LoginFormData>({
    mutationFn: (data) => api.post('/api/v1/auth/login', data),
    onSuccess: async (data) => {
      login(data.accessToken, data.user)
      // Resume a pending invitation first: a visitor who started accepting while
      // signed out (e.g. via "Create an account") is sent back to the invite to
      // finish. This survives the cross-session register → verify → login flow
      // that router state can't. Otherwise, honor the return path or go home.
      const pendingInvite = pendingInviteStorage.get()
      if (pendingInvite) {
        pendingInviteStorage.remove()
        await navigate(`/invite/${encodeURIComponent(pendingInvite)}`, { replace: true })
        return
      }
      const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/'
      await navigate(from, { replace: true })
    },
  })

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validate with Zod
    const result = loginSchema.safeParse(formData)

    if (!result.success) {
      const zodErrors: Partial<Record<keyof LoginFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          zodErrors[issue.path[0] as keyof LoginFormData] = issue.message
        }
      })
      setErrors(zodErrors)
      return
    }

    setErrors({})
    loginMutation.mutate(result.data)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {justResetPassword && (
            <div
              className="mb-6 p-4 bg-success-light border border-success rounded-lg"
              role="status"
            >
              <p className="text-sm text-success-dark">
                Your password has been reset. Sign in with your new password.
              </p>
            </div>
          )}

          {/* Demo credentials note */}
          <div className="mb-6 p-4 bg-brand-50 border border-brand-200 rounded-lg">
            <p className="text-sm font-medium text-brand-900 mb-1">Demo Account</p>
            <p className="text-sm text-brand-700">
              <span className="font-mono">admin@example.com</span> /{' '}
              <span className="font-mono">P@ssword123</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: String(e.currentTarget.value) })
                // Clear error when user starts typing
                if (errors.email) {
                  setErrors({ ...errors, email: undefined })
                }
              }}
              onBlur={() => {
                // Validate on blur for early feedback
                const result = loginSchema.shape.email.safeParse(formData.email)
                if (!result.success) {
                  setErrors({ ...errors, email: result.error.issues[0]?.message })
                }
              }}
              error={errors.email}
              disabled={loginMutation.isPending}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: String(e.currentTarget.value) })
                // Clear error when user starts typing
                if (errors.password) {
                  setErrors({ ...errors, password: undefined })
                }
              }}
              error={errors.password}
              disabled={loginMutation.isPending}
              autoComplete="current-password"
              required
            />

            {loginMutation.isError && (
              <MutationError
                error={loginMutation.error}
                onRetry={() => loginMutation.mutate(formData)}
              />
            )}

            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <Link to="/forgot-password" className="text-brand-600 hover:text-brand-500 font-medium">
              Forgot password?
            </Link>
          </div>

          <div className="mt-4 text-center text-sm">
            <span className="text-gray-600">Don't have an account? </span>
            <Link to="/register" className="text-brand-600 hover:text-brand-500 font-medium">
              Create account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
