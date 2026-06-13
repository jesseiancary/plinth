import type { InputHTMLAttributes } from 'react'
import { forwardRef, useId, useState } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = '', type, ...props }, ref) => {
    const generatedId = useId()
    const inputId = id || generatedId

    const [showPassword, setShowPassword] = useState(false)
    const isPasswordType = type === 'password'

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}

        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-md border px-3 py-2 text-sm
              focus:outline-none focus:ring-2 focus:ring-offset-1
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                error
                  ? 'border-danger focus:border-danger focus:ring-danger'
                  : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
              }
              ${className}
            `}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            {...props}
            type={isPasswordType && showPassword ? 'text' : type}
          />

          {isPasswordType && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-danger">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-1 text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
