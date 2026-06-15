# Logging Architecture

> Structured logging with Winston for security events, business analytics, and operational monitoring.

**Last Updated:** 2026-06-14
**Status:** ✅ Implemented (Phase 5)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Log Levels](#log-levels)
4. [What Gets Logged](#what-gets-logged)
5. [What NOT to Log](#what-not-to-log)
6. [Security Event Logging](#security-event-logging)
7. [Business Event Logging](#business-event-logging)
8. [Error Logging](#error-logging)
9. [Log File Structure](#log-file-structure)
10. [Configuration](#configuration)
11. [Querying Logs](#querying-logs)
12. [Production Deployment](#production-deployment)
13. [Troubleshooting](#troubleshooting)

---

## Overview

This project uses **Winston** for structured logging to provide:

- **Security incident response** - Track auth failures, 403s, rate limits
- **Business analytics** - User registration, org changes, API key usage
- **Operational monitoring** - Server lifecycle, errors, performance
- **Compliance** - Audit trail for sensitive operations (GDPR, SOC 2)

**Key Features:**

- ✅ Structured JSON logging (machine-readable)
- ✅ Daily log rotation (14 days combined, 30 days errors)
- ✅ Environment-aware configuration (dev/prod/test)
- ✅ Sensitive data sanitization (passwords/tokens never logged)
- ✅ Multiple transports (console + files)

---

## Architecture

```
apps/api/src/lib/
├── logger.ts              # Base Winston logger + sanitization
├── security-logger.ts     # Security event helpers
└── business-logger.ts     # Business event helpers

apps/api/logs/             # Log files (gitignored)
├── error-2026-06-14.log   # Error logs (30 day retention)
├── error-2026-06-15.log
├── combined-2026-06-14.log  # All logs (14 day retention)
└── combined-2026-06-15.log
```

**Flow:**

1. Application code calls logger helper (`logAuthFailure`, `logUserRegistration`, etc.)
2. Winston logger formats as JSON with timestamp
3. Log written to file(s) based on level
4. Logs rotate daily, old logs auto-deleted per retention policy

---

## Log Levels

Winston uses 6 log levels (from highest to lowest priority):

| Level    | Use Case                                 | Production | Development |
| -------- | ---------------------------------------- | ---------- | ----------- |
| `error`  | Unexpected failures, crashes, 500 errors | ✅         | ✅          |
| `warn`   | Security events, authorization failures  | ✅         | ✅          |
| `info`   | Business events, lifecycle, user actions | ✅         | ✅          |
| `http`   | HTTP requests (via morgan)               | ⚠️         | ✅          |
| `debug`  | Performance, slow queries, detailed flow | ❌         | ✅          |
| `silent` | No logging (test environment only)       | ❌         | ❌          |

**Environment Defaults:**

- `production`: `info` (errors + warnings + business events)
- `development`: `debug` (everything except HTTP requests from morgan)
- `test`: `silent` (no logging to keep test output clean)

**Override:** Set `LOG_LEVEL` environment variable to override defaults.

---

## What Gets Logged

### 1. Application Lifecycle Events (INFO)

**Purpose:** Operational health, debugging deployment issues

```typescript
logger.info('Server started', {
  port: 3000,
  apiUrl: 'https://api.example.com',
  environment: 'production',
  nodeVersion: 'v24.0.0',
})
```

**Events:**

- ✅ Server started (port, env, URLs)
- ✅ Graceful shutdown initiated
- ✅ Database connected/disconnected
- ✅ Seed script execution

---

### 2. Security Events (WARN)

**Purpose:** Threat detection, incident response, compliance

```typescript
logAuthFailure({
  event: 'FAILED_LOGIN',
  reason: 'Invalid password',
  email: 'user@example.com',
  ip: '192.168.1.1',
  userAgent: 'Mozilla/5.0...',
  endpoint: '/api/v1/auth/login',
})
```

**Events:**

- ⚠️ Failed login attempts (wrong password, user not found)
- ⚠️ Invalid JWT tokens (expired, malformed, version mismatch)
- ⚠️ Invalid API keys (wrong key, revoked key)
- ⚠️ Authorization failures (403 responses, insufficient role)
- ⚠️ Rate limit exceeded
- ⚠️ CSRF validation failures
- ⚠️ Sensitive operations (password change, email change)
- ⚠️ Registration failures (account enumeration prevention)

**Security Event Types:**

```typescript
type SecurityEventType =
  | 'FAILED_LOGIN'
  | 'INVALID_TOKEN'
  | 'TOKEN_VERSION_MISMATCH'
  | 'INVALID_API_KEY'
  | 'REVOKED_API_KEY_USED'
  | 'AUTHORIZATION_FAILURE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_FAILURE'
  | 'REGISTRATION_FAILED'
  | 'INVALID_INVITATION_TOKEN'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGED'
```

---

### 3. Business Events (INFO)

**Purpose:** Product analytics, user behavior tracking, audit trail

```typescript
logUserRegistration({
  userId: 'cm1abc123',
  email: 'user@example.com',
  organizationId: 'cm1org456',
  organizationSlug: 'acme',
  personalOrg: true,
})
```

**Events:**

- ✅ User registered
- ✅ User logged in (successful)
- ✅ User logged out
- ✅ Organization created/updated
- ✅ Member added/removed
- ✅ Member role changed
- ✅ Ownership transferred
- ✅ Invitation created/accepted/revoked
- ✅ API key created/revoked

**Business Event Types:**

```typescript
type BusinessEventType =
  | 'USER_REGISTERED'
  | 'USER_LOGGED_IN'
  | 'USER_LOGGED_OUT'
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_UPDATED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'ROLE_CHANGED'
  | 'OWNERSHIP_TRANSFERRED'
  | 'INVITATION_CREATED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REVOKED'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
```

---

### 4. Error Events (ERROR/WARN/DEBUG)

**Purpose:** Debugging production issues, identifying patterns

```typescript
logger.error('Database error', {
  error: {
    message: err.message,
    name: err.name,
    stack: err.stack,
  },
  request: {
    method: 'POST',
    url: '/api/v1/orgs',
    params: {},
    query: {},
  },
  user: { id: 'cm1abc123', email: 'user@example.com' },
  organizationId: 'cm1org456',
})
```

**Log Level by Error Type:**

- `error` - 500 errors, database errors, unexpected exceptions
- `warn` - 400 errors (AppError), authorization failures
- `debug` - Validation errors (Zod)

**Error Context (sanitized):**

- Error details (message, name, stack trace - **server-side only**)
- Request context (method, URL, params, query - **NOT body**)
- User context (userId, email)
- Organization context (organizationId/tenantId)
- Timestamp

---

### 5. Performance Events (DEBUG)

**Purpose:** Performance optimization, capacity planning

```typescript
logger.debug('Slow database query', {
  model: 'User',
  action: 'findMany',
  duration: '245ms',
})
```

**Events:**

- 🔍 Slow queries (>100ms)
- 🔍 Slow API responses (>1s)
- 🔍 Long transactions (>500ms)

**Note:** Performance logging is DEBUG level - disabled in production by default.

---

## What NOT to Log

**⚠️ CRITICAL: Never log sensitive data that could be exploited**

### ❌ Authentication Credentials

- ❌ Passwords (plaintext OR hashed)
- ❌ JWT tokens (access or refresh)
- ❌ API keys (plaintext - only log key name/ID)
- ❌ Session cookies
- ❌ CSRF tokens
- ❌ Invitation tokens (only log tokenHash for debugging)

### ❌ Request Bodies with Sensitive Data

- ❌ `req.body` on login/register endpoints (contains passwords)
- ❌ `req.body` on password change endpoints
- ❌ `req.headers.authorization` (contains tokens)
- ❌ `req.headers.cookie` (contains session data)

### ❌ Future Sensitive Data (Phase 9+)

- ❌ Credit card numbers
- ❌ Bank account details
- ❌ Social security numbers

### ⚠️ Minimize PII Logging

- ⚠️ Email addresses - OK for user-specific events, **NOT** in error logs
- ⚠️ IP addresses - OK for security events only
- ⚠️ User agent strings - OK for security events only
- ⚠️ Full names - OK in context of user actions

**Sanitization:** The `sanitizeLogData()` function automatically redacts sensitive keys before logging. See [apps/api/src/lib/logger.ts:100](../apps/api/src/lib/logger.ts#L100).

---

## Security Event Logging

### Helper Functions

Located in [apps/api/src/lib/security-logger.ts](../apps/api/src/lib/security-logger.ts):

```typescript
// Failed authentication
logAuthFailure({
  event: 'FAILED_LOGIN',
  reason: 'Invalid password',
  email: 'user@example.com',
  userId: 'cm1abc123', // if known
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  endpoint: req.originalUrl,
})

// Authorization failure (403)
logAuthorizationFailure({
  userId: 'cm1abc123',
  email: 'user@example.com',
  endpoint: '/api/v1/orgs/acme/members',
  method: 'DELETE',
  requiredRole: 'ADMIN',
  actualRole: 'MEMBER',
  organizationId: 'cm1org456',
  organizationSlug: 'acme',
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  reason: 'Insufficient permissions',
})

// Rate limit exceeded
logRateLimitExceeded({
  endpoint: '/api/v1/auth/login',
  limit: 5,
  window: '15 minutes',
  ip: req.ip,
  userId: req.user?.id,
})

// Sensitive operation
logSensitiveOperation({
  event: 'PASSWORD_CHANGED',
  userId: 'cm1abc123',
  email: 'user@example.com',
  ip: req.ip,
  userAgent: req.headers['user-agent'],
})

// Generic security event
logSecurityEvent('REGISTRATION_FAILED', req, {
  email: 'user@example.com',
})
```

### Security Context Helper

Extract security context from Express request:

```typescript
const context = getSecurityContext(req)
// Returns: { ip, userAgent, userId, email, organizationId, endpoint, method }
```

---

## Business Event Logging

### Helper Functions

Located in [apps/api/src/lib/business-logger.ts](../apps/api/src/lib/business-logger.ts):

```typescript
// User registration
logUserRegistration({
  userId: user.id,
  email: user.email,
  organizationId: org.id,
  organizationSlug: org.slug,
  personalOrg: true,
})

// User login
logUserLogin({
  userId: user.id,
  email: user.email,
  ip: req.ip,
})

// User logout
logUserLogout({
  userId: user.id,
  email: user.email,
})

// Organization created
logOrganizationCreated({
  organizationId: org.id,
  organizationSlug: org.slug,
  organizationName: org.name,
  createdBy: req.user.id,
})

// Membership changed
logMembershipChanged({
  event: 'MEMBER_ADDED',
  organizationId: org.id,
  organizationSlug: org.slug,
  targetUserId: newMember.id,
  targetEmail: newMember.email,
  actorUserId: req.user.id,
  actorEmail: req.user.email,
  role: 'MEMBER',
})

// Invitation event
logInvitationEvent({
  event: 'INVITATION_CREATED',
  invitationId: invitation.id,
  email: invitation.email,
  role: invitation.role,
  organizationId: org.id,
  organizationSlug: org.slug,
  invitedBy: req.user.id,
})

// API key event
logApiKeyEvent({
  event: 'API_KEY_CREATED',
  apiKeyId: apiKey.id,
  apiKeyName: apiKey.name,
  organizationId: org.id,
  organizationSlug: org.slug,
  scopes: apiKey.scopes,
  createdBy: req.user.id,
})
```

---

## Error Logging

Error logging is handled automatically by the error handler middleware ([apps/api/src/middleware/error-handler.ts](../apps/api/src/middleware/error-handler.ts)).

### Log Levels by Error Type

```typescript
// Zod validation errors → DEBUG
logger.debug('Validation error', { ...context, validationErrors })

// AppError 4xx → WARN
logger.warn('Application error', sanitizedContext)

// AppError 5xx → ERROR
logger.error('Application error', sanitizedContext)

// Prisma errors → ERROR
logger.error('Database error', sanitizedContext)

// Unknown errors → ERROR
logger.error('Unexpected error', sanitizedContext)
```

### Error Context

```typescript
{
  error: {
    message: err.message,
    name: err.name,
    stack: err.stack,  // Full stack trace (server-side only)
    code: err.code,    // AppError code if applicable
  },
  request: {
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    // ⚠️ req.body NOT logged (may contain passwords)
  },
  user: {
    id: req.user?.id,
    email: req.user?.email,
  },
  organizationId: req.tenantId,
  timestamp: new Date().toISOString(),
}
```

---

## Log File Structure

### File Paths

```
apps/api/logs/
├── error-2026-06-14.log       # ERROR level only (30 day retention)
├── error-2026-06-15.log
├── error-2026-06-16.log
├── combined-2026-06-14.log    # All levels (14 day retention)
├── combined-2026-06-15.log
└── combined-2026-06-16.log
```

### Rotation Policy

- **Daily rotation** - New file created at midnight (UTC)
- **Size limit** - Files rotate when they reach 20MB
- **Retention:**
  - `error-*.log` - 30 days
  - `combined-*.log` - 14 days
- **Auto-cleanup** - Old files deleted automatically

### Log Format

**Production (JSON):**

```json
{
  "level": "warn",
  "message": "Authentication failure",
  "event": "FAILED_LOGIN",
  "reason": "Invalid password",
  "email": "user@example.com",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "endpoint": "/api/v1/auth/login",
  "timestamp": "2026-06-14T12:34:56.789Z"
}
```

**Development (Console):**

```
12:34:56 warn: Authentication failure {
  event: 'FAILED_LOGIN',
  reason: 'Invalid password',
  email: 'user@example.com',
  ...
}
```

---

## Configuration

### Environment Variables

```bash
# .env
LOG_LEVEL=info  # error | warn | info | http | debug | silent
```

**Defaults:**

- `production` → `info`
- `development` → `debug`
- `test` → `silent`

### Programmatic Configuration

See [apps/api/src/lib/logger.ts](../apps/api/src/lib/logger.ts#L8):

```typescript
const getLogLevel = (): string => {
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL
  }

  if (env.NODE_ENV === 'test') return 'silent'
  if (env.NODE_ENV === 'production') return 'info'
  return 'debug'
}
```

### Transports

**File Transports (production + development):**

- `error-*.log` - Error logs only
- `combined-*.log` - All logs

**Console Transport (development only):**

- Human-readable format with colors
- Disabled in production (use log aggregation instead)

**No Transports (test):**

- Log level set to `silent`
- No files written, no console output

---

## Querying Logs

### Local Development

**View recent logs:**

```bash
# All logs
tail -f apps/api/logs/combined-$(date +%Y-%m-%d).log

# Errors only
tail -f apps/api/logs/error-$(date +%Y-%m-%d).log

# Pretty print JSON
tail -f apps/api/logs/combined-*.log | jq .
```

**Search for specific events:**

```bash
# Failed logins
grep '"event":"FAILED_LOGIN"' apps/api/logs/combined-*.log | jq .

# Errors from specific user
grep '"userId":"cm1abc123"' apps/api/logs/error-*.log | jq .

# 403 errors
grep '"event":"AUTHORIZATION_FAILURE"' apps/api/logs/combined-*.log | jq .
```

**Count events:**

```bash
# Failed login attempts today
grep '"event":"FAILED_LOGIN"' apps/api/logs/combined-$(date +%Y-%m-%d).log | wc -l

# Error count by type
grep '"level":"error"' apps/api/logs/error-*.log | jq -r '.error.name' | sort | uniq -c
```

---

## Production Deployment

**Phase 9+ will add log aggregation. Until then:**

### Option 1: File-Based (Current)

**Pros:**

- ✅ Zero configuration
- ✅ Works out of the box
- ✅ No external dependencies

**Cons:**

- ❌ No centralized search
- ❌ Manual log rotation monitoring
- ❌ No alerting

**Setup:**

```bash
# Ensure logs directory exists
mkdir -p /var/app/logs

# Set LOG_LEVEL in production .env
echo "LOG_LEVEL=info" >> .env
```

### Option 2: Log Aggregation (Recommended for Phase 9+)

**Options:**

- **Datadog** - Full observability platform (logs + metrics + traces)
- **LogDNA/Mezmo** - Simple log aggregation
- **ELK Stack** - Self-hosted (Elasticsearch + Logstash + Kibana)
- **CloudWatch Logs** - AWS-native (if deploying to AWS)

**Winston supports all of these via transports.**

Example Datadog integration:

```typescript
import winston from 'winston'
import { datadog } from 'datadog-winston'

logger.add(
  new datadog({
    apiKey: process.env.DATADOG_API_KEY,
    hostname: 'api-server',
    service: 'plinth-api',
    ddsource: 'nodejs',
  }),
)
```

---

## Troubleshooting

### Logs not appearing

**Check log level:**

```bash
# Ensure LOG_LEVEL is set correctly
echo $LOG_LEVEL

# Or check in code
node -e "require('./dist/lib/logger.js').logger.level"
```

**Check file permissions:**

```bash
# Ensure logs directory is writable
ls -la apps/api/logs/

# Fix permissions if needed
chmod 755 apps/api/logs/
```

**Check environment:**

```bash
# Test environment silences all logs
echo $NODE_ENV

# If NODE_ENV=test, logs are disabled by design
```

### Too many logs

**Reduce log level:**

```bash
# In production, use 'info' instead of 'debug'
LOG_LEVEL=info

# Or only errors
LOG_LEVEL=error
```

**Filter noisy events:**

- Remove debug-level performance logging
- Sample high-volume events (log 1 in 100 requests)

### Disk space issues

**Check log file sizes:**

```bash
du -sh apps/api/logs/*
```

**Reduce retention:**

```typescript
// In logger.ts, reduce maxFiles
new DailyRotateFile({
  maxFiles: '7d', // Instead of 14d
})
```

**Manual cleanup:**

```bash
# Delete logs older than 7 days
find apps/api/logs/ -name "*.log" -mtime +7 -delete
```

### Sensitive data in logs

**If sensitive data was logged:**

1. ✅ **Immediate**: Rotate logs (`rm apps/api/logs/*`)
2. ✅ **Fix code**: Add key to `sanitizeLogData()` sensitive keys
3. ✅ **Test**: Verify sanitization with unit test
4. ✅ **Deploy**: Push fix immediately

**Add to sanitization:**

```typescript
const sensitiveKeys = [
  'password',
  'token',
  'apikey',
  'newSensitiveField', // Add here
]
```

---

## Future Enhancements (Phase 9+)

- [ ] Log aggregation (Datadog/LogDNA)
- [ ] Alerting on critical events (PagerDuty/Slack)
- [ ] Correlation IDs for request tracing
- [ ] Log sampling for high-volume endpoints
- [ ] Metrics/analytics dashboards
- [ ] Compliance reporting (GDPR data export logs)

---

## References

- [Winston Documentation](https://github.com/winstonjs/winston)
- [OWASP Top 10 2025 - A09](https://owasp.org/Top10/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [Source Code](../apps/api/src/lib/logger.ts)
