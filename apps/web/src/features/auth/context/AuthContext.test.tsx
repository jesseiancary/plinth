/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Mock } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@plinth/types'

import { api } from '../../../lib/api-client'

import { AuthProvider, useAuth } from './AuthContext'

type User = components['schemas']['User']

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date().toISOString(),
}

// Mock the api module
vi.mock('../../../lib/api-client', () => ({
  api: {
    post: vi.fn(),
  },
  setAccessTokenGetter: vi.fn(),
  setTokenRefreshCallback: vi.fn(),
}))

describe('AuthContext - Memory-Based Token Storage (XSS Protection)', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('XSS Protection', () => {
    it('should NOT store access token in localStorage (security requirement)', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Login
      act(() => {
        result.current.login('test-token', mockUser)
      })

      // Access token should NOT be in localStorage (XSS protection)
      expect(localStorage.getItem('accessToken')).toBeNull()

      // But should be in memory
      expect(result.current.accessToken).toBe('test-token')
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('should store user profile in localStorage (non-sensitive data)', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Login
      act(() => {
        result.current.login('test-token', mockUser)
      })

      // User profile is safe to store (no sensitive credentials)
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser))
      expect(result.current.user).toEqual(mockUser)
    })

    it('should clear access token from memory on logout', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Login
      act(() => {
        result.current.login('test-token', mockUser)
      })
      expect(result.current.accessToken).toBe('test-token')

      // Logout
      act(() => {
        result.current.logout()
      })

      // Access token should be cleared from memory
      expect(result.current.accessToken).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('stores token in memory and user in localStorage', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Initially not authenticated
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(localStorage.getItem('user')).toBeNull()

      // Login
      act(() => {
        result.current.login('test-token', mockUser)
      })

      // Token in memory only
      expect(localStorage.getItem('accessToken')).toBeNull()
      expect(result.current.accessToken).toBe('test-token')

      // User in localStorage
      expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser))
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('logs error but continues when localStorage fails (graceful degradation)', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Mock localStorage.setItem to always fail
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      // Spy on console.error to verify error is logged
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Attempt login - should NOT throw (graceful degradation)
      act(() => {
        result.current.login('test-token', mockUser)
      })

      // State SHOULD be updated (user is logged in for this session)
      expect(result.current.accessToken).toBe('test-token')
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)

      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist user profile to localStorage:',
        expect.any(Error),
      )

      // localStorage won't have the data (but that's OK - session-only login)
      expect(localStorage.getItem('user')).toBeNull()

      vi.restoreAllMocks()
    })
  })

  describe('logout', () => {
    it('clears token from memory and user from localStorage', () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Login first
      act(() => {
        result.current.login('test-token', mockUser)
      })
      expect(result.current.isAuthenticated).toBe(true)

      // Logout
      act(() => {
        result.current.logout()
      })

      // Token cleared from memory
      expect(result.current.accessToken).toBeNull()

      // User cleared from localStorage
      expect(localStorage.getItem('user')).toBeNull()
      expect(result.current.user).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('initialization from localStorage', () => {
    it('attempts auto-refresh when user exists but no token', async () => {
      // Pre-populate localStorage with user (but no token)
      localStorage.setItem('user', JSON.stringify(mockUser))

      // Mock successful refresh
      ;(api.post as Mock).mockResolvedValueOnce({ accessToken: 'refreshed-token' })

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Should be initializing
      expect(result.current.isInitializing).toBe(true)

      // Wait for auto-refresh to complete
      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      // Should have refreshed token
      expect((api.post as Mock).mock.calls[0]).toEqual(['/api/v1/auth/refresh'])
      expect(result.current.accessToken).toBe('refreshed-token')
      expect(result.current.user).toEqual(mockUser)
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('clears stale user when refresh fails', async () => {
      // Pre-populate localStorage with user
      localStorage.setItem('user', JSON.stringify(mockUser))

      // Mock failed refresh
      ;(api.post as Mock).mockRejectedValueOnce(new Error('Unauthorized'))

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Wait for initialization to complete
      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      // Should have cleared stale user data
      expect(result.current.user).toBeNull()
      expect(result.current.accessToken).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
      expect(localStorage.getItem('user')).toBeNull()
    })

    it('completes initialization immediately when no user in localStorage', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Should complete initialization without refresh attempt
      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })

      expect((api.post as Mock).mock.calls.length).toBe(0)
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('cross-tab synchronization', () => {
    it('logs out when user is cleared in another tab', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Login
      act(() => {
        result.current.login('test-token', mockUser)
      })
      expect(result.current.isAuthenticated).toBe(true)

      // Simulate another tab clearing the user
      localStorage.removeItem('user')

      // Trigger storage event
      act(() => {
        const storageEvent = new StorageEvent('storage', {
          key: 'user',
          newValue: null,
          oldValue: JSON.stringify(mockUser),
          storageArea: localStorage,
        })
        window.dispatchEvent(storageEvent)
      })

      await waitFor(() => {
        expect(result.current.user).toBeNull()
        expect(result.current.accessToken).toBeNull()
        expect(result.current.isAuthenticated).toBe(false)
      })
    })
  })

  describe('initialization state', () => {
    it('starts with isInitializing: true when user exists in localStorage', () => {
      // Set user in localStorage to trigger async initialization
      localStorage.setItem('user', JSON.stringify(mockUser))
      ;(api.post as Mock).mockImplementation(
        () => new Promise(() => {}), // Never resolve to keep initializing
      )

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      // Should be initializing on mount (and stay that way since we never resolve)
      expect(result.current.isInitializing).toBe(true)
    })

    it('sets isInitializing: false after auto-refresh completes', async () => {
      localStorage.setItem('user', JSON.stringify(mockUser))
      ;(api.post as Mock).mockResolvedValueOnce({ accessToken: 'refreshed-token' })

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })
    })

    it('sets isInitializing: false even when refresh fails', async () => {
      localStorage.setItem('user', JSON.stringify(mockUser))
      ;(api.post as Mock).mockRejectedValueOnce(new Error('Unauthorized'))

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider })

      await waitFor(() => {
        expect(result.current.isInitializing).toBe(false)
      })
    })
  })
})
