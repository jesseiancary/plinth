import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<Element | null>(null)

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) {
      return
    }

    // Store the previously focused element
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    previousActiveElement.current = document.activeElement

    // Focus the modal container
    if (modalRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      modalRef.current.focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Handle Tab key for focus trap
      if (e.key === 'Tab') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!focusableElements || focusableElements.length === 0) {
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const firstElement = focusableElements[0] as HTMLElement
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        // Shift + Tab on first element -> focus last element
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          lastElement.focus()
          return
        }

        // Tab on last element -> focus first element
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          firstElement.focus()
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    document.addEventListener('keydown', handleKeyDown)
    // Prevent body scroll
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    document.body.style.overflow = 'hidden'

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      document.removeEventListener('keydown', handleKeyDown)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      document.body.style.overflow = 'unset'

      // Restore focus to previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

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
        ref={modalRef}
        className="relative bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    document.body,
  )
}
