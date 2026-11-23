import { RateLimitError } from '../../lib/api-client'
import { getApiErrorMessage } from '../../lib/api-error'

import { RateLimitMessage } from './RateLimitMessage'

interface MutationErrorProps {
  error: unknown
  onRetry?: () => void
}

/**
 * Inline error for a failed mutation on a form page. Renders the richer
 * `RateLimitMessage` (with a Retry-After countdown) for a 429, and a plain
 * `role="alert"` line for everything else. Centralizes the error-presentation
 * branch that the public auth pages would otherwise each duplicate.
 *
 * For the boxed/card error style, use `ErrorMessage` instead.
 */
export function MutationError({ error, onRetry }: MutationErrorProps) {
  if (error instanceof RateLimitError) {
    // Forward `onRetry` only when provided — `exactOptionalPropertyTypes`
    // rejects passing an explicit `undefined` to the optional prop.
    return <RateLimitMessage error={error} {...(onRetry ? { onRetry } : {})} />
  }

  return (
    <div className="text-sm text-danger" role="alert">
      {getApiErrorMessage(error)}
    </div>
  )
}
