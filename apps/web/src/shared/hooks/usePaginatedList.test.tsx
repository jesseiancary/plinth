import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { usePaginatedList } from './usePaginatedList'

interface Item {
  id: string
}

const page1 = { data: [{ id: 'a' }, { id: 'b' }], nextCursor: 'cursor-2' }
const page2 = { data: [{ id: 'c' }], nextCursor: null }

const wrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('usePaginatedList', () => {
  it('flattens pages and advances the cursor across fetchNextPage', async () => {
    const queryFn = (cursor: string | undefined) =>
      Promise.resolve(cursor === 'cursor-2' ? page2 : page1)

    const { result } = renderHook(() => usePaginatedList<Item>({ queryKey: ['items'], queryFn }), {
      wrapper: wrapper(),
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.items).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => {
      await result.current.fetchNextPage()
    })

    await waitFor(() => {
      expect(result.current.items).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    })
    expect(result.current.hasNextPage).toBe(false)
  })

  it('does not run the query when disabled', () => {
    let called = false
    const queryFn = () => {
      called = true
      return Promise.resolve(page1)
    }

    const { result } = renderHook(
      () => usePaginatedList<Item>({ queryKey: ['items-disabled'], queryFn, enabled: false }),
      { wrapper: wrapper() },
    )

    expect(called).toBe(false)
    expect(result.current.items).toEqual([])
  })

  it('surfaces query errors', async () => {
    const queryFn = () => Promise.reject(new Error('boom'))

    const { result } = renderHook(
      () => usePaginatedList<Item>({ queryKey: ['items-error'], queryFn }),
      { wrapper: wrapper() },
    )

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error))
    expect(result.current.items).toEqual([])
  })
})
