import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SidebarNavLink } from './SidebarNavLink'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <SidebarNavLink to="/members" label="Members" icon={<svg data-testid="icon" />} />
          }
        />
      </Routes>
    </MemoryRouter>,
  )

describe('SidebarNavLink', () => {
  it('applies active styling when the route matches', () => {
    renderAt('/members')

    const link = screen.getByRole('link', { name: 'Members' })
    expect(link).toHaveClass('bg-brand-50', 'border-brand-600')
    expect(link).not.toHaveClass('text-gray-700')
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('applies inactive styling when the route does not match', () => {
    renderAt('/settings')

    const link = screen.getByRole('link', { name: 'Members' })
    expect(link).toHaveClass('text-gray-700')
    expect(link).not.toHaveClass('bg-brand-50')
  })
})
