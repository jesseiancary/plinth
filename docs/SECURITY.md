# Security Policy

## Reporting a Vulnerability

We take the security of Plinth seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** open a public GitHub issue for security vulnerabilities.

Instead, please email security reports to: **[your-email@example.com]**

Include in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

### What to Expect

- **Acknowledgment:** Within 48 hours
- **Assessment:** Initial triage within 1 week
- **Fix Timeline:**
  - Critical: 24-48 hours
  - High: 1 week
  - Moderate: 1 month
- **Disclosure:** Coordinated disclosure after fix is deployed

We will keep you informed throughout the process and credit you in the security advisory (unless you prefer to remain anonymous).

---

## Security Framework

Plinth implements security controls based on the **OWASP Top 10 2025** framework with graduated enforcement:

### 🔴 Critical (Automated Blocking)

- **A01: Broken Access Control** - Multi-tenant isolation, RBAC enforcement
- **A02: Security Misconfiguration** - Security headers, error sanitization
- **A03: Supply Chain Failures** - Dependency scanning, integrity verification

### 🟡 Moderate (Warnings + Manual Review)

- **A04: Cryptographic Failures** - Strong hashing, secure token generation
- **A05: Injection** - Input validation, parameterized queries
- **A07: Authentication Failures** - JWT best practices, password policies

### 🔵 Advisory (Best Practices)

- **A06: Insecure Design** - Threat modeling, rate limiting
- **A08: Data Integrity** - Signature verification
- **A09: Logging/Alerting** - Security event monitoring
- **A10: Exception Handling** - Proper error handling

---

## Security Features

### Authentication & Authorization

**JWT-Based Authentication:**

- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens in httpOnly cookies (7 days)
- Automatic token rotation on refresh
- Secure cookie configuration (httpOnly, secure, sameSite)

**Password Security:**

- bcrypt hashing with work factor 10+
- Strong password requirements (8+ chars, mixed case, numbers, symbols)
- Secure password reset flow (1-hour single-use tokens)

**Multi-Tenant Isolation:**

- Server-side tenant ID enforcement (never trust client input)
- All queries scoped to authenticated user's organization
- Cross-tenant access blocked with 403/404 responses

**Role-Based Access Control (RBAC):**

- Three roles: Owner, Admin, Member
- Hierarchical permissions enforcement
- Protected RBAC edge cases (last owner, owner demotion, etc.)

### Data Protection

**Encryption:**

- HTTPS enforced in production
- Sensitive cookies encrypted (httpOnly, secure)
- API keys hashed (SHA-256) before storage
- Invitation tokens hashed before storage

**Input Validation:**

- Zod schema validation on all inputs
- Parameterized queries via Prisma ORM
- XSS prevention via React auto-escaping
- Content Security Policy (CSP) headers

**Error Handling:**

- Stack traces never exposed to clients
- Database errors sanitized
- Generic error messages for unexpected failures
- Detailed logging server-side only

### Infrastructure Security

**Security Headers:**

- Content-Security-Policy (XSS protection)
- Strict-Transport-Security (HSTS)
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options (MIME sniffing protection)

**Dependency Management:**

- Automated vulnerability scanning (pnpm audit)
- Lock file committed (deterministic builds)
- GitHub Dependabot for security updates
- Monthly dependency review

**Rate Limiting:**

- Authentication endpoints: 5 requests per 15 minutes
- API endpoints: 1000 requests per 15 minutes per user
- Expensive operations: 100 requests per hour per organization

---

## Security Best Practices

### For Developers

**Before Committing:**

1. Run `pnpm typecheck` (no type errors)
2. Run `pnpm test` (all tests pass)
3. Run `./.claude/hooks/security-check.sh` (no critical issues)
4. Run `pnpm audit` (no high/critical vulnerabilities)

**When Adding Endpoints:**

1. Apply `authenticate` middleware
2. Apply `requireRole()` with minimum required role
3. Use `req.tenantId` for organizationId (NEVER `req.body.organizationId`)
4. Filter Prisma queries by `organizationId`
5. Validate ALL inputs with Zod
6. Test 401, 403, 404 cases

**When Handling Sensitive Data:**

1. Hash passwords with bcrypt (work factor ≥10)
2. Generate tokens with crypto.randomBytes() (NEVER Math.random())
3. Hash tokens/API keys before storage (SHA-256)
4. Never log passwords, tokens, or PII
5. Use httpOnly cookies for tokens (NOT localStorage)

### For Users

**Account Security:**

- Use a strong, unique password (8+ characters, mixed case, numbers, symbols)
- Enable account notifications for security events
- Review organization members regularly
- Rotate API keys periodically

**API Key Management:**

- Store API keys securely (environment variables, secrets manager)
- Never commit API keys to version control
- Use scoped API keys (limit permissions)
- Delete unused API keys promptly

**Suspicious Activity:**
If you notice unusual activity:

1. Change your password immediately
2. Revoke all API keys
3. Review organization members for unauthorized access
4. Contact support: **[your-email@example.com]**

---

## Dependency Update Policy

| Severity     | Action                         | Timeline  |
| ------------ | ------------------------------ | --------- |
| **Critical** | Emergency patch + deploy       | 24 hours  |
| **High**     | Patch in next release          | 1 week    |
| **Moderate** | Patch in next scheduled update | 1 month   |
| **Low**      | Patch when convenient          | Quarterly |

We use:

- **pnpm audit** for vulnerability scanning
- **GitHub Dependabot** for automated security updates
- **Snyk** (planned) for continuous monitoring

---

## Security Testing

### Automated Testing

**CI Pipeline:**

- TypeScript type checking
- ESLint security rules
- Dependency vulnerability scanning (pnpm audit)
- Integration tests (87+ tests, 91%+ coverage)
- Security-check hook (blocks critical issues)

**Security Test Coverage:**

- Authentication failures (401 tests)
- Authorization failures (403 tests)
- Resource not found (404 tests)
- Cross-tenant access prevention
- Horizontal privilege escalation prevention
- RBAC edge cases (owner protection, last owner, etc.)

### Manual Security Reviews

**Quarterly Security Audits:**

1. OWASP Top 10 compliance check
2. Code review for security patterns
3. Dependency vulnerability assessment
4. Configuration security review
5. Threat modeling for new features

**Pre-Release Security Checklist:**

- All tests passing
- No high/critical vulnerabilities
- Security headers configured
- Error responses sanitized
- RBAC enforcement verified
- Multi-tenant isolation validated

---

## Known Limitations

### Current Security Posture

**Implemented:**

- ✅ Multi-tenant isolation (A01)
- ✅ Security headers (A02)
- ✅ Dependency scanning (A03)
- ✅ Password hashing (A04)
- ✅ Input validation (A05)
- ✅ JWT authentication (A07)

**Planned Enhancements:**

- ⏳ Rate limiting on all endpoints (currently auth only)
- ⏳ Multi-factor authentication (MFA)
- ⏳ Account lockout after failed attempts
- ⏳ Security event alerting
- ⏳ Audit logging dashboard
- ⏳ Webhook signature validation (Stripe)

**Out of Scope:**

- ❌ Client-side encryption (use HTTPS)
- ❌ Perfect forward secrecy (future consideration)
- ❌ Biometric authentication (device-dependent)

### Threat Model

**In Scope:**

- External attackers (unauthenticated)
- Malicious users (authenticated, attempting privilege escalation)
- Compromised accounts (stolen credentials)
- Supply chain attacks (malicious dependencies)

**Out of Scope:**

- Physical access to servers (responsibility of hosting provider)
- Social engineering of support staff (no phone support)
- DDoS attacks (mitigated by hosting provider)

---

## Compliance

**Data Protection:**

- GDPR-ready architecture (user data deletion, export)
- No PII in logs or error messages
- Secure password storage (bcrypt)
- Encrypted data in transit (HTTPS)

**Industry Standards:**

- OWASP Top 10 2025 compliance
- CWE coverage (280+ common weakness enumerations)
- NIST Cybersecurity Framework alignment (planned)

**Third-Party Services:**

- GitHub (code hosting, Dependabot)
- Railway/Vercel (hosting, TLS termination)
- Resend (email delivery, DKIM/SPF)

---

## Security Contact

For security-related inquiries:

- **Email:** [your-email@example.com]
- **PGP Key:** [link to public key] (optional)
- **Response Time:** Within 48 hours

For general support:

- **GitHub Issues:** https://github.com/your-org/plinth/issues
- **Documentation:** https://github.com/your-org/plinth/tree/main/docs

---

## Security Changelog

### 2026-06-02

- ✅ Integrated OWASP Top 10 2025 framework
- ✅ Added security-check pre-commit hook
- ✅ Enhanced code-reviewer agent with OWASP focus
- ✅ Created security-auditor agent for vulnerability assessment
- ✅ Documented security framework in CLAUDE.md

### 2026-05-28

- ✅ Completed Phase 3 (Multi-Tenancy Core)
- ✅ Implemented RBAC with owner protection
- ✅ Added invitation system with token hashing (SHA-256)
- ✅ Implemented API key management with hashing
- ✅ Achieved 91%+ test coverage (87 tests)

### 2026-05-27

- ✅ Completed Phase 2 (Authentication)
- ✅ Implemented JWT access + refresh tokens
- ✅ Added bcrypt password hashing
- ✅ Configured httpOnly cookies for refresh tokens

---

## Acknowledgments

We thank the security researchers who have responsibly disclosed vulnerabilities:

- [Researcher Name] - [Vulnerability] - [Date] - [Bounty/Credit]

_(None yet - this is a new project)_

---

## License

This security policy applies to the Plinth SaaS Starter project. For licensing information, see [LICENSE](../LICENSE).

---

**Last Updated:** 2026-06-02
