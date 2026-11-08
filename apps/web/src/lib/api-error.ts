import axios from 'axios'

/**
 * Type guard for API error response
 */
function isApiErrorResponse(data: unknown): data is { error: { message: string; code?: string } } {
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

/**
 * Extract the machine-readable error code from an API error response
 * (`{ error: { code, message } }`), for branching on a specific failure
 * (e.g. `USER_ALREADY_MEMBER`) without matching on the human message.
 *
 * Returns `null` when the error is not an Axios error carrying our envelope
 * or the envelope omits a `code`.
 */
export function getApiErrorCode(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const responseData: unknown = error.response?.data
    if (isApiErrorResponse(responseData) && typeof responseData.error.code === 'string') {
      return responseData.error.code
    }
  }

  return null
}
