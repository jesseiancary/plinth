# Fix Issue Command

Structured approach to debugging and fixing bugs.

## Investigation Process

### 1. Reproduce

- [ ] Understand the issue description
- [ ] Identify steps to reproduce
- [ ] Verify the bug exists
- [ ] Note any error messages or stack traces

### 2. Isolate

- [ ] Identify which component/module is failing
- [ ] Check recent changes (git log)
- [ ] Review related code
- [ ] Add debug logging if needed
- [ ] Check for similar issues in codebase

### 3. Diagnose

- [ ] Form hypothesis about root cause
- [ ] Verify hypothesis with tests or logs
- [ ] Identify affected code paths
- [ ] Check for edge cases

### 4. Fix

- [ ] Implement the fix
- [ ] Add test that would have caught the bug
- [ ] Verify fix resolves the issue
- [ ] Check for regressions
- [ ] Update documentation if needed

### 5. Test

- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Manual testing of fix
- [ ] Test edge cases
- [ ] Verify no new bugs introduced

## Common Bug Patterns

### Authentication Issues

- Missing or invalid JWT token
- Expired token not refreshed
- Wrong token validation logic
- Missing auth middleware

### Validation Errors

- Zod schema doesn't match input
- Missing required fields
- Wrong data types
- Edge case not handled (empty string, null, etc.)

### Database Issues

- Missing `organizationId` filter (tenant isolation bug!)
- N+1 query problem
- Missing index causing slow queries
- Race condition in concurrent operations

### Logic Errors

- Off-by-one errors
- Wrong comparison operator
- Missing null check
- Incorrect type coercion

## Debugging Tools

### API Debugging

```typescript
// Add request logging
logger.info('Request:', { method: req.method, url: req.url, body: req.body })

// Add Prisma query logging
const result = await prisma.user.findMany({
  where: { organizationId: tenantId },
})
logger.info('Query result:', result)

// Check middleware execution
logger.info('req.tenantId:', req.tenantId)
logger.info('req.user:', req.user)
```

### Database Debugging

```bash
# Check database state
pnpm --filter api prisma studio

# Run raw SQL query
pnpm --filter api prisma db execute --stdin < query.sql

# Check migration status
pnpm --filter api prisma migrate status
```

### Test Debugging

```typescript
// Use test.only to focus on failing test
it.only('should fix the bug', async () => {
  // test code
})

// Add debug output
logger.info('Test state:', { user, org, membership })
```

## Checklist

- [ ] Bug reproduced
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Test added to prevent regression
- [ ] All tests pass
- [ ] No new bugs introduced
- [ ] Code reviewed for similar issues
- [ ] Documentation updated if needed
