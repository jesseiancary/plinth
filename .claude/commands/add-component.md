# Add Component Command

Scaffold a new React component with proper structure, types, tests, and accessibility.

## Usage

```
/add-component {ComponentName} {feature-domain}
```

**Example:** `/add-component MemberList members`

## What This Command Creates

```
apps/web/src/features/{domain}/components/
├── {ComponentName}.tsx          # Component implementation
├── {ComponentName}.test.tsx     # React Testing Library tests
```

## Component Template Checklist

### File Structure

- [ ] Component file created in `apps/web/src/features/{domain}/components/`
- [ ] Test file colocated with `.test.tsx` suffix
- [ ] Props interface defined with descriptive JSDoc
- [ ] Component uses named export (matches filename)

### TypeScript

- [ ] Props interface exported for reusability
- [ ] No `any` types — use `unknown` with type guards if needed
- [ ] Import types from `@plinth/types` for API data
- [ ] Return type inferred from JSX (don't manually annotate)

### Accessibility

- [ ] Semantic HTML elements (`<button>`, `<nav>`, `<main>`, not `<div>` with onClick)
- [ ] All inputs have associated labels (`<label htmlFor>` or `aria-label`)
- [ ] Interactive elements are keyboard navigable (proper `tabIndex`, focus styles)
- [ ] Focus management handled (autofocus on modals, trap focus in dialogs)
- [ ] ARIA attributes used correctly (`aria-label`, `aria-describedby`, `role`)

### Data Fetching

- [ ] Server state managed with TanStack Query (`useQuery`, `useMutation`)
- [ ] **Never** store API data in `useState` — use React Query cache
- [ ] Loading state displayed (`isLoading` or suspense)
- [ ] Error state displayed with retry action
- [ ] Empty state handled (zero results message)

### Forms (if applicable)

- [ ] Controlled components (value + onChange)
- [ ] Validation with Zod schema before submission
- [ ] Error messages displayed inline
- [ ] Submit button disabled during loading
- [ ] Success feedback after mutation

### Styling

- [ ] Tailwind CSS utility classes only (no CSS modules)
- [ ] Design tokens from `tailwind.config.ts` (colors, spacing, typography)
- [ ] Mobile-first responsive breakpoints (`sm:`, `md:`, `lg:`)
- [ ] Focus states visible (`focus:ring`, `focus-visible:outline`)

### Testing

- [ ] Test user behavior, not implementation details
- [ ] Query by accessible roles (`getByRole`, `getByLabelText`)
- [ ] Mock API calls with MSW if component fetches data
- [ ] Test loading state, error state, empty state, and success state
- [ ] Test keyboard navigation and form submission

## Example Component

```tsx
import { useQuery } from '@tanstack/react-query'
import type { components } from '@plinth/types'
import { api } from '@/lib/api-client'

type Member = components['schemas']['Membership']

interface MemberListProps {
  /** Organization slug to fetch members for */
  organizationSlug: string
}

export function MemberList({ organizationSlug }: MemberListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations', organizationSlug, 'members'],
    queryFn: () => api.get<{ data: Member[] }>(`/api/v1/orgs/${organizationSlug}/members`),
  })

  if (isLoading) {
    return <LoadingSpinner aria-label="Loading members" />
  }

  if (error) {
    return (
      <ErrorMessage error={error}>
        <button onClick={() => window.location.reload()}>Retry</button>
      </ErrorMessage>
    )
  }

  if (!data?.data.length) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No members found</p>
      </div>
    )
  }

  return (
    <ul role="list" className="divide-y divide-gray-200">
      {data.data.map((member) => (
        <li key={member.id} className="py-4 flex items-center justify-between">
          <div>
            <p className="font-medium">{member.user.name}</p>
            <p className="text-sm text-gray-500">{member.user.email}</p>
          </div>
          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
            {member.role}
          </span>
        </li>
      ))}
    </ul>
  )
}
```

## Example Test

```tsx
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemberList } from './MemberList'
import { server } from '@/test/mocks/server'
import { http, HttpResponse } from 'msw'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function renderWithQuery(ui: ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('MemberList', () => {
  it('displays loading state initially', () => {
    renderWithQuery(<MemberList organizationSlug="acme" />)
    expect(screen.getByLabelText('Loading members')).toBeInTheDocument()
  })

  it('displays member list when data loads', async () => {
    server.use(
      http.get('/api/v1/orgs/acme/members', () => {
        return HttpResponse.json({
          data: [
            {
              id: 'mem_1',
              role: 'OWNER',
              user: { name: 'Alice', email: 'alice@example.com' },
            },
          ],
        })
      }),
    )

    renderWithQuery(<MemberList organizationSlug="acme" />)

    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('OWNER')).toBeInTheDocument()
  })

  it('displays empty state when no members', async () => {
    server.use(
      http.get('/api/v1/orgs/acme/members', () => {
        return HttpResponse.json({ data: [] })
      }),
    )

    renderWithQuery(<MemberList organizationSlug="acme" />)

    expect(await screen.findByText('No members found')).toBeInTheDocument()
  })

  it('displays error state with retry button', async () => {
    server.use(
      http.get('/api/v1/orgs/acme/members', () => {
        return new HttpResponse(null, { status: 500 })
      }),
    )

    renderWithQuery(<MemberList organizationSlug="acme" />)

    expect(await screen.findByText(/error/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })
})
```

## Common Patterns

### Loading Skeleton

For better UX, use content-aware loading skeletons instead of spinners:

```tsx
function MemberListSkeleton() {
  return (
    <ul role="list" className="divide-y divide-gray-200 animate-pulse">
      {[1, 2, 3].map((i) => (
        <li key={i} className="py-4 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-48" />
          </div>
          <div className="h-6 bg-gray-200 rounded w-16" />
        </li>
      ))}
    </ul>
  )
}
```

### Optimistic Updates

For mutations that affect list data:

```tsx
const queryClient = useQueryClient()

const removeMemberMutation = useMutation({
  mutationFn: (memberId: string) =>
    api.delete(`/api/v1/orgs/${organizationSlug}/members/${memberId}`),
  onMutate: async (memberId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['organizations', organizationSlug, 'members'] })

    // Snapshot previous value
    const previousMembers = queryClient.getQueryData(['organizations', organizationSlug, 'members'])

    // Optimistically update
    queryClient.setQueryData(['organizations', organizationSlug, 'members'], (old: any) => ({
      ...old,
      data: old.data.filter((m: Member) => m.id !== memberId),
    }))

    return { previousMembers }
  },
  onError: (_err, _memberId, context) => {
    // Rollback on error
    queryClient.setQueryData(
      ['organizations', organizationSlug, 'members'],
      context?.previousMembers,
    )
  },
  onSettled: () => {
    // Refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['organizations', organizationSlug, 'members'] })
  },
})
```

## Anti-Patterns to Avoid

❌ **Don't store server data in useState**

```tsx
// BAD
const [members, setMembers] = useState([])
useEffect(() => {
  fetch('/api/members').then((res) => setMembers(res.data))
}, [])
```

✅ **Use React Query**

```tsx
// GOOD
const { data: members } = useQuery({
  queryKey: ['members'],
  queryFn: () => api.get('/api/members'),
})
```

❌ **Don't use div for interactive elements**

```tsx
// BAD - not keyboard accessible
<div onClick={() => handleClick()}>Click me</div>
```

✅ **Use semantic HTML**

```tsx
// GOOD - keyboard accessible by default
<button onClick={handleClick}>Click me</button>
```

❌ **Don't forget loading/error states**

```tsx
// BAD - will break on loading
return <div>{data.map(...)}</div>
```

✅ **Handle all states**

```tsx
// GOOD
if (isLoading) return <LoadingSkeleton />
if (error) return <ErrorMessage error={error} />
if (!data?.length) return <EmptyState />
return <div>{data.map(...)}</div>
```
