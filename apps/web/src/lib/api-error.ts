import axios from 'axios'

/**
 * Extract error message from API error response
 *
 * Handles Axios errors and extracts the API error message
 * following our API error response format:
 * { error: { code: string, message: string, details?: object } }
 */
export function getApiErrorMessage(error: unknown): string {
  // Check if it's an Axios error
  if (axios.isAxiosError(error)) {
    // Try to extract our API error format
    const apiError = error.response?.data?.error
    if (apiError && typeof apiError === 'object' && 'message' in apiError) {
      return String(apiError.message)
    }

    // Fallback to generic HTTP error
    if (error.response?.status) {
      return `Request failed with status ${error.response.status}`
    }

    // Network error
    if (error.message) {
      return error.message
    }
  }

  // Unknown error type
  return 'An unexpected error occurred'
}
