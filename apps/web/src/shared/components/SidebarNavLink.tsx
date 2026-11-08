import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

interface SidebarNavLinkProps {
  to: string
  icon: ReactNode
  label: string
}

export function SidebarNavLink({ to, icon, label }: SidebarNavLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700 border-l-4 border-brand-600 -ml-[1px]'
            : 'text-gray-700 hover:bg-gray-100'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
