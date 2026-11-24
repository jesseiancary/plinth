import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// Extend InternalAxiosRequestConfig to include _retry flag
interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Custom error class for rate limiting
export class RateLimitError extends Error {
  retryAfter: number // seconds until retry is allowed

  constructor(retryAfter: number) {
    super('Rate limit exceeded. Please try again later.')
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
  }
}

// Access token getter - will be provided by AuthContext
// This avoids circular dependency while keeping token in memory
let getAccessTokenFn: (() => string | null) | null = null
export const setAccessTokenGetter = (fn: () => string | null) => {
  getAccessTokenFn = fn
}

/**
 * Get CSRF token from cookie
 * The backend sets this cookie on GET requests with httpOnly=false
 * so we can read it and send it back in the X-CSRF-Token header
 */
const getCsrfToken = (): string | null => {
  const cookies: string[] = document.cookie.split(';')
  for (const cookie of cookies) {
    const parts: string[] = cookie.trim().split('=')
    const [name, value] = parts
    if (name === 'csrf-token' && value) {
      return decodeURIComponent(value)
    }
  }
  return null
}

// Token refresh state management
let isRefreshing = false
let refreshSubscribers: Array<(token: string) => void> = []

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback)
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token))
  refreshSubscribers = []
}

// Token refresh callback - called when token is refreshed
// AuthContext will register this callback to update its state
let onTokenRefreshedCallback: ((token: string) => void) | null = null
export const setTokenRefreshCallback = (callback: (token: string) => void) => {
  onTokenRefreshedCallback = callback
}

// Public auth endpoints that must NOT trigger token-refresh-on-401 — they have
// no session to refresh (the token/credentials in the body are the credential).
// Authenticated auth endpoints (/auth/me, /auth/password, /auth/logout) are
// deliberately excluded so they *do* refresh on 401.
const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/verify-email',
  '/auth/forgot-password',
  '/auth/reset-password',
]

// Empty VITE_API_URL means "same origin": the browser calls relative /api/* paths and
// the host (Caddy in dev, Vercel rewrites in prod) proxies them to the API. Keeping the
// frontend and API on one origin is what makes the SameSite=strict refresh cookie and the
// double-submit CSRF cookie (read via document.cookie) work — see docs/DEPLOYMENT.md.
const apiBaseUrl = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // Send httpOnly cookies for refresh token
})

// Request interceptor: Add access token and CSRF token to all requests
api.interceptors.request.use(
  (config) => {
    // Get access token from memory via AuthContext getter
    const accessToken = getAccessTokenFn?.()
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }

    // Add CSRF token to state-changing requests
    const method = config.method?.toUpperCase()
    if (method && ['POST', 'PATCH', 'DELETE', 'PUT'].includes(method) && config.headers) {
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }

    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// Response interceptor: Refresh token on 401, handle 429
api.interceptors.response.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  (response) => response.data, // Unwrap data automatically
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig

    // Handle 429 Rate Limit
    if (error.response?.status === 429) {
      // Extract Retry-After header (can be in seconds or HTTP date)
      const retryAfterHeader = error.response.headers['retry-after'] as string | undefined
      let retryAfter = 60 // Default to 60 seconds if header is missing

      if (retryAfterHeader) {
        // Check if it's a number (seconds) or a date
        const retryAfterNumber = Number.parseInt(retryAfterHeader, 10)
        if (!Number.isNaN(retryAfterNumber)) {
          retryAfter = retryAfterNumber
        } else {
          // Parse as HTTP date and calculate seconds from now
          const retryDate = new Date(retryAfterHeader)
          const now = new Date()
          retryAfter = Math.max(0, Math.floor((retryDate.getTime() - now.getTime()) / 1000))
        }
      }

      throw new RateLimitError(retryAfter)
    }

    // If 401 and not already retrying
    // IMPORTANT: Don't try to refresh the token for public auth endpoints
    const isAuthEndpoint = PUBLIC_AUTH_PATHS.some((path) => originalRequest?.url?.includes(path))

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            resolve(api(originalRequest))
          })
        })
      }

      isRefreshing = true

      try {
        // Refresh the token
        const response = await axios.post<{ accessToken: string }>(
          `${apiBaseUrl}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        )

        const { accessToken } = response.data

        // Notify AuthContext to update token in memory
        if (onTokenRefreshedCallback) {
          onTokenRefreshedCallback(accessToken)
        }

        // Notify all queued requests
        onTokenRefreshed(accessToken)
        isRefreshing = false

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed → logout user
        isRefreshing = false
        refreshSubscribers = []

        // Clear user data and redirect to login
        localStorage.removeItem('user')
        window.location.href = '/login'
        return Promise.reject(new Error('Refresh token failed', { cause: refreshError }))
      }
    }

    return Promise.reject(error)
  },
)
