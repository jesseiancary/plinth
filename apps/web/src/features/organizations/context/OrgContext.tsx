import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'

interface OrgContextValue {
  activeOrgSlug: string | null
  setActiveOrgSlug: (slug: string) => void
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined)

export function OrgProvider({ children }: { children: ReactNode }) {
  const [activeOrgSlug, setActiveOrgSlug] = useState<string | null>(() =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.getItem('activeOrgSlug'),
  )

  const handleSetActiveOrgSlug = (slug: string) => {
    setActiveOrgSlug(slug)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    localStorage.setItem('activeOrgSlug', slug)
  }

  return (
    <OrgContext.Provider
      value={{
        activeOrgSlug,
        setActiveOrgSlug: handleSetActiveOrgSlug,
      }}
    >
      {children}
    </OrgContext.Provider>
  )
}

export function useActiveOrg() {
  const context = useContext(OrgContext)
  if (!context) {
    throw new Error('useActiveOrg must be used within OrgProvider')
  }
  return context
}
