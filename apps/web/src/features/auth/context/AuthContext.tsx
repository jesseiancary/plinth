import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { z } from 'zod'

import type { components } from '@plinth/types'

import {
  api,
  setAccessTokenGetter,
  setTokenRefreshCallback as setApiTokenRefreshCallback,
} from '../../../lib/api-client'
import { createStorage, onStorageChange } from '../../../lib/storage'

type User = components['schemas']['User']

// Zod schema for validating user data from localStorage
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string(),
})

// Type-safe localStorage accessor for user profile (non-sensitive data)
// Access token is stored in memory only (React state) for XSS protection
const userStorage = createStorage<User>({
  key: 'user',
  schema: userSchema,
})

interface AuthContextValue {
  user: User | null
  accessToken: string | null
  isInitializing: boolean
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => userStorage.get())
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const login = (token: string, user: User) => {
    // Update access token in memory only (XSS protection)
    setAccessToken(token)
    setUser(user)

    try {
      // Persist only user profile to localStorage (non-sensitive data)
      // Access token is NOT persisted - it lives in memory only
      userStorage.set(user)
    } catch (error) {
      // If localStorage fails, log but don't break the login flow
      console.error('Failed to persist user profile to localStorage:', error)
    }
  }

  const logout = () => {
    // Clear memory token and localStorage user
    setAccessToken(null)
    userStorage.remove()
    setUser(null)
  }

  // Register token getter with api-client (runs once on mount)
  useEffect(() => {
    setAccessTokenGetter(() => accessToken)
  }, [accessToken])

  // Auto-refresh on mount: if user exists but no token, attempt refresh via httpOnly cookie
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = userStorage.get()

      // If user profile exists but no token, attempt auto-refresh
      if (storedUser && !accessToken) {
        try {
          // Call refresh endpoint - uses httpOnly refresh cookie automatically
          // Note: api response interceptor unwraps response.data automatically
          const data = (await api.post('/api/v1/auth/refresh')) as unknown as {
            accessToken: string
          }
          setAccessToken(data.accessToken)
          setUser(storedUser)
        } catch {
          // Refresh failed - clear stale user data and require re-login
          userStorage.remove()
          setUser(null)
        }
      }

      setIsInitializing(false)
    }

    void initAuth() // Intentionally not awaited - runs in background
  }, []) // Run only on mount

  // Set up token refresh callback for api-client
  useEffect(() => {
    setApiTokenRefreshCallback((newToken: string) => {
      setAccessToken(newToken)
    })
  }, [])

  // Synchronize auth state across browser tabs (user logout only)
  useEffect(() => {
    // Listen for user changes in other tabs
    const unsubscribeUser = onStorageChange(userStorage.key, () => {
      const user = userStorage.get()
      setUser(user)

      // If user is cleared in another tab, logout completely
      if (!user) {
        setAccessToken(null)
      }
    })

    return () => {
      unsubscribeUser()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isInitializing,
        login,
        logout,
        isAuthenticated: !!accessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
