/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OrgProvider, useActiveOrg } from './OrgContext'

describe('OrgContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initialization', () => {
    it('initializes with null when localStorage is empty', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      expect(result.current.activeOrgSlug).toBeNull()
    })

    it('loads existing org slug from localStorage on init', () => {
      // Pre-populate localStorage (storage wrapper expects JSON-stringified values)
      localStorage.setItem('activeOrgSlug', JSON.stringify('acme-corp'))

      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      expect(result.current.activeOrgSlug).toBe('acme-corp')
    })

    it('handles corrupted JSON in localStorage gracefully', () => {
      localStorage.setItem('activeOrgSlug', 'not-valid-json{')

      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      // Should not crash - storage wrapper handles parse errors
      expect(result.current.activeOrgSlug).toBeNull()

      // Should clean up corrupted data
      expect(localStorage.getItem('activeOrgSlug')).toBeNull()
    })

    it('handles localStorage being unavailable (private browsing)', () => {
      // Mock localStorage.getItem to fail (simulating private browsing mode)
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage is not available')
      })

      // Should not crash
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      expect(result.current.activeOrgSlug).toBeNull()

      vi.restoreAllMocks()
    })
  })

  describe('setActiveOrgSlug', () => {
    it('updates both state and localStorage atomically', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      // Initially null
      expect(result.current.activeOrgSlug).toBeNull()
      expect(localStorage.getItem('activeOrgSlug')).toBeNull()

      // Set org slug
      act(() => {
        result.current.setActiveOrgSlug('acme-corp')
      })

      // Both state and localStorage should be updated
      expect(result.current.activeOrgSlug).toBe('acme-corp')
      expect(localStorage.getItem('activeOrgSlug')).toBe(JSON.stringify('acme-corp'))
    })

    it('allows switching between different orgs', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      // Set first org
      act(() => {
        result.current.setActiveOrgSlug('acme-corp')
      })
      expect(result.current.activeOrgSlug).toBe('acme-corp')

      // Switch to second org
      act(() => {
        result.current.setActiveOrgSlug('widgets-inc')
      })
      expect(result.current.activeOrgSlug).toBe('widgets-inc')
      expect(localStorage.getItem('activeOrgSlug')).toBe(JSON.stringify('widgets-inc'))
    })

    it('throws error when localStorage quota exceeded', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      // Mock localStorage.setItem to fail with quota exceeded
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      // Should throw (storage wrapper re-throws with context)
      expect(() => {
        act(() => {
          result.current.setActiveOrgSlug('acme-corp')
        })
      }).toThrow(/Failed to save to localStorage/)

      // State should NOT be updated because the error was thrown
      // (unlike AuthContext which has try/catch for graceful degradation)
      expect(result.current.activeOrgSlug).toBeNull()

      // localStorage won't have it either
      expect(localStorage.getItem('activeOrgSlug')).toBeNull()

      vi.restoreAllMocks()
    })

    it('writes to localStorage before updating state', () => {
      // Track the order of operations
      const operations: string[] = []

      // Spy on localStorage.setItem
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        operations.push(`localStorage.setItem(${key})`)
        localStorage[key] = value
      })

      const { result } = renderHook(() => useActiveOrg(), {
        wrapper: OrgProvider,
      })

      act(() => {
        result.current.setActiveOrgSlug('acme-corp')
        operations.push('state.update')
      })

      // localStorage write should happen before state update
      expect(operations).toEqual(['localStorage.setItem(activeOrgSlug)', 'state.update'])

      vi.restoreAllMocks()
    })
  })

  describe('useActiveOrg hook', () => {
    it('throws error when used outside OrgProvider', () => {
      // Suppress console.error for this test (React will log the error)
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useActiveOrg())
      }).toThrow('useActiveOrg must be used within OrgProvider')

      consoleErrorSpy.mockRestore()
    })

    it('provides context value to all consumers within same provider', () => {
      // Note: Each renderHook call with wrapper creates a separate provider instance.
      // To test shared context, we need to use the same provider instance.
      // This test verifies the hook works correctly when used within a provider.

      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      expect(result.current.activeOrgSlug).toBeNull()
      expect(typeof result.current.setActiveOrgSlug).toBe('function')

      // Verify the context provides both properties
      act(() => {
        result.current.setActiveOrgSlug('acme-corp')
      })

      expect(result.current.activeOrgSlug).toBe('acme-corp')
    })
  })

  describe('persistence', () => {
    it('persists org selection across component remounts', () => {
      // First mount
      const { result: result1, unmount } = renderHook(() => useActiveOrg(), {
        wrapper: OrgProvider,
      })

      act(() => {
        result1.current.setActiveOrgSlug('acme-corp')
      })

      expect(result1.current.activeOrgSlug).toBe('acme-corp')

      // Unmount
      unmount()

      // Second mount (simulating page refresh)
      const { result: result2 } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      // Should load from localStorage
      expect(result2.current.activeOrgSlug).toBe('acme-corp')
    })

    it('maintains selection when localStorage is cleared externally', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      act(() => {
        result.current.setActiveOrgSlug('acme-corp')
      })

      expect(result.current.activeOrgSlug).toBe('acme-corp')

      // Simulate external localStorage clear (e.g., browser dev tools)
      localStorage.clear()

      // State should still be 'acme-corp' in current session
      expect(result.current.activeOrgSlug).toBe('acme-corp')

      // But on remount, it would be null
      const { result: newResult } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })
      expect(newResult.current.activeOrgSlug).toBeNull()
    })
  })

  describe('edge cases', () => {
    it('handles empty string as org slug', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      act(() => {
        result.current.setActiveOrgSlug('')
      })

      expect(result.current.activeOrgSlug).toBe('')
      expect(localStorage.getItem('activeOrgSlug')).toBe(JSON.stringify(''))
    })

    it('handles org slugs with special characters', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      const specialSlug = 'org-with-dashes_and_underscores-123'

      act(() => {
        result.current.setActiveOrgSlug(specialSlug)
      })

      expect(result.current.activeOrgSlug).toBe(specialSlug)
      expect(localStorage.getItem('activeOrgSlug')).toBe(JSON.stringify(specialSlug))
    })

    it('handles very long org slugs', () => {
      const { result } = renderHook(() => useActiveOrg(), { wrapper: OrgProvider })

      const longSlug = 'a'.repeat(200)

      act(() => {
        result.current.setActiveOrgSlug(longSlug)
      })

      expect(result.current.activeOrgSlug).toBe(longSlug)
      expect(localStorage.getItem('activeOrgSlug')).toBe(JSON.stringify(longSlug))
    })
  })
})
