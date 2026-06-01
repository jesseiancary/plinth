import { QueryClient } from '@tanstack/react-query'

import { RateLimitError } from './api-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: (failureCount, error) => {
        // Don't retry on rate limit errors
        if (error instanceof RateLimitError) {
          return false
        }
        // Default retry logic: max 3 attempts
        return failureCount < 3
      },
      retryDelay: (attemptIndex, error) => {
        // If it's a rate limit error, respect the retry-after time
        if (error instanceof RateLimitError) {
          return error.retryAfter * 1000 // Convert to milliseconds
        }
        // Default exponential backoff
        return Math.min(1000 * 2 ** attemptIndex, 30000)
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on rate limit errors
        if (error instanceof RateLimitError) {
          return false
        }
        // Default retry: max 1 attempt
        return failureCount < 1
      },
    },
  },
})
