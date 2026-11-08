import type { ReactNode } from 'react'

interface ResourceTableProps {
  columns: string[]
  children: ReactNode // <tr> rows
  header?: ReactNode // optional in-card sub-header above the table
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onLoadMore: () => void
}

/**
 * Card-wrapped table shell shared by the dashboard list pages. Renders the
 * visible column headers plus a trailing sr-only "Actions" header, the row
 * body (passed as `children`), and the cursor "Load more" footer.
 */
export function ResourceTable({
  columns,
  children,
  header,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: ResourceTableProps) {
  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      {header}
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
      </table>
      {hasNextPage && (
        <div className="flex justify-center border-t border-gray-200 bg-gray-50 px-6 py-3">
          <button
            className="text-sm font-medium text-brand-600 hover:text-brand-900 disabled:opacity-50"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
