import { useMemo } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { useInfiniteQuery } from '@tanstack/react-query'

export interface Page<T> {
  data: T[]
  nextCursor: string | null
}

interface UsePaginatedListOptions<T> {
  queryKey: QueryKey
  queryFn: (cursor: string | undefined) => Promise<Page<T>>
  enabled?: boolean
}

/**
 * Cursor-paginated infinite list backed by the API's `{ data, nextCursor }`
 * envelope. Wraps the shared `useInfiniteQuery` wiring (pageParam = cursor) and
 * flattens the pages into a single `items` array.
 */
export function usePaginatedList<T>({
  queryKey,
  queryFn,
  enabled = true,
}: UsePaginatedListOptions<T>) {
  const query = useInfiniteQuery({
    queryKey, // stable key; the cursor is the pageParam, not part of the key
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => queryFn(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  })

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.data) ?? [], [query.data])

  return {
    items,
    isLoading: query.isLoading,
    error: query.error,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  }
}
