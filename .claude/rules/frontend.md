# Frontend Rules (React)

## Project Structure

**Use feature-based organization** — group code by domain/feature, not by technical type.

```
apps/web/src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   └── RegisterForm.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── types.ts
│   │   └── AuthPage.tsx
│   ├── organizations/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types.ts
│   │   └── OrganizationsPage.tsx
│   └── members/
│       ├── components/
│       ├── hooks/
│       ├── types.ts
│       └── MembersPage.tsx
├── shared/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Layout.tsx
│   ├── hooks/
│   │   ├── useApi.ts
│   │   └── useLocalStorage.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   └── validators.ts
│   └── types/
│       └── common.ts
├── lib/
│   ├── api-client.ts
│   └── query-client.ts
├── App.tsx
└── main.tsx
```

**Rationale:**

- Features are self-contained — easier to reason about, test, and delete
- Shared code is explicit — lives in `shared/` or `lib/`, not scattered
- Scales better than grouping by technical role (`/components`, `/hooks`, `/utils` at root)
- Aligns with how developers think about the product (features, not file types)

## Component Organization

- **One component per file** — component name matches filename
- **Colocate tests** — `LoginForm.test.tsx` next to `LoginForm.tsx`
- **Export components as named exports** (exception to default export rule for components is
  allowed but not required)
- **Keep components small** — if a component file exceeds 200 lines, consider splitting

## React Patterns

- **Functional components only** — no class components
- **Use hooks** — `useState`, `useEffect`, `useContext`, custom hooks
- **Keep components pure** — avoid side effects in render
- **Lift state up** when multiple components need shared state
- **Use React Query** for all server state — never store API response data in `useState`
- **Use controlled components** for forms

## State Management

- **Server state** → TanStack Query (React Query)
- **Global client state** → React Context (for auth, theme, etc.)
- **Local component state** → `useState` / `useReducer`
- **Form state** → Controlled components with validation
- **URL state** → React Router params and search params

**Never store server data in Context or component state** — React Query handles caching,
invalidation, and refetching.

## TypeScript in React

- **Type all props** — use interface or type alias
- **No `React.FC`** — just type props directly: `function MyComponent(props: Props)`
- **Infer children type** — `{ children: ReactNode }` when needed
- **Use discriminated unions** for variant props (e.g., button types)

## Styling

- **Tailwind CSS only** — no CSS modules, no styled-components
- **Use design tokens** from `tailwind.config.ts`
- **Composition over configuration** — build from primitives, avoid prop explosion
- **Responsive by default** — mobile-first breakpoints

## API Integration

- **Use generated types** from `@plinth/types` package
- **Validate responses with Zod** even though backend is trusted (defensive coding)
- **Handle loading, error, and empty states** explicitly in every data-fetching component
- **Use React Query hooks** — `useQuery`, `useMutation`, `useQueryClient`

Example:

```tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Organization } from '@plinth/types'

export function OrganizationList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/api/v1/orgs'),
  })

  if (isLoading) return <LoadingSpinner />
  if (error) return <ErrorMessage error={error} />
  if (!data?.length) return <EmptyState />

  return (
    <ul>
      {data.map((org) => (
        <li key={org.id}>{org.name}</li>
      ))}
    </ul>
  )
}
```

## Accessibility

- **Use semantic HTML** — `<button>`, `<nav>`, `<main>`, not `<div>` with click handlers
- **Labels for inputs** — use `<label htmlFor>` or `aria-label`
- **Keyboard navigation** — all interactive elements must be focusable
- **Focus management** — handle focus on route changes, modals, and dynamic content

## Performance

- **Code split by route** — use React Router lazy loading
- **Memoize expensive computations** with `useMemo`
- **Avoid premature optimization** — measure first, optimize second
- **Keep bundle size small** — avoid importing entire libraries when a small utility will do

## Error Handling

- **Use Error Boundaries** for component-level error isolation
- **Display user-friendly messages** — never show stack traces or raw API errors to users
- **Log errors to console in dev** — consider error tracking service (Sentry) in production
- **Handle network errors gracefully** — show retry buttons, not just "something went wrong"

## Testing

See `.claude/rules/testing.md` for detailed testing conventions.

**Frontend-specific:**

- **Test user behavior, not implementation** — don't test state or props directly
- **Query by accessible roles** — `getByRole('button')`, not `getByTestId`
- **Mock API calls** with MSW (Mock Service Worker) in tests
- **Test loading and error states** — not just the happy path
