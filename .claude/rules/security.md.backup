# Security Rules

Always-active security rules based on OWASP Top 10 2025. These rules are enforced during all development activities.

## Enforcement Levels

- **🔴 CRITICAL (Block)**: A01, A02, A03 - Must be fixed before commit
- **🟡 MODERATE (Warn)**: A04, A05, A07 - Strong warnings, review required
- **🔵 ADVISORY**: A06, A08, A09, A10 - Recommendations, optional fixes

---

## 🔴 A01: Broken Access Control (CRITICAL)

### Tenant Isolation Rules

**CRITICAL:** All organization-scoped resources MUST enforce tenant isolation.

```typescript
// ❌ NEVER - Client-provided organizationId
const members = await prisma.membership.findMany({
  where: { organizationId: req.body.organizationId }, // SECURITY BUG
})

// ✅ ALWAYS - Server-derived organizationId from auth context
const members = await prisma.membership.findMany({
  where: { organizationId: req.tenantId }, // From JWT or API key
})
```

### Checklist for Every Endpoint

- [ ] Route protected with `authenticate` middleware
- [ ] `organizationId` sourced from `req.tenantId` (NEVER from request body/query/params)
- [ ] Role requirement enforced with `requireRole()` middleware
- [ ] Prisma queries filtered by `organizationId` where applicable
- [ ] Cross-tenant access returns 404 or 403 (never leaks existence)
- [ ] Horizontal privilege escalation prevented (user A cannot access user B's resources)
- [ ] Vertical privilege escalation prevented (member cannot perform admin actions)

### Access Control Patterns

#### Pattern 1: Organization Resource Access

```typescript
// REQUIRED: Verify user is org member AND resource belongs to org
export const getResource = async (req: Request, res: Response) => {
  const { slug, resourceId } = req.params
  const tenantId = req.tenantId! // Set by requireRole middleware

  const resource = await prisma.resource.findFirst({
    where: {
      id: resourceId,
      organizationId: tenantId, // CRITICAL: Filter by tenant
    },
  })

  if (!resource) {
    throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND')
  }

  res.json(resource)
}
```

#### Pattern 2: User-Owned Resource Access

```typescript
// REQUIRED: Verify resource belongs to authenticated user
export const getUserResource = async (req: Request, res: Response) => {
  const { resourceId } = req.params
  const userId = req.user!.id // From JWT

  const resource = await prisma.userResource.findFirst({
    where: {
      id: resourceId,
      userId, // CRITICAL: Filter by user
    },
  })

  if (!resource) {
    throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND')
  }

  res.json(resource)
}
```

#### Pattern 3: RBAC Edge Cases

```typescript
// REQUIRED: Handle owner/admin/member edge cases
export const updateMemberRole = async (req: Request, res: Response) => {
  const { userId } = req.params
  const { role: newRole } = req.body
  const tenantId = req.tenantId!
  const actorMembership = req.membership! // Authenticated user's membership

  const targetMembership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: tenantId,
      },
    },
  })

  if (!targetMembership) {
    throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND')
  }

  // CRITICAL: Prevent owner demotion by non-owners
  if (targetMembership.role === 'OWNER' && actorMembership.role !== 'OWNER') {
    throw new AppError('Cannot demote owner', 403, 'CANNOT_DEMOTE_OWNER')
  }

  // CRITICAL: Prevent self-demotion for owners
  if (userId === req.user!.id && targetMembership.role === 'OWNER') {
    throw new AppError('Cannot demote yourself', 403, 'CANNOT_DEMOTE_SELF')
  }

  // Update role
  await prisma.membership.update({
    where: { id: targetMembership.id },
    data: { role: newRole },
  })

  res.status(204).send()
}
```

### 404 vs 403 Decision Matrix

Use 404 when the user shouldn't know if the resource exists (prevents information leakage):

```
Request → Valid auth? NO → 401 UNAUTHENTICATED
       → Org exists? NO → 404 ORG_NOT_FOUND (don't leak existence)
       → User is member? NO → 403 NOT_ORG_MEMBER
       → Sufficient role? NO → 403 FORBIDDEN
       → Resource exists? NO → 404 RESOURCE_NOT_FOUND
       → Success → 200/201/204
```

### Testing Requirements

Every protected endpoint MUST have tests for:

- [ ] 401 when not authenticated
- [ ] 404 when org doesn't exist
- [ ] 403 when user is not org member
- [ ] 403 when user has insufficient role
- [ ] 404 when resource doesn't exist
- [ ] 403 when attempting horizontal privilege escalation (accessing another user's resource)
- [ ] 200/201/204 when authorized

---

## 🔴 A02: Security Misconfiguration (CRITICAL)

### Required Security Headers

**CRITICAL:** All HTTP responses MUST include security headers.

Use `helmet` middleware to set:

```typescript
import helmet from 'helmet'

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline in production
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    noSniff: true,
    xssFilter: true,
  }),
)
```

### Required Headers Checklist

- [ ] `Content-Security-Policy` - Prevents XSS attacks
- [ ] `Strict-Transport-Security` - Forces HTTPS
- [ ] `X-Frame-Options: DENY` - Prevents clickjacking
- [ ] `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- [ ] `X-XSS-Protection: 1; mode=block` - Browser XSS protection
- [ ] `Referrer-Policy: no-referrer` - Limits referrer information
- [ ] `Permissions-Policy` - Disables unnecessary browser features

### Environment-Specific Configuration

```typescript
// CRITICAL: Different settings for dev vs production
if (process.env.NODE_ENV === 'production') {
  // Strict CSP in production
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], // NO unsafe-inline
          styleSrc: ["'self'"],
        },
      },
    }),
  )
} else {
  // Relaxed CSP for development
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disabled for hot reload
    }),
  )
}
```

### Error Handling Security

**CRITICAL:** Never expose stack traces, internal paths, or sensitive details in production.

```typescript
// ❌ NEVER - Leaks internal information
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.stack, // SECURITY BUG
    message: err.message,
    query: req.query, // May contain sensitive data
  })
})

// ✅ ALWAYS - Safe error response
app.use((err, req, res, next) => {
  // Log full error server-side
  logger.error('Unhandled error', {
    error: err,
    stack: err.stack,
    url: req.url,
    method: req.method,
  })

  // Return sanitized error to client
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details, // Only pre-approved details
      },
    })
  } else {
    // Generic error for unexpected failures
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        details: {},
      },
    })
  }
})
```

### CORS Configuration

```typescript
// CRITICAL: Restrict CORS to known origins
import cors from 'cors'

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? ['https://app.example.com', 'https://www.example.com']
    : ['http://localhost:5173', 'http://localhost:3000']

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true, // Allow cookies
    maxAge: 86400, // 24 hours
  }),
)
```

### Configuration Checklist

- [ ] `helmet` middleware configured and applied
- [ ] CORS restricted to known origins
- [ ] Stack traces never sent to client in production
- [ ] Sensitive config (DB URLs, secrets) in environment variables
- [ ] Default accounts disabled or removed
- [ ] Unnecessary features/endpoints disabled
- [ ] Security patches applied regularly

---

## 🔴 A03: Software Supply Chain Failures (CRITICAL)

### Dependency Management Rules

**CRITICAL:** All dependencies MUST be audited and kept up to date.

### Required CI Checks

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
      - name: Audit dependencies
        run: pnpm audit --audit-level=high
      - name: Check for outdated deps
        run: pnpm outdated || true
```

### Dependency Checklist

- [ ] `pnpm audit` runs in CI pipeline (fail on high/critical)
- [ ] Dependencies updated monthly (security patches immediately)
- [ ] No dependencies with known high/critical CVEs
- [ ] Lock file (`pnpm-lock.yaml`) committed to version control
- [ ] Dependencies pinned to specific versions (no `^` or `~` for critical deps)
- [ ] Private registry authentication secured (if applicable)
- [ ] `.npmrc` not committed with tokens

### Prohibited Patterns

```typescript
// ❌ NEVER - Executing arbitrary code from dependencies
const userModule = require(req.body.moduleName) // SECURITY BUG

// ❌ NEVER - Unsafe dependency loading
eval(fs.readFileSync('./node_modules/package/index.js')) // SECURITY BUG

// ✅ ALWAYS - Static imports only
import { safeFunction } from 'trusted-package'
```

### Supply Chain Attack Prevention

```typescript
// CRITICAL: Validate integrity of external resources
// Use Subresource Integrity (SRI) for CDN assets in frontend

// ❌ NEVER - Unverified CDN script
<script src="https://cdn.example.com/lib.js"></script>

// ✅ ALWAYS - SRI hash verification
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous"
></script>
```

### Update Policy

- **Critical vulnerabilities**: Patch within 24 hours
- **High vulnerabilities**: Patch within 1 week
- **Medium vulnerabilities**: Patch within 1 month
- **Low vulnerabilities**: Patch in next scheduled update

### Monitoring Tools

- [ ] GitHub Dependabot enabled (automated PRs for security updates)
- [ ] `pnpm audit` in pre-commit hook (warn only, don't block)
- [ ] Snyk or similar scanning tool configured (optional)

---

## 🟡 A04: Cryptographic Failures (MODERATE)

### Cryptographic Requirements

**WARN:** All sensitive data MUST be encrypted at rest and in transit.

### Password Hashing

```typescript
// ✅ ALWAYS - bcrypt with sufficient work factor
import bcrypt from 'bcrypt'

const BCRYPT_WORK_FACTOR = 10 // Minimum 10, 12+ recommended

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_WORK_FACTOR)
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// ❌ NEVER - Plain text passwords
const user = await prisma.user.create({
  data: { password: req.body.password }, // SECURITY BUG
})

// ❌ NEVER - Weak hashing algorithms
import crypto from 'crypto'
const hash = crypto.createHash('md5').update(password).digest('hex') // SECURITY BUG
```

### Token Generation

```typescript
// ✅ ALWAYS - Cryptographically secure random tokens
import crypto from 'crypto'

export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex') // 256 bits
}

// ❌ NEVER - Math.random for security-sensitive tokens
const token = Math.random().toString(36) // SECURITY BUG
```

### Token/Key Hashing

```typescript
// ✅ ALWAYS - Hash tokens before storing
import crypto from 'crypto'

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Store hash, return plaintext only once
export const createApiKey = async (orgId: string, name: string) => {
  const plainKey = `sk_live_${generateToken()}`
  const hashedKey = hashToken(plainKey)

  await prisma.apiKey.create({
    data: {
      hashedKey, // Store hash only
      name,
      organizationId: orgId,
    },
  })

  // Return plaintext ONCE - never stored
  return plainKey
}
```

### TLS/HTTPS Enforcement

```typescript
// CRITICAL: Redirect HTTP to HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`)
  }
  next()
})

// Cookies MUST be secure in production
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}
```

### Cryptographic Checklist

- [ ] Passwords hashed with bcrypt (work factor ≥10)
- [ ] Tokens generated with `crypto.randomBytes`, never `Math.random`
- [ ] API keys/tokens hashed (SHA-256) before storage
- [ ] Sensitive cookies marked `httpOnly`, `secure`, `sameSite`
- [ ] TLS 1.2+ enforced (no SSLv3, TLS 1.0, TLS 1.1)
- [ ] No sensitive data in logs (passwords, tokens, credit cards)
- [ ] Encryption keys stored in environment variables, never committed

### Prohibited Patterns

```typescript
// ❌ NEVER - Logging sensitive data
logger.info('User login', { email, password }) // SECURITY BUG

// ❌ NEVER - Weak algorithms
const hash = crypto.createHash('md5').update(data).digest('hex') // SECURITY BUG
const cipher = crypto.createCipher('des', key) // SECURITY BUG

// ❌ NEVER - Hardcoded secrets
const JWT_SECRET = 'my-secret-key' // SECURITY BUG
```

---

## 🟡 A05: Injection (MODERATE)

### SQL Injection Prevention

**WARN:** All database queries MUST use parameterized queries or an ORM.

```typescript
// ✅ ALWAYS - Prisma ORM (parameterized by default)
const users = await prisma.user.findMany({
  where: { email: req.body.email }, // Safe - parameterized
})

// ⚠️ CAUTION - Raw queries (use sparingly)
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${req.body.email}
` // Safe - parameterized template literal

// ❌ NEVER - String concatenation with user input
const users = await prisma.$queryRawUnsafe(
  `SELECT * FROM users WHERE email = '${req.body.email}'`, // SECURITY BUG - SQL injection
)
```

### XSS Prevention

```typescript
// React automatically escapes values
// ✅ SAFE - React escapes by default
const UserProfile = ({ name }: { name: string }) => {
  return <div>{name}</div> // Safe - React escapes
}

// ❌ NEVER - dangerouslySetInnerHTML with unsanitized input
const UnsafeComponent = ({ html }: { html: string }) => {
  return <div dangerouslySetInnerHTML={{ __html: html }} /> // SECURITY BUG - XSS
}

// ✅ IF NEEDED - Sanitize with DOMPurify
import DOMPurify from 'isomorphic-dompurify'

const SafeHtml = ({ html }: { html: string }) => {
  const sanitized = DOMPurify.sanitize(html)
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

### Command Injection Prevention

```typescript
// ❌ NEVER - Executing shell commands with user input
import { exec } from 'child_process'
exec(`git log --author=${req.body.author}`) // SECURITY BUG - command injection

// ✅ ALWAYS - Use libraries or sanitize input
import { execFile } from 'child_process'
execFile('git', ['log', '--author', req.body.author]) // Safe - parameterized
```

### NoSQL Injection Prevention

```typescript
// ❌ NEVER - Passing unsanitized objects (if using MongoDB)
const users = await db.collection('users').find({
  email: req.body.email, // SECURITY BUG if email is object: { $ne: null }
})

// ✅ ALWAYS - Validate input types with Zod
import { z } from 'zod'

const EmailSchema = z.object({
  email: z.string().email(), // Ensures string type
})

const { email } = EmailSchema.parse(req.body)
const users = await db.collection('users').find({ email }) // Safe
```

### Injection Checklist

- [ ] All inputs validated with Zod (type + format)
- [ ] Prisma ORM used (no raw SQL unless necessary)
- [ ] `$queryRawUnsafe` never used
- [ ] React components never use `dangerouslySetInnerHTML` without DOMPurify
- [ ] No shell command execution with user input
- [ ] Content-Security-Policy header configured (helmet)
- [ ] Input sanitization for special characters where needed

---

## 🟡 A07: Authentication Failures (MODERATE)

### Authentication Best Practices

**WARN:** Authentication mechanisms MUST be secure and resistant to attacks.

### JWT Best Practices

```typescript
// ✅ ALWAYS - Short-lived access tokens + long-lived refresh tokens
const ACCESS_TOKEN_EXPIRY = '15m' // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d' // 7 days

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })

  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  })

  return { accessToken, refreshToken }
}

// ✅ ALWAYS - Refresh token rotation
export const refreshAccessToken = async (refreshToken: string) => {
  const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET)

  // Invalidate old refresh token (store in DB or Redis)
  await revokeRefreshToken(refreshToken)

  // Issue new pair
  return generateTokens(payload.userId)
}
```

### Session Security

```typescript
// ✅ ALWAYS - httpOnly cookies for refresh tokens
res.cookie('refreshToken', refreshToken, {
  httpOnly: true, // Not accessible to JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth/refresh', // Limit scope
})

// ❌ NEVER - Storing tokens in localStorage (vulnerable to XSS)
localStorage.setItem('refreshToken', refreshToken) // SECURITY BUG
```

### Password Policy

```typescript
// ✅ ALWAYS - Strong password requirements
const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain uppercase letter')
  .regex(/[a-z]/, 'Password must contain lowercase letter')
  .regex(/[0-9]/, 'Password must contain number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain special character')
```

### Rate Limiting

```typescript
// ✅ ALWAYS - Rate limit authentication endpoints
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/api/v1/auth/login', authLimiter, AuthController.login)
```

### Authentication Checklist

- [ ] Access tokens short-lived (≤15 minutes)
- [ ] Refresh tokens httpOnly, secure, sameSite cookies
- [ ] Refresh token rotation implemented
- [ ] Strong password policy enforced (8+ chars, mixed case, numbers, symbols)
- [ ] Rate limiting on login/register endpoints (5 attempts per 15 min)
- [ ] Account lockout after failed attempts (optional, 10+ failures)
- [ ] Multi-factor authentication available (future enhancement)
- [ ] Password reset tokens single-use and time-limited (1 hour)
- [ ] Sessions invalidated on password change

---

## 🔵 A06: Insecure Design (ADVISORY)

### Secure Design Principles

**ADVISORY:** Design systems with security in mind from the start.

### Threat Modeling

For each new feature, consider:

1. **What assets are we protecting?** (user data, organization data, API keys)
2. **Who are the threat actors?** (external attackers, malicious users, compromised accounts)
3. **What are the attack vectors?** (API endpoints, database queries, file uploads)
4. **What are the mitigations?** (input validation, RBAC, rate limiting)

### Rate Limiting & Abuse Prevention

```typescript
// ✅ RECOMMENDED - Rate limiting on expensive operations
const expensiveOperationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Max 100 requests per hour
  keyGenerator: (req) => req.tenantId || req.ip,
})

router.post('/api/v1/orgs/:slug/export', expensiveOperationLimiter, ExportController.export)
```

### Secure Defaults

- [ ] Deny by default (whitelist, not blacklist)
- [ ] Least privilege principle (users get minimum required permissions)
- [ ] Fail securely (errors don't grant access)
- [ ] Defense in depth (multiple layers of security)

---

## 🔵 A08-A10: Additional Advisories

### A08: Software/Data Integrity Failures

- [ ] JWT tokens signed and verified
- [ ] Webhook payloads validated with signatures (future: Stripe webhooks)
- [ ] CI/CD artifacts signed (future enhancement)

### A09: Security Logging & Alerting Failures

- [ ] Failed login attempts logged
- [ ] Authorization failures logged (403 responses)
- [ ] Unexpected errors logged server-side
- [ ] Security events monitored (future: alerting)

### A10: Mishandling of Exceptional Conditions

- [ ] All async operations wrapped in try/catch
- [ ] Unhandled promise rejections caught
- [ ] Input validation on all edges (missing fields, invalid types, out-of-range values)
- [ ] Error responses don't leak sensitive information

---

## General Security Principles

### Defense in Depth

Security is implemented at multiple layers:

1. **Network**: HTTPS, CORS, rate limiting
2. **Application**: Input validation, auth middleware, RBAC
3. **Data**: Encryption at rest, hashed passwords, parameterized queries
4. **Monitoring**: Logging, error tracking, audit trails

### Fail Securely

```typescript
// ✅ ALWAYS - Deny access on error
try {
  const membership = await getMembership(userId, orgId)
  if (membership.role !== 'ADMIN') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN')
  }
  // Proceed
} catch (error) {
  // On error, deny access (don't grant by default)
  throw new AppError('Forbidden', 403, 'FORBIDDEN')
}
```

### Least Privilege

- Users get minimum required permissions
- API keys scoped to specific operations
- Service accounts have limited access

### Never Trust Client Input

- All inputs validated with Zod
- All outputs sanitized
- Client-side validation is UX, not security

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
