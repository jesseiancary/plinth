interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }

  return (
    <div className="flex justify-center items-center" role="status" aria-label="Loading">
      <div
        className={`${sizeClasses[size]} border-4 border-gray-200 border-t-brand-500 rounded-full animate-spin`}
      />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
