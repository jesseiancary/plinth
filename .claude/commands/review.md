# Review Command

Run a comprehensive pre-PR checklist before creating a pull request.

## Checklist

### Type Safety

- [ ] TypeScript strict mode passes (`pnpm typecheck`)
- [ ] No `any` types introduced
- [ ] All types properly inferred from Zod schemas
- [ ] No type assertions without documentation

### Tests

- [ ] All tests pass (`pnpm test`)
- [ ] New features have integration tests
- [ ] Edge cases are covered (401, 403, 404)
- [ ] Test coverage meets 80% threshold

### OpenAPI Sync

- [ ] New endpoints documented in `openapi.yaml`
- [ ] Hand-written Zod schemas updated in `apps/api/src/lib/validation/`
- [ ] Frontend types regenerated (`pnpm --filter openapi generate:types`)
- [ ] API spec validation passes (`pnpm --filter openapi validate`)

### Security

- [ ] Routes protected with auth middleware
- [ ] `tenantId` sourced from `req.tenantId`, never from request body
- [ ] Role requirements enforced with `requireRole()`
- [ ] All inputs validated with Zod
- [ ] Prisma queries scoped to `organizationId`
- [ ] Error responses don't leak internal details
- [ ] 404 vs 403 decision follows conventions (don't leak org existence)

### RBAC & Multi-Tenancy (Phase 3)

- [ ] Last owner cannot be removed or demoted
- [ ] Owner cannot demote themselves
- [ ] Admin cannot demote owner
- [ ] Cross-tenant access returns 403, not 200 with empty data
- [ ] Invitation tokens are hashed (SHA-256) before storage
- [ ] API keys are hashed (SHA-256) before storage
- [ ] Tokens are single-use (deleted or marked used after acceptance)
- [ ] Token expiry is enforced (72 hours for invitations)
- [ ] User cannot be invited to org they're already a member of

### Edge Cases

- [ ] Expired tokens handled
- [ ] Missing fields validated
- [ ] Invalid IDs return 404
- [ ] Duplicate resources return 409
- [ ] Rate limiting considered

### Code Quality

- [ ] Linter passes (`pnpm lint`)
- [ ] No commented-out code
- [ ] No debug logs (console.log)
- [ ] Descriptive variable names
- [ ] Functions are single-purpose

### Documentation

- [ ] JSDoc for exported functions
- [ ] README updated if needed
- [ ] Migration documented if schema changed
- [ ] Breaking changes noted

### Git

- [ ] Conventional commit messages
- [ ] Branch name follows conventions
- [ ] No secrets committed
- [ ] `.env.example` updated if new vars added

### API Documentation

- [ ] OpenAPI spec validates without errors (`pnpm --filter openapi validate`)
- [ ] All new/modified endpoints documented in `openapi.yaml`
- [ ] Request examples are realistic and copy-pasteable
- [ ] Response examples match actual API responses
- [ ] All error responses documented with examples (400, 401, 403, 404, 409, 410)
- [ ] Descriptions explain when/why to use each endpoint
- [ ] Security requirements clearly stated (bearerAuth, apiKeyAuth, or public)
- [ ] Required roles documented (OWNER, ADMIN, MEMBER)
- [ ] Pagination parameters documented for list endpoints
- [ ] TypeScript types regenerated (`pnpm --filter openapi generate:types`)
- [ ] Generated types compile without errors (`pnpm typecheck`)
- [ ] Endpoints tested in Scalar UI at `/docs`
- [ ] Related endpoints cross-referenced in descriptions

### Developer Experience

- [ ] Error messages are actionable (explain what went wrong and how to fix)
- [ ] Error codes are descriptive (not generic)
- [ ] URL patterns consistent with existing endpoints
- [ ] Field naming consistent across responses (camelCase)
- [ ] Status codes follow conventions (401 auth, 403 authz, 404 not found, 409 conflict)
- [ ] Multi-step workflows documented (if applicable)
- [ ] Edge cases explained in documentation (expiry, last-owner, etc.)

### Frontend (React)

- [ ] Accessibility: semantic HTML (`<button>`, `<nav>`, not `<div onClick>`), keyboard navigation, focus management
- [ ] All inputs have labels (`<label htmlFor>` or `aria-label`)
- [ ] Interactive elements are focusable and have visible focus states
- [ ] Protected routes enforce authentication (wrapped with `ProtectedRoute`)
- [ ] Loading states displayed (skeleton or spinner, not blank screen)
- [ ] Error states displayed with retry action (not just "Something went wrong")
- [ ] Empty states handled (zero results message)
- [ ] Forms validate with Zod before submission
- [ ] Form errors displayed inline with clear messages
- [ ] Submit buttons disabled during loading
- [ ] TanStack Query used for server state (NOT `useState` for API data)
- [ ] Types imported from `@plinth/types` (generated from OpenAPI)
- [ ] React Query cache invalidated after mutations
- [ ] Optimistic updates implemented where appropriate (delete, update operations)
- [ ] Tailwind design tokens used (colors, spacing from `tailwind.config.ts`)
- [ ] No hardcoded colors or spacing values
- [ ] Mobile responsive (tested on small screens, mobile-first breakpoints)
- [ ] Bundle size reasonable (`pnpm build` output reviewed)
- [ ] Components tested with React Testing Library
- [ ] Tests query by accessible roles (`getByRole`, `getByLabelText`), not test IDs
- [ ] API calls mocked with MSW in tests
- [ ] Loading, error, and empty states tested (not just happy path)
