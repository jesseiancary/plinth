import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'

import { createStorage } from '../../../lib/storage'

interface OrgContextValue {
  activeOrgSlug: string | null
  setActiveOrgSlug: (slug: string) => void
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined)
const activeOrgStorage = createStorage<string>({ key: 'activeOrgSlug' })

export function OrgProvider({ children }: { children: ReactNode }) {
  const [activeOrgSlug, setActiveOrgSlug] = useState<string | null>(() => activeOrgStorage.get())

  const handleSetActiveOrgSlug = (slug: string) => {
    setActiveOrgSlug(slug)
    activeOrgStorage.set(slug)
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
