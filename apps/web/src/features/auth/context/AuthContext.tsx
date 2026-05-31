import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

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
    setAccessToken(token)
    setUser(user)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.setItem('accessToken', token)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.setItem('user', JSON.stringify(user))
  }

  const logout = () => {
    setAccessToken(null)
    setUser(null)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.removeItem('accessToken')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.removeItem('user')
  }

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
