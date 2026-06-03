/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BrowserRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@plinth/types'

import { AuthContext } from '../context/AuthContext'

import { UserMenu } from './UserMenu'

type User = components['schemas']['User']

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00Z',
}

const createWrapper = (user: User | null = mockUser) => {
  const mockLogout = vi.fn()

  const authValue = {
    user,
    accessToken: user ? 'test-token' : null,
    isInitializing: false,
    login: vi.fn(),
    logout: mockLogout,
    isAuthenticated: !!user,
  }

  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={authValue}>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthContext.Provider>
    ),
    mockLogout,
  }
}

describe('UserMenu - Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders nothing when user is null', () => {
    const { wrapper } = createWrapper(null)
    const { container } = render(<UserMenu />, { wrapper })

    expect(container).toBeEmptyDOMElement()
  })

  it('displays user name and avatar', () => {
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('T')).toBeInTheDocument() // Avatar initial
  })

  it('opens dropdown on click', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // Dropdown should be open
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeInTheDocument()
  })

  it('closes dropdown with Escape key', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')

    // Dropdown should be closed
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('auto-focuses sign out button when dropdown opens', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // Sign out button should be focused
    const signOutButton = screen.getByRole('menuitem', { name: /sign out/i })
    await waitFor(() => {
      expect(signOutButton).toHaveFocus()
    })
  })

  it('triggers sign out with Enter key', async () => {
    const user = userEvent.setup()
    const { wrapper, mockLogout } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // Press Enter
    await user.keyboard('{Enter}')

    // Logout should be called
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('triggers sign out with Space key', async () => {
    const user = userEvent.setup()
    const { wrapper, mockLogout } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // Press Space
    await user.keyboard(' ')

    // Logout should be called
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('triggers sign out when clicking the button', async () => {
    const user = userEvent.setup()
    const { wrapper, mockLogout } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // Click sign out button
    const signOutButton = screen.getByRole('menuitem', { name: /sign out/i })
    await user.click(signOutButton)

    // Logout should be called
    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  it('has proper ARIA attributes', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    const button = screen.getByRole('button', { name: /user menu/i })

    // Button should have aria-expanded=false initially
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveAttribute('aria-haspopup', 'true')

    // Open dropdown
    await user.click(button)

    // aria-expanded should be true
    expect(button).toHaveAttribute('aria-expanded', 'true')

    // Menu should have proper role and orientation
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('aria-orientation', 'vertical')

    // Sign out button should have tabIndex=-1 and role=menuitem
    const signOutButton = screen.getByRole('menuitem', { name: /sign out/i })
    expect(signOutButton).toHaveAttribute('tabIndex', '-1')
    expect(signOutButton).toHaveAttribute('role', 'menuitem')
  })

  it('displays user info in dropdown header', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // User info should be displayed
    const menu = screen.getByRole('menu')
    expect(menu).toHaveTextContent('Test User')
    expect(menu).toHaveTextContent('test@example.com')
  })

  it('sanitizes user name for display', () => {
    const maliciousUser: User = {
      ...mockUser,
      name: '<script>alert("xss")</script>User',
    }

    const { wrapper } = createWrapper(maliciousUser)
    render(<UserMenu />, { wrapper })

    // Should display sanitized name (React escapes by default, sanitize removes control chars)
    const nameElement = screen.getByText(/User/)
    expect(nameElement).toBeInTheDocument()

    // Script tags should not be in the DOM as executable scripts
    expect(document.querySelector('script')).not.toBeInTheDocument()
  })

  it('truncates long email addresses', async () => {
    const user = userEvent.setup()
    const longEmailUser: User = {
      ...mockUser,
      email: 'verylongemailaddress@extremelylongdomainname.com',
    }

    const { wrapper } = createWrapper(longEmailUser)
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    // Email container should have truncate class
    const menu = screen.getByRole('menu')
    const emailElement = menu.querySelector('.truncate')
    expect(emailElement).toBeInTheDocument()
    expect(emailElement).toHaveTextContent('verylongemailaddress@extremelylongdomainname.com')
  })

  it('generates correct avatar initial', () => {
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Should show first letter of name
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('handles multi-word names for avatar initial', () => {
    const multiWordUser: User = {
      ...mockUser,
      name: 'John Doe',
    }

    const { wrapper } = createWrapper(multiWordUser)
    render(<UserMenu />, { wrapper })

    // Should show first letter of first name
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    const { container } = render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Click outside (on the backdrop)
    const backdrop = container.querySelector('.fixed.inset-0')
    expect(backdrop).toBeInTheDocument()

    if (backdrop) {
      await user.click(backdrop)
    }

    // Dropdown should be closed
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('applies focus styles to sign out button', async () => {
    const user = userEvent.setup()
    const { wrapper } = createWrapper()
    render(<UserMenu />, { wrapper })

    // Open dropdown
    const button = screen.getByRole('button', { name: /user menu/i })
    await user.click(button)

    const signOutButton = screen.getByRole('menuitem', { name: /sign out/i })

    // Should have focus styles
    expect(signOutButton).toHaveClass('focus:outline-none')
    expect(signOutButton).toHaveClass('focus:bg-brand-100')
  })
})
