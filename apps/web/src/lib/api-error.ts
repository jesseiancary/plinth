import axios from 'axios'

/**
 * Type guard for API error response
 */
function isApiErrorResponse(data: unknown): data is { error: { message: string } } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'object' &&
    data.error !== null &&
    'message' in data.error &&
    typeof data.error.message === 'string'
  )
}

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
    const responseData: unknown = error.response?.data
    if (isApiErrorResponse(responseData)) {
      return responseData.error.message
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
