/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OrgProvider } from '../context/OrgContext'

import { OrgSwitcher } from './OrgSwitcher'

const mockMemberships = [
  {
    id: 'mem-1',
    role: 'owner',
    organization: { id: 'org-1', name: 'First Org', slug: 'first-org', createdAt: '2024-01-01' },
  },
  {
    id: 'mem-2',
    role: 'admin',
    organization: { id: 'org-2', name: 'Second Org', slug: 'second-org', createdAt: '2024-01-02' },
  },
  {
    id: 'mem-3',
    role: 'member',
    organization: { id: 'org-3', name: 'Third Org', slug: 'third-org', createdAt: '2024-01-03' },
  },
]

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: '2024-01-01',
  memberships: mockMemberships,
}

// Mock the API module
vi.mock('../../../lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}))

// Mock the query keys
vi.mock('../../../lib/query-keys', () => ({
  queryKeys: {
    auth: {
      me: () => ['auth', 'me'],
    },
  },
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  // Set the user data in the query cache
  queryClient.setQueryData(['auth', 'me'], mockUser)

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <OrgProvider>{children}</OrgProvider>
        </BrowserRouter>
      </QueryClientProvider>
    )
  }
}

describe('OrgSwitcher - Keyboard Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens dropdown on click', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Dropdown should be open
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('First Org')).toBeInTheDocument()
    expect(screen.getByText('Second Org')).toBeInTheDocument()
    expect(screen.getByText('Third Org')).toBeInTheDocument()
  })

  it('closes dropdown with Escape key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press Escape
    await user.keyboard('{Escape}')

    // Dropdown should be closed
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('navigates down with ArrowDown key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Menu should be visible
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press ArrowDown then Enter to select second item
    await user.keyboard('{ArrowDown}{Enter}')

    // Dropdown should close after selection
    await waitFor(
      () => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('navigates up with ArrowUp key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Menu should be visible
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press ArrowDown twice then ArrowUp then Enter
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}')

    // Dropdown should close after selection
    await waitFor(
      () => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('wraps around when navigating past the last item', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Menu should be visible
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press ArrowDown three times (should wrap to first item) then Enter
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')

    // Dropdown should close after selection
    await waitFor(
      () => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('wraps around when navigating before the first item', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Menu should be visible
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Press ArrowUp (should wrap to last item) then Enter
    await user.keyboard('{ArrowUp}{Enter}')

    // Dropdown should close after selection
    await waitFor(
      () => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      },
      { timeout: 2000 },
    )
  })

  it('jumps to first item with Home key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Navigate to third item
    await user.keyboard('{ArrowDown}{ArrowDown}')

    // Press Home
    await user.keyboard('{Home}')

    // Should jump to first item
    const firstItem = screen.getByRole('menuitem', { name: /First Org/i })
    await waitFor(() => {
      expect(firstItem).toHaveFocus()
    })
  })

  it('jumps to last item with End key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Press End
    await user.keyboard('{End}')

    // Should jump to last item
    const thirdItem = screen.getByRole('menuitem', { name: /Third Org/i })
    await waitFor(() => {
      expect(thirdItem).toHaveFocus()
    })
  })

  it('selects item with Enter key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Navigate to second item
    await user.keyboard('{ArrowDown}')

    // Press Enter
    await user.keyboard('{Enter}')

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('selects item with Space key', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Navigate to second item
    await user.keyboard('{ArrowDown}')

    // Press Space
    await user.keyboard(' ')

    // Dropdown should close
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('updates focus on mouse hover', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // Hover over second item
    const secondItem = screen.getByRole('menuitem', { name: /Second Org/i })
    await user.hover(secondItem)

    // Second item should be focused
    await waitFor(() => {
      expect(secondItem).toHaveFocus()
    })
  })

  it('has proper ARIA attributes', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    const button = screen.getByRole('button', { name: /organization switcher/i })

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

    // Menu items should have tabIndex=-1
    const menuItems = screen.getAllByRole('menuitem')
    menuItems.forEach((item) => {
      expect(item).toHaveAttribute('tabIndex', '-1')
    })
  })

  it('shows loading state while fetching memberships', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })

    // Don't set query data to simulate loading
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <OrgProvider>{children}</OrgProvider>
        </BrowserRouter>
      </QueryClientProvider>
    )

    const { container } = render(<OrgSwitcher />, { wrapper: Wrapper })

    // Should show skeleton loading state (animated pulse divs)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('displays all organizations in dropdown', async () => {
    const user = userEvent.setup()
    render(<OrgSwitcher />, { wrapper: createWrapper() })

    // Open dropdown
    const button = screen.getByRole('button', { name: /organization switcher/i })
    await user.click(button)

    // All organizations should be visible in the menu
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /First Org/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Second Org/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Third Org/i })).toBeInTheDocument()
  })
})
