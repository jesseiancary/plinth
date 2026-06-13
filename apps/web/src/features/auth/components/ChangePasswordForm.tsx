import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'

import { changePasswordSchema } from '@plinth/validation'

import { useAuth } from '../context/AuthContext'

import { api } from '@/lib/api-client'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'

export function ChangePasswordForm() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  /**
   * Securely clear password strings from memory
   * Overwrites with random data before clearing to prevent memory retention
   */
  const secureClearPasswords = () => {
    // Overwrite with random data first
    setCurrentPassword(crypto.randomUUID())
    setNewPassword(crypto.randomUUID())
    setConfirmPassword(crypto.randomUUID())

    // Then clear
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  // Secure cleanup on unmount - secureClearPasswords is intentionally not in deps
  // eslint-disable-next-line arrow-body-style
  useEffect(() => {
    return () => {
      secureClearPasswords()
    }
    // eslint-disable-next-line
  }, [])

  const mutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      await api.patch('/api/v1/auth/password', data)
    },
    onSuccess: () => {
      setSuccessMessage('Password changed successfully. Logging you out...')
      secureClearPasswords()
      setValidationErrors({})

      // Log out after 2 seconds
      setTimeout(() => {
        logout()
        void navigate('/login', {
          state: { message: 'Password changed. Please log in with your new password.' },
        })
      }, 2000)
    },
    onError: () => {
      setSuccessMessage('')
    },
  })

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Validate new password with Zod
    try {
      changePasswordSchema.shape.newPassword.parse(newPassword)
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.newPassword = error.errors[0]?.message ?? 'Invalid password'
      }
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    // Check if current password is provided
    if (!currentPassword) {
      errors.currentPassword = 'Current password is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage('')

    if (!validateForm()) {
      return
    }

    mutation.mutate({ currentPassword, newPassword })
  }

  // Calculate password strength
  const getPasswordStrength = (
    password: string,
  ): { score: number; label: string; color: string } => {
    if (!password) {
      return { score: 0, label: '', color: '' }
    }

    let score = 0
    if (password.length >= 8) {
      score++
    }
    if (/[a-z]/.test(password)) {
      score++
    }
    if (/[A-Z]/.test(password)) {
      score++
    }
    if (/[0-9]/.test(password)) {
      score++
    }
    if (/[^A-Za-z0-9]/.test(password)) {
      score++
    }

    if (score < 3) {
      return { score, label: 'Weak', color: 'text-danger' }
    }
    if (score < 5) {
      return { score, label: 'Medium', color: 'text-warning' }
    }
    return { score, label: 'Strong', color: 'text-success' }
  }

  const strength = getPasswordStrength(newPassword)

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {successMessage && (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {mutation.isError && (
        <div className="rounded-md bg-red-50 p-4">
          {/* eslint-disable-next-line @typescript-eslint/no-unsafe-call */}
          <p className="text-sm text-danger">{getApiErrorMessage(mutation.error)}</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
            Current Password
          </label>
        </div>
        <div className="mt-1 relative">
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              setCurrentPassword(e.currentTarget.value)
              setValidationErrors((prev) => ({ ...prev, currentPassword: '' }))
            }}
            disabled={mutation.isPending || Boolean(successMessage)}
            error={validationErrors.currentPassword}
            required
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            New Password
          </label>
          {newPassword && (
            <span className={`text-sm font-medium ${strength.color}`}>{strength.label}</span>
          )}
        </div>
        <div className="mt-1 relative">
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              setNewPassword(e.currentTarget.value)
              setValidationErrors((prev) => ({ ...prev, newPassword: '' }))
            }}
            disabled={mutation.isPending || Boolean(successMessage)}
            error={validationErrors.newPassword}
            required
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Must be at least 8 characters with uppercase, lowercase, number, and special character
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            Confirm New Password
          </label>
        </div>
        <div className="mt-1 relative">
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
              setConfirmPassword(e.currentTarget.value)
              setValidationErrors((prev) => ({ ...prev, confirmPassword: '' }))
            }}
            disabled={mutation.isPending || Boolean(successMessage)}
            error={validationErrors.confirmPassword}
            required
          />
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <Button
          type="submit"
          variant="primary"
          disabled={mutation.isPending || Boolean(successMessage)}
          className="w-full sm:w-auto"
        >
          {mutation.isPending ? 'Changing Password...' : 'Change Password'}
        </Button>
      </div>
    </form>
  )
}
