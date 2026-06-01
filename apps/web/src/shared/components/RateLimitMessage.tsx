import { useEffect, useState } from 'react'

import type { RateLimitError } from '../../lib/api-client'

interface RateLimitMessageProps {
  error: RateLimitError
  onRetry?: () => void
}

export function RateLimitMessage({ error, onRetry }: RateLimitMessageProps) {
  const [timeRemaining, setTimeRemaining] = useState(error.retryAfter)

  useEffect(() => {
    if (timeRemaining <= 0) {
      return
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return () => clearInterval(timer)
  }, [timeRemaining])

  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''}`
    }
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (remainingSeconds === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`
    }
    return `${minutes}m ${remainingSeconds}s`
  }

  return (
    <div className="bg-warning-50 border border-warning-200 rounded-md p-4" role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-warning-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-warning-800">Rate Limit Exceeded</h3>
          <div className="mt-2 text-sm text-warning-700">
            <p>
              You have made too many requests. Please wait{' '}
              <span className="font-semibold">{formatTime(timeRemaining)}</span> before trying
              again.
            </p>
          </div>
          {timeRemaining === 0 && onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="bg-warning-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-warning-700 focus:outline-none focus:ring-2 focus:ring-warning-500"
              >
                Retry Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
