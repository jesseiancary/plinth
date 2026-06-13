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

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Send httpOnly cookies for refresh token
})

// Request interceptor: Add access token to all requests
api.interceptors.request.use(
  (config) => {
    // Get token from memory via AuthContext getter
    const accessToken = getAccessTokenFn?.()
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
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
    // IMPORTANT: Don't try to refresh token for login/register endpoints
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh')

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
          `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        localStorage.removeItem('user')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        window.location.href = '/login'
        return Promise.reject(new Error('Refresh token failed', { cause: refreshError }))
      }
    }

    return Promise.reject(error)
  },
)
