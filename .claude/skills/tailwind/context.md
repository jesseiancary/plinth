# Tailwind CSS Skill Context

This skill is auto-loaded when working on UI styling, design system, or Tailwind configuration.

## Philosophy

**Composition over Configuration** — Build complex components from simple primitives, not from components with dozens of props.

**Design Tokens First** — Use values from `tailwind.config.ts`, never hardcode colors or spacing.

**Mobile-First Responsive** — Base styles for mobile, progressively enhance for larger screens.

## Tailwind Configuration

### Design Tokens (`apps/web/tailwind.config.ts`)

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6', // Primary brand color
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Semantic colors
        success: {
          light: '#d1fae5',
          DEFAULT: '#10b981',
          dark: '#065f46',
        },
        warning: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#92400e',
        },
        danger: {
          light: '#fee2e2',
          DEFAULT: '#ef4444',
          dark: '#991b1b',
        },
      },
      spacing: {
        // Additional spacing values if needed
        18: '4.5rem',
        22: '5.5rem',
      },
      fontSize: {
        // Custom font sizes
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      borderRadius: {
        // Custom radius values
        '4xl': '2rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'), // Better form defaults
  ],
} satisfies Config
```

### Using Design Tokens

```tsx
// ✅ GOOD - Uses design tokens
<button className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md">
  Click me
</button>

// ❌ BAD - Hardcoded values
<button className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded-md">
  Click me
</button>
```

## Component Composition Patterns

### Button Primitive

```tsx
// shared/components/Button.tsx
import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-500',
    danger: 'bg-danger text-white hover:bg-danger-dark focus-visible:ring-danger',
  }

  const sizeStyles = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

### Input Primitive

```tsx
// shared/components/Input.tsx
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, id, className = '', ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}

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
        />

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
```

### Modal Primitive

```tsx
// shared/components/Modal.tsx
import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal content */}
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 rounded"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
```

## Common UI Patterns

### Card Component

```tsx
function Card({ children }: { children: ReactNode }) {
  return <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">{children}</div>
}
```

### Badge Component

```tsx
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info'

function Badge({ variant, children }: { variant: BadgeVariant; children: ReactNode }) {
  const variantStyles = {
    success: 'bg-success-light text-success-dark',
    warning: 'bg-warning-light text-warning-dark',
    danger: 'bg-danger-light text-danger-dark',
    info: 'bg-brand-100 text-brand-800',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  )
}
```

### Loading Spinner

```tsx
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
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
```

### Empty State

```tsx
function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="text-center py-12">
      <svg
        className="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
```

### Error Message

```tsx
function ErrorMessage({
  error,
  title,
  action,
}: {
  error: unknown
  title?: string
  action?: ReactNode
}) {
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
```

## Responsive Design

### Mobile-First Breakpoints

```tsx
// Tailwind breakpoints (default):
// sm: 640px
// md: 768px
// lg: 1024px
// xl: 1280px
// 2xl: 1536px

// Example: Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">Left column</div>
  <div className="w-full md:w-1/2">Right column</div>
</div>

// Example: Hide on mobile, show on desktop
<div className="hidden md:block">Desktop only</div>

// Example: Show on mobile, hide on desktop
<div className="block md:hidden">Mobile only</div>

// Example: Responsive padding
<div className="px-4 sm:px-6 lg:px-8">
  Content with responsive horizontal padding
</div>
```

### Container Pattern

```tsx
// Max-width container with responsive padding
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <h1>Page title</h1>
  {/* Content */}
</div>
```

### Responsive Grid

```tsx
// 1 column on mobile, 2 on tablet, 3 on desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {items.map((item) => (
    <div key={item.id} className="bg-white rounded-lg shadow p-6">
      {item.name}
    </div>
  ))}
</div>
```

## Accessibility Utilities

### Screen Reader Only Text

```tsx
// Visually hidden but available to screen readers
<span className="sr-only">Accessible label for screen readers</span>
```

### Focus Visible

```tsx
// Only show focus ring when keyboard navigating (not on mouse click)
<button className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
  Click me
</button>
```

### Skip to Content Link

```tsx
// Hidden until focused (for keyboard users)
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-brand-500 text-white px-4 py-2 rounded-md z-50"
>
  Skip to main content
</a>

<main id="main-content">
  {/* Page content */}
</main>
```

## Common Tailwind Patterns

### Hover & Focus States

```tsx
// Button with hover and focus states
<button className="bg-brand-500 hover:bg-brand-600 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors">
  Click me
</button>
```

### Disabled State

```tsx
<button className="bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
  Disabled button
</button>
```

### Truncate Text

```tsx
// Single line truncate
<p className="truncate">Very long text that will be truncated with ellipsis...</p>

// Multi-line truncate (requires line-clamp plugin)
<p className="line-clamp-3">
  Long text that will be truncated after 3 lines with ellipsis...
</p>
```

### Aspect Ratio

```tsx
// 16:9 aspect ratio
<div className="aspect-video bg-gray-200">
  <img src="..." alt="..." className="w-full h-full object-cover" />
</div>

// Square aspect ratio
<div className="aspect-square bg-gray-200">
  <img src="..." alt="..." className="w-full h-full object-cover" />
</div>
```

## Anti-Patterns to Avoid

### ❌ Don't hardcode colors

```tsx
// BAD
<div className="bg-[#3b82f6] text-[#ffffff]">...</div>
```

### ✅ Use design tokens

```tsx
// GOOD
<div className="bg-brand-500 text-white">...</div>
```

### ❌ Don't use arbitrary values for common spacing

```tsx
// BAD
<div className="p-[17px] m-[23px]">...</div>
```

### ✅ Use Tailwind's spacing scale

```tsx
// GOOD
<div className="p-4 m-6">...</div>
```

### ❌ Don't create overly complex component APIs

```tsx
// BAD - too many props, hard to maintain
<Button color="blue" size="large" rounded={true} shadow="md" borderWidth={2} hoverColor="darkBlue">
  Click me
</Button>
```

### ✅ Use composition with primitives

```tsx
// GOOD - compose from simple primitives
<Button variant="primary" size="lg">
  Click me
</Button>
```

## Performance Tips

### Purge Unused Styles

Tailwind automatically purges unused styles in production based on the `content` glob in `tailwind.config.ts`. Make sure all file paths are included:

```ts
content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}']
```

### Avoid Dynamic Class Names

```tsx
// ❌ BAD - Tailwind can't detect these at build time
const color = isActive ? 'blue' : 'gray'
<div className={`bg-${color}-500`}>...</div>

// ✅ GOOD - Use full class names
<div className={isActive ? 'bg-blue-500' : 'bg-gray-500'}>...</div>
```

### Use JIT Mode

Tailwind's Just-in-Time mode is enabled by default and generates styles on-demand, reducing build times and bundle size.
