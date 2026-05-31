import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

// Extend InternalAxiosRequestConfig to include _retry flag
interface RetryableAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // Send httpOnly cookies for refresh token
})

// Request interceptor: Add access token to all requests
api.interceptors.request.use(
  (config) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const accessToken = localStorage.getItem('accessToken')
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error),
)

// Response interceptor: Refresh token on 401
api.interceptors.response.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  (response) => response.data, // Unwrap data automatically
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableAxiosRequestConfig

    // If 401 and not already retrying
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Refresh the token
        const response = await axios.post<{ accessToken: string }>(
          `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true },
        )

        const { accessToken } = response.data

        // Save new token
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        localStorage.setItem('accessToken', accessToken)

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
        }
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed → logout user
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        localStorage.removeItem('accessToken')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
