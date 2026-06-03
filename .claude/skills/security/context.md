# Security Skill Context

Auto-loaded when working on security-related tasks.

## When This Skill is Loaded

This skill is automatically activated when:

- Working on authentication or authorization code
- Adding new endpoints with access control requirements
- Investigating or fixing security vulnerabilities
- Conducting security reviews or audits
- Implementing cryptographic operations
- Handling sensitive data (passwords, tokens, API keys)
- Configuring security headers or middleware
- Working with input validation and sanitization
- Addressing dependency vulnerabilities
- Implementing rate limiting or abuse prevention

## Primary Resources

### Comprehensive Guide

[owasp-top10.md](./owasp-top10.md) - Full OWASP Top 10 2025 implementation guide for this stack

### Quick Reference

Consult `owasp-top10.md` for:

- Detailed vulnerability descriptions
- Attack scenarios specific to Node.js + Express + React + Prisma
- Prevention strategies with code examples
- Testing requirements
- Implementation checklists

## Security Framework Summary

### Graduated Enforcement

**🔴 CRITICAL (Block on commit via security-check.sh hook):**

- **A01: Broken Access Control** - Tenant isolation, RBAC, horizontal/vertical escalation prevention
- **A02: Security Misconfiguration** - Helmet headers, error sanitization, secrets management
- **A03: Supply Chain Failures** - Dependency auditing, no eval(), lock file committed

**🟡 MODERATE (Warn on commit):**

- **A04: Cryptographic Failures** - bcrypt passwords, crypto.randomBytes, secure cookies
- **A05: Injection** - Prisma ORM, XSS prevention, input validation
- **A07: Authentication Failures** - JWT best practices, password policy, rate limiting

**🔵 ADVISORY (Guidance only):**

- **A06: Insecure Design** - Threat modeling, rate limiting, business logic validation
- **A08: Data Integrity** - JWT verification, webhook signatures
- **A09: Logging/Alerting** - Security event logging, monitoring
- **A10: Exception Handling** - Error handlers, unhandled rejections

## Quick Reference Patterns

### A01: Tenant Isolation (HIGHEST PRIORITY)

```typescript
// ✅ ALWAYS - Server-derived organizationId
app.get('/api/v1/orgs/:slug/data', authenticate, requireRole('MEMBER'), async (req, res) => {
  const data = await prisma.data.findMany({
    where: { organizationId: req.tenantId }, // From JWT/API key
  })
  res.json(data)
})

// ❌ NEVER - Client-provided organizationId
const data = await prisma.data.findMany({
  where: { organizationId: req.body.organizationId }, // SECURITY BUG
})
```

### A02: Error Sanitization

```typescript
// ✅ SECURE - Sanitized error response
if (err instanceof AppError) {
  return res.status(err.statusCode).json({
    error: {
      code: err.code,
      message: err.message,
      details: err.details,
    },
  })
}

// Generic for unexpected errors
res.status(500).json({
  error: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: {}, // NO stack, NO internals
  },
})
```

### A04: Password Hashing

```typescript
// ✅ SECURE - bcrypt with work factor ≥10
import bcrypt from 'bcrypt'

const passwordHash = await bcrypt.hash(password, 10)
const isValid = await bcrypt.compare(password, user.passwordHash)

// ❌ NEVER - MD5, SHA1, SHA256 for passwords
const hash = crypto.createHash('md5').update(password).digest('hex')
```

### A05: SQL Injection Prevention

```typescript
// ✅ SECURE - Prisma ORM (parameterized)
const users = await prisma.user.findMany({
  where: { email: req.body.email },
})

// ⚠️ If raw SQL needed - parameterized template literal
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${req.body.email}
`

// ❌ NEVER - String concatenation
const users = await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${req.body.email}'`)
```

## Security Checklist (New Endpoints)

Before completing any new endpoint, verify:

**Access Control (A01):**

- [ ] `authenticate` middleware applied
- [ ] `req.tenantId` used (NEVER `req.body.organizationId`)
- [ ] `requireRole()` middleware enforces role
- [ ] Prisma queries filter by `organizationId`
- [ ] Horizontal escalation prevented (user ownership validated)
- [ ] 404 vs 403 pattern followed

**Input Validation (A05):**

- [ ] Zod schema validates all inputs
- [ ] No `$queryRawUnsafe`
- [ ] No `dangerouslySetInnerHTML` without DOMPurify

**Configuration (A02):**

- [ ] Error responses sanitized
- [ ] No hardcoded secrets
- [ ] Security headers configured (helmet)

**Testing:**

- [ ] Tests cover 401, 403, 404 cases
- [ ] Cross-tenant access test
- [ ] Horizontal escalation test

## Common Security Tasks

### Adding Protected Endpoint

1. Apply `authenticate` middleware
2. Apply `requireRole()` with minimum required role
3. Use `req.tenantId` for organizationId
4. Filter Prisma queries by `organizationId`
5. Validate inputs with Zod
6. Test 401, 403, 404 cases

### Implementing Cryptographic Operation

1. Check owasp-top10.md → A04 Cryptographic Failures
2. Use bcrypt for passwords (work factor ≥10)
3. Use crypto.randomBytes() for tokens (NEVER Math.random)
4. Hash tokens (SHA-256) before storage
5. Mark cookies httpOnly, secure (production), sameSite

### Fixing Injection Vulnerability

1. Check owasp-top10.md → A05 Injection
2. Use Prisma ORM (avoid raw SQL)
3. If raw SQL needed: use $queryRaw with template literals
4. For React: use auto-escaping, avoid dangerouslySetInnerHTML
5. If HTML rendering needed: sanitize with DOMPurify

### Security Review / Audit

1. Run `/security-audit` command
2. Review output from security-auditor agent
3. Check owasp-top10.md for detailed prevention strategies
4. Apply fixes for flagged issues
5. Re-run security-check.sh hook
6. Update tests to cover new security requirements

## Related Files

- `.claude/rules/security.md` - Always-active security rules
- `.claude/hooks/security-check.sh` - Pre-commit validation
- `.claude/agents/code-reviewer.json` - Enhanced with OWASP focus
- `.claude/agents/security-auditor.json` - Specialized security auditing
- `.claude/commands/security-audit.md` - On-demand security audit workflow
- `docs/SECURITY.md` - Public security policy & vulnerability reporting

## Stack-Specific Guidance

This skill provides security guidance tailored to:

- **Backend:** Node.js 20+, Express 4.x, TypeScript 5.x, Prisma 6.x
- **Frontend:** React 19, Vite 8, TanStack Query 5
- **Database:** PostgreSQL 16+
- **Auth:** JWT (access + refresh), bcrypt password hashing
- **Validation:** Zod 3.x
- **Security:** helmet, express-rate-limit, CORS

## Key Principles

1. **Defense in Depth:** Multiple layers of security (network, app, data, monitoring)
2. **Fail Securely:** Errors deny access by default
3. **Least Privilege:** Users get minimum required permissions
4. **Never Trust Client Input:** All inputs validated server-side
5. **Graduated Enforcement:** Block critical, warn moderate, advise low priority

## When to Escalate

If you encounter:

- **Suspected vulnerability in dependencies:** Run `pnpm audit`, check GitHub Security Advisories
- **Complex security decision:** Consult owasp-top10.md detailed sections
- **Novel attack vector:** Review threat modeling section (A06)
- **Incident response needed:** Check A09 for logging requirements

## Additional Resources

- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/
- Prisma Security: https://www.prisma.io/docs/guides/database/advanced-database-tasks/sql-injection
- Express Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html
- React Security: https://react.dev/learn/escape-hatches
