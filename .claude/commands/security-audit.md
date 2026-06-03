# Security Audit Command

Comprehensive security audit based on OWASP Top 10 2025.

## Usage

```
/security-audit
```

This command performs a thorough security review of the codebase, identifying vulnerabilities across all OWASP Top 10 2025 categories.

## Audit Scope

The security audit covers both **apps/api** (backend) and **apps/web** (frontend) codebases.

## Audit Process

### 1. Automated Checks

Run automated security scans:

```bash
# Dependency vulnerabilities
pnpm audit --audit-level=moderate

# Check for outdated dependencies
pnpm outdated

# Run security-check hook manually
./.claude/hooks/security-check.sh
```

### 2. Manual Code Review

For each OWASP Top 10 category, systematically review the codebase:

#### 🔴 A01: Broken Access Control (CRITICAL)

**Search Patterns:**

```bash
# Find all route definitions
rg "router\.(get|post|put|patch|delete)" apps/api/src/routes/

# Check for req.body.organizationId usage (VULNERABLE)
rg "req\.body\.organizationId|req\.query\.organizationId|req\.params\.organizationId" apps/api/src/

# Verify req.tenantId usage
rg "req\.tenantId" apps/api/src/

# Find Prisma queries
rg "prisma\.\w+\.(find|create|update|delete)" apps/api/src/
```

**Checklist:**

- [ ] All routes have `authenticate` middleware
- [ ] All org-scoped routes have `requireRole()` middleware
- [ ] No `req.body.organizationId` usage (use `req.tenantId` instead)
- [ ] All Prisma queries filter by `organizationId` for org-scoped resources
- [ ] User-scoped resources validate ownership (`userId === req.user.id`)
- [ ] 404 vs 403 pattern followed correctly
- [ ] RBAC edge cases handled (owner protection, etc.)

#### 🔴 A02: Security Misconfiguration (CRITICAL)

**Search Patterns:**

```bash
# Find error handlers
rg "res\.json.*error|res\.status.*error|throw new" apps/api/src/

# Check for helmet usage
rg "import.*helmet|require.*helmet" apps/api/src/

# Find CORS configuration
rg "cors\(" apps/api/src/

# Find hardcoded secrets
rg -i "(password|secret|api_key|apikey|token)\s*=\s*[\"'][^\"']{8,}" apps/api/src/ apps/web/src/
```

**Checklist:**

- [ ] Helmet middleware configured in app.ts
- [ ] Error handler NEVER exposes stack traces
- [ ] Error handler NEVER exposes DB errors or internal paths
- [ ] CORS restricted to specific origins (not `*`)
- [ ] No hardcoded secrets in code
- [ ] All secrets in environment variables
- [ ] `.env` gitignored, `.env.example` committed

#### 🔴 A03: Software Supply Chain Failures (CRITICAL)

**Search Patterns:**

```bash
# Find eval() usage
rg "\beval\s*\(|new\s+Function\s*\(" apps/api/src/ apps/web/src/

# Find dynamic require()
rg "require\s*\(\s*req\.|require\s*\(\s*\$\{" apps/api/src/

# Check lock file exists
ls -la pnpm-lock.yaml
```

**Checklist:**

- [ ] `pnpm audit` passing (no high/critical)
- [ ] `pnpm-lock.yaml` exists and committed
- [ ] No `eval()` or `new Function()` usage
- [ ] No dynamic `require()` with user input
- [ ] GitHub Dependabot enabled

#### 🟡 A04: Cryptographic Failures (MODERATE)

**Search Patterns:**

```bash
# Find password hashing
rg "password|hash" apps/api/src/ | grep -v "passwordHash|PasswordSchema"

# Find Math.random() usage (WEAK)
rg "Math\.random\(\)" apps/api/src/ apps/web/src/

# Find weak hashing algorithms
rg "createHash\(['\"]md5|createHash\(['\"]sha1" apps/api/src/

# Find token generation
rg "generateToken|randomBytes|random" apps/api/src/

# Find cookie configuration
rg "res\.cookie" apps/api/src/
```

**Checklist:**

- [ ] Passwords hashed with bcrypt (work factor ≥10)
- [ ] Tokens use `crypto.randomBytes()` (NOT `Math.random()`)
- [ ] API keys/tokens hashed before storage (SHA-256)
- [ ] No MD5, SHA1, DES usage
- [ ] Cookies: httpOnly, secure (production), sameSite
- [ ] No sensitive data in logs

#### 🟡 A05: Injection (MODERATE)

**Search Patterns:**

```bash
# Find raw SQL queries (RISKY)
rg "\$queryRaw|\$executeRaw" apps/api/src/

# Find dangerouslySetInnerHTML (XSS RISK)
rg "dangerouslySetInnerHTML" apps/web/src/

# Find exec/spawn (COMMAND INJECTION RISK)
rg "exec\(|spawn\(|execFile\(" apps/api/src/

# Find Prisma queries
rg "prisma\.\w+\.(find|create)" apps/api/src/
```

**Checklist:**

- [ ] All inputs validated with Zod
- [ ] Prisma ORM used (no `$queryRawUnsafe`)
- [ ] If raw SQL: parameterized with template literals
- [ ] No `dangerouslySetInnerHTML` without DOMPurify
- [ ] No shell commands with user input
- [ ] Content-Security-Policy configured

#### 🟡 A07: Authentication Failures (MODERATE)

**Search Patterns:**

```bash
# Find JWT configuration
rg "jwt\.sign|jwt\.verify" apps/api/src/

# Find password schema
rg "PasswordSchema|password.*regex" apps/api/src/

# Find rate limiting
rg "rateLimit|rate-limit" apps/api/src/

# Find token storage (frontend)
rg "localStorage.*token|sessionStorage.*token" apps/web/src/
```

**Checklist:**

- [ ] Access tokens short-lived (≤15 minutes)
- [ ] Refresh tokens httpOnly cookies
- [ ] Refresh token rotation implemented
- [ ] Password policy: 8+ chars, mixed case, numbers, symbols
- [ ] Rate limiting on /login, /register (5 per 15 min)
- [ ] Password reset tokens: single-use, 1-hour expiry
- [ ] No tokens in localStorage

#### 🔵 A06: Insecure Design (ADVISORY)

**Search Patterns:**

```bash
# Find rate limiting
rg "rateLimit" apps/api/src/

# Find business logic validation
rg "if.*count|if.*exists" apps/api/src/controllers/
```

**Checklist:**

- [ ] Rate limiting on expensive operations
- [ ] Invitation abuse prevention (limits per org/day)
- [ ] Business logic validation (can't invite existing member, etc.)
- [ ] Threat modeling done for new features

#### 🔵 A08: Data Integrity (ADVISORY)

**Search Patterns:**

```bash
# Find JWT verification
rg "jwt\.verify" apps/api/src/

# Find signature validation
rg "signature|verify.*signature" apps/api/src/
```

**Checklist:**

- [ ] JWT signatures verified (not just decoded)
- [ ] Webhook signatures validated (future: Stripe)

#### 🔵 A09: Logging/Alerting (ADVISORY)

**Search Patterns:**

```bash
# Find logging
rg "logger\.|console\." apps/api/src/

# Find security events
rg "FAILED_LOGIN|UNAUTHORIZED|FORBIDDEN" apps/api/src/
```

**Checklist:**

- [ ] Failed login attempts logged
- [ ] 403 authorization failures logged
- [ ] Unexpected errors logged server-side
- [ ] No sensitive data in logs

#### 🔵 A10: Exception Handling (ADVISORY)

**Search Patterns:**

```bash
# Find error handlers
rg "process\.on.*unhandledRejection|process\.on.*uncaughtException" apps/api/src/

# Find try/catch
rg "try\s*\{" apps/api/src/
```

**Checklist:**

- [ ] Global error handler configured
- [ ] All async operations in try/catch
- [ ] Unhandled promise rejections caught
- [ ] Input validation handles edge cases (null, undefined, empty)

### 3. Test Coverage Review

```bash
# Check test coverage
pnpm --filter api test:coverage

# Verify security test cases exist
rg "returns 401|returns 403|returns 404" apps/api/src/**/*.test.ts
```

**Required Tests:**

- [ ] 401 tests (unauthenticated)
- [ ] 403 tests (insufficient role)
- [ ] 404 tests (resource not found)
- [ ] Cross-tenant access tests
- [ ] Horizontal privilege escalation tests
- [ ] RBAC edge case tests (last owner, etc.)

### 4. Dependency Review

```bash
# List all dependencies
pnpm list --depth=0

# Check for known vulnerabilities
pnpm audit

# Check for outdated packages
pnpm outdated
```

**Review each new dependency:**

- [ ] Package reputation (downloads, stars, maintainer)
- [ ] No typosquatting (correct spelling?)
- [ ] Active maintenance (recent commits?)
- [ ] License compatibility
- [ ] No suspicious code in source

### 5. Configuration Review

**Backend (.env validation):**

```bash
# apps/api/src/config/env.ts
```

- [ ] All required variables validated with Zod
- [ ] App fails fast on missing variables
- [ ] No default secrets in code

**Frontend (build configuration):**

```bash
# vite.config.ts
```

- [ ] CSP configured in index.html
- [ ] No sensitive data in client bundle
- [ ] SRI hashes for CDN assets (if applicable)

### 6. Generate Security Report

After completing the audit, create a summary report:

```markdown
# Security Audit Report - [DATE]

## Executive Summary

- **Audit Scope:** apps/api + apps/web
- **Critical Issues Found:** [N]
- **Moderate Issues Found:** [N]
- **Advisory Items:** [N]

## Critical Issues (🔴)

### [Issue Title]

- **Category:** A0X: [Vulnerability]
- **Location:** [file:line]
- **Description:** [what's wrong]
- **Impact:** [potential damage]
- **Remediation:** [how to fix]

## Moderate Issues (🟡)

[same format]

## Advisory Items (🔵)

[same format]

## Recommendations

1. [priority 1]
2. [priority 2]
   ...

## Next Steps

- [ ] Fix critical issues immediately
- [ ] Address moderate issues within 1 week
- [ ] Review advisory items for future sprints
```

## Automation

For ongoing security monitoring, consider adding to CI:

```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level=moderate
      - run: ./.claude/hooks/security-check.sh
```

## Follow-Up

After addressing issues:

1. Re-run `/security-audit`
2. Verify all critical issues resolved
3. Update test coverage
4. Document any accepted risks
5. Schedule next audit (quarterly recommended)

## Resources

- `.claude/skills/security/owasp-top10.md` - Detailed prevention strategies
- `.claude/rules/security.md` - Security rules reference
- `.claude/hooks/security-check.sh` - Automated security validation
- `docs/SECURITY.md` - Public security policy
