import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import type { components } from '@plinth/types'

import { api } from '../../lib/api-client'
import { getApiErrorMessage } from '../../lib/api-error'
import { Button } from '../../shared/components/Button'
import { Input } from '../../shared/components/Input'

import { useAuth } from './context/AuthContext'

type User = components['schemas']['User']

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
})

type RegisterFormData = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    name: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({})

  const registerMutation = useMutation<
    { accessToken: string; user: User },
    Error,
    RegisterFormData
  >({
    mutationFn: (data) => api.post('/api/v1/auth/register', data),
    onSuccess: async (data) => {
      login(data.accessToken, data.user)
      await navigate('/')
    },
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create your account</h1>
          <p className="text-gray-600">Start building with Plinth</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name"
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: String(e.currentTarget.value) })
              }}
              error={errors.name}
              disabled={registerMutation.isPending}
              autoComplete="name"
            />

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: String(e.currentTarget.value) })
              }}
              error={errors.email}
              disabled={registerMutation.isPending}
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => {
                setFormData({ ...formData, password: String(e.currentTarget.value) })
              }}
              error={errors.password}
              helperText="Must be at least 8 characters"
              disabled={registerMutation.isPending}
              autoComplete="new-password"
            />

            {registerMutation.isError && (
              <div className="text-sm text-danger">
                {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */}
                {getApiErrorMessage(registerMutation.error)}
              </div>
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
        </div>
      </div>
    </div>
  )
}
