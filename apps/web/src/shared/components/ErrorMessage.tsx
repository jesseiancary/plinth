import type { ReactNode } from 'react'

interface ErrorMessageProps {
  error: unknown
  title?: string
  action?: ReactNode
}

export function ErrorMessage({ error, title, action }: ErrorMessageProps) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'

  return (
    <div className="rounded-md bg-danger-light p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-danger"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-danger-dark">{title || 'Error'}</h3>
          <div className="mt-2 text-sm text-danger-dark">{message}</div>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  )
}
