import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { z } from 'zod'

import type { components } from '@plinth/types'

type User = components['schemas']['User']

// Zod schema for validating user data from localStorage
const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string(),
})

interface AuthContextValue {
  user: User | null
  accessToken: string | null
  login: (token: string, user: User) => void
  logout: () => void
  isAuthenticated: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const stored = localStorage.getItem('user')
      if (!stored) {
        return null
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const parsed: unknown = JSON.parse(stored)
      const result = userSchema.safeParse(parsed)

      if (!result.success) {
        // Invalid data - remove it from localStorage
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        localStorage.removeItem('user')
        return null
      }

      return result.data
    } catch {
      // JSON parse error - remove corrupted data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.removeItem('user')
      return null
    }
  })
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.getItem('accessToken'),
  )

  const login = (token: string, user: User) => {
    try {
      // Write to localStorage first (atomically) - if this fails, state won't update
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.setItem('accessToken', token)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.setItem('user', JSON.stringify(user))

      // Only update state after successful localStorage write
      setAccessToken(token)
      setUser(user)
    } catch (error) {
      // If localStorage fails (quota exceeded, private mode, etc.), rollback
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.removeItem('accessToken')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.removeItem('user')
      console.error('Failed to persist auth state to localStorage:', error)
      throw new Error('Failed to save authentication state')
    }
  }

  const logout = () => {
    try {
      // Clear localStorage first (atomically)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.removeItem('accessToken')
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      localStorage.removeItem('user')

      // Only update state after successful localStorage clear
      setAccessToken(null)
      setUser(null)
    } catch (error) {
      // Even if localStorage fails, clear state (user is logging out)
      setAccessToken(null)
      setUser(null)
      console.error('Failed to clear localStorage during logout:', error)
    }
  }

  // Synchronize auth state across browser tabs
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    const handleStorageChange = (event: StorageEvent) => {
      // Only respond to localStorage changes from other tabs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.storageArea !== localStorage) {
        return
      }

      // Handle accessToken changes
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.key === 'accessToken') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
        setAccessToken(event.newValue)
      }

      // Handle user changes
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.key === 'user') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!event.newValue) {
          setUser(null)
          return
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
          const parsed: unknown = JSON.parse(event.newValue)
          const result = userSchema.safeParse(parsed)

          if (result.success) {
            setUser(result.data)
          } else {
            setUser(null)
          }
        } catch {
          setUser(null)
        }
      }

      // If either token or user is cleared, logout completely
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.key === 'accessToken' && !event.newValue) {
        setUser(null)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        localStorage.removeItem('user')
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (event.key === 'user' && !event.newValue) {
        setAccessToken(null)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        localStorage.removeItem('accessToken')
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    window.addEventListener('storage', handleStorageChange)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
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
