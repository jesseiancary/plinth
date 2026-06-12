# Security Rules

Always-active security rules based on OWASP Top 10 2025. These rules are enforced during all development activities.

**For detailed examples, patterns, and remediation guidance, see `.claude/skills/security/owasp-top10.md`**

## Enforcement Levels

- **🔴 CRITICAL (Block)**: A01, A02, A03 - Must be fixed before commit
- **🟡 MODERATE (Warn)**: A04, A05, A07 - Strong warnings, review required
- **🔵 ADVISORY**: A06, A08, A09, A10 - Recommendations, optional fixes

---

## 🔴 A01: Broken Access Control (CRITICAL)

### Tenant Isolation Requirements

**NEVER trust client-provided `organizationId`**

❌ `req.body.organizationId`, `req.query.organizationId`, `req.params.organizationId`
✅ `req.tenantId` (from JWT or API key via middleware)

### Checklist for Every Protected Endpoint

- [ ] Route protected with `authenticate` middleware
- [ ] `organizationId` sourced from `req.tenantId` (NEVER from request)
- [ ] Role requirement enforced with `requireRole()` middleware
- [ ] Prisma queries filtered by `organizationId` where applicable
- [ ] Cross-tenant access returns 404 (don't leak org existence to non-members)
- [ ] Horizontal privilege escalation prevented (user A cannot access user B's data)
- [ ] Vertical privilege escalation prevented (member cannot perform admin actions)

### RBAC Edge Cases

- [ ] Owner cannot be removed or demoted by anyone except themselves
- [ ] Last owner protection (cannot remove/demote if only owner remaining)
- [ ] Self-demotion allowed only if other owners exist
- [ ] Admin cannot demote owner

**Detailed access control patterns in `.claude/skills/security/owasp-top10.md`**

---

## 🔴 A02: Security Misconfiguration (CRITICAL)

### Error Response Sanitization

**NEVER expose:**

- Stack traces (development only, sanitized in production)
- Internal file paths
- Database query details
- Environment variables
- Secret values

**ALWAYS use AppError pattern:**

```typescript
throw new AppError('User-friendly message', statusCode, 'ERROR_CODE')
```

### Required Security Headers

✅ Helmet middleware configured with:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security`

### Environment Variable Validation

- [ ] All env vars validated with Zod at startup
- [ ] App fails fast with clear error if vars missing
- [ ] No default secrets (must be explicitly configured)

---

## 🔴 A03: Software Supply Chain Failures (CRITICAL)

### Dependency Management

- [ ] Run `pnpm audit` before every commit (automated in CI)
- [ ] Review all dependency updates (don't auto-merge Dependabot PRs blindly)
- [ ] Pin exact versions in `package.json` (no `^` or `~` in production)
- [ ] Audit licenses (no GPL/AGPL in SaaS without legal review)

### Package Installation

❌ `npm install <package>` without review
✅ Review package on npm, check download stats, review GitHub, then install

---

## 🟡 A04: Cryptographic Failures (MODERATE)

### Password Storage

✅ bcrypt with work factor ≥ 10
❌ Plain text, MD5, SHA-1, SHA-256 (no salt)

### Token Security

✅ SHA-256 hashing for invitation tokens and API keys
✅ Random token generation (crypto.randomBytes, not Math.random)
✅ Single-use enforcement (mark as used after consumption)

### JWT Best Practices

- Access token: 15 minutes expiry
- Refresh token: 7 days expiry, httpOnly cookie
- Strong secret (≥ 32 bytes entropy)

**Detailed crypto patterns in `.claude/skills/security/owasp-top10.md`**

---

## 🟡 A05: Injection (MODERATE)

### SQL Injection Prevention

✅ Prisma query builder (parameterized queries)
❌ `prisma.$queryRawUnsafe()` (only use if absolutely necessary, document why)

### XSS Prevention

**Frontend:**

- ✅ React's default escaping (text content)
- ❌ `dangerouslySetInnerHTML` without DOMPurify

**Backend:**

- ✅ Zod validation on all inputs
- ✅ Sanitize user-generated content before storage

---

## 🟡 A07: Authentication Failures (MODERATE)

### Password Requirements

- Minimum 12 characters (enforced via Zod)
- No password complexity requirements (NIST 800-63B)
- No password expiration

### Rate Limiting

- [ ] Login endpoint: 5 attempts per 15 minutes per IP
- [ ] Registration endpoint: 10 attempts per hour per IP
- [ ] Password reset: 3 attempts per hour per email

### Session Management

- [ ] Refresh token rotation on use
- [ ] Logout invalidates refresh token
- [ ] No long-lived sessions without rotation

---

## 🔵 A06: Insecure Design (ADVISORY)

### Threat Modeling

For sensitive flows (auth, payments, admin actions):

- What can go wrong?
- How would an attacker abuse this?
- What's the worst-case scenario?

**Use `/security-audit` command or `security-auditor` agent for deep analysis**

---

## 🔵 A08-A10: Additional Advisories

### A08: Software and Data Integrity Failures

- [ ] Validate API responses before processing
- [ ] Webhook signature verification (Stripe, GitHub, etc.)
- [ ] CSRF protection on state-changing operations

### A09: Security Logging and Monitoring Failures

- [ ] Log authentication failures
- [ ] Log authorization failures (403)
- [ ] Log critical actions (role changes, owner transfer)
- [ ] Never log sensitive data (passwords, tokens, PII)

### A10: Server-Side Request Forgery (SSRF)

- [ ] Validate webhook URLs before making requests
- [ ] Whitelist allowed domains for external requests
- [ ] No user-controlled redirect targets

---

## General Security Principles

1. **Defense in Depth** — Multiple layers (auth middleware + RBAC + query filters)
2. **Fail Securely** — Default to deny access, not grant
3. **Least Privilege** — Grant minimum permissions needed
4. **Don't Trust Client** — Validate everything from requests
5. **Security by Design** — Consider security from first line of code

---

## Security Review Checklist

Before every commit:

- [ ] No sensitive data logged (passwords, tokens, PII)
- [ ] All inputs validated with Zod
- [ ] Auth middleware on protected routes
- [ ] Tenant isolation enforced (`req.tenantId` used)
- [ ] RBAC enforced with `requireRole()`
- [ ] Error responses sanitized (no stack traces)
- [ ] Security headers configured (helmet)
- [ ] Dependencies audited (`pnpm audit`)
- [ ] Tests cover 401, 403, 404 cases
- [ ] No hardcoded secrets in code

---

## Tools and Resources

- **Command**: `/security-audit` — Comprehensive OWASP Top 10 2025 audit
- **Agent**: `security-auditor` — Specialized security analysis and threat modeling
- **Hook**: `.claude/hooks/security-check.sh` — Pre-commit automated security checks
- **Skill**: `.claude/skills/security/owasp-top10.md` — Detailed guidance, patterns, and examples

---

**Last Updated:** 2026-06-11
**Version:** Streamlined from 820 lines to ~200 lines (detailed examples moved to skills)
