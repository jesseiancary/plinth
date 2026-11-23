import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import type { z } from 'zod'

import { registerSchema } from '@plinth/validation'

import { api } from '../../lib/api-client'
import { AuthShell } from '../../shared/components/AuthShell'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'
import { MutationError } from '../../shared/components/MutationError'

interface RegisterResponse {
  message: string
}

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    name: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string | undefined>>>(
    {},
  )

  // Registration no longer returns a session — the account is materialized only
  // when the emailed verification link is clicked. Success shows a "check your
  // email" confirmation rather than logging the user in.
  const registerMutation = useMutation<RegisterResponse, Error, RegisterFormData>({
    mutationFn: (data) => api.post('/api/v1/auth/register', data),
  })

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validate with Zod
    const result = registerSchema.safeParse(formData)

    if (!result.success) {
      const zodErrors: Partial<Record<keyof RegisterFormData, string>> = {}
      result.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          zodErrors[issue.path[0] as keyof RegisterFormData] = issue.message
        }
      })
      setErrors(zodErrors)
      return
    }

    setErrors({})
    registerMutation.mutate(result.data)
  }

  if (registerMutation.isSuccess) {
    return (
      <AuthShell title="Check your email">
        <div className="text-center" role="status">
          <p className="text-base font-medium text-gray-900">{registerMutation.data.message}</p>
          <p className="mt-2 text-sm text-gray-600">
            We've sent a verification link to{' '}
            <span className="font-medium text-gray-900">{formData.email}</span>. Click it to finish
            setting up your account, then sign in.
          </p>
          <Link to="/login" className="mt-6 inline-block">
            <Button variant="secondary">Back to sign in</Button>
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Create your account" subtitle="Start building with Plinth">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          type="text"
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: String(e.currentTarget.value) })
            // Clear error when user starts typing
            if (errors.name) {
              setErrors({ ...errors, name: undefined })
            }
          }}
          onBlur={() => {
            // Validate on blur for early feedback
            const result = registerSchema.shape.name.safeParse(formData.name)
            if (!result.success) {
              setErrors({ ...errors, name: result.error.issues[0]?.message })
            }
          }}
          error={errors.name}
          disabled={registerMutation.isPending}
          autoComplete="name"
          required
        />

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
            const result = registerSchema.shape.email.safeParse(formData.email)
            if (!result.success) {
              setErrors({ ...errors, email: result.error.issues[0]?.message })
            }
          }}
          error={errors.email}
          disabled={registerMutation.isPending}
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
          onBlur={() => {
            // Validate on blur for early feedback
            const result = registerSchema.shape.password.safeParse(formData.password)
            if (!result.success) {
              setErrors({ ...errors, password: result.error.issues[0]?.message })
            }
          }}
          error={errors.password}
          helperText="Must be 8+ characters with uppercase, lowercase, number, and special character"
          disabled={registerMutation.isPending}
          autoComplete="new-password"
          required
        />

        {registerMutation.isError && (
          <MutationError
            error={registerMutation.error}
            onRetry={() => registerMutation.mutate(formData)}
          />
        )}

        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? 'Creating account...' : 'Create account'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm">
        <span className="text-gray-600">Already have an account? </span>
        <Link to="/login" className="text-brand-600 hover:text-brand-500 font-medium">
          Sign in
        </Link>
      </div>
    </AuthShell>
  )
}
