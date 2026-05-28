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
- [ ] Types regenerated (`pnpm --filter openapi generate:types`)
- [ ] Zod schemas regenerated (`pnpm --filter openapi generate:zod`)
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
