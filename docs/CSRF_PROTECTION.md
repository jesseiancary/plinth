# CSRF Protection Implementation

## Overview

This project implements **Double Submit Cookie** pattern for CSRF protection as a defense-in-depth measure alongside SameSite=strict cookies.

**Implementation Date:** 2026-06-13
**Security Audit Finding:** C-02 (Critical - Missing CSRF Protection) - **RESOLVED**

---

## Architecture

### Pattern: Double Submit Cookie

The Double Submit Cookie pattern is a stateless CSRF protection mechanism that works as follows:

1. **On GET requests:** Server generates a cryptographically random CSRF token (32 bytes) and sets it as a cookie with `httpOnly=false` so JavaScript can read it
2. **On state-changing requests (POST/PATCH/DELETE/PUT):** Client must send the token in two places:
   - **Cookie:** `csrf-token` (set automatically by browser)
   - **Header:** `X-CSRF-Token` (read from cookie and set by JavaScript)
3. **Server validation:** Both values must match using constant-time comparison

**Why this works:** An attacker cannot read the cookie value (same-origin policy) to include it in the header, even if they trick the browser into sending the cookie.

---

## Implementation Details

### Backend (API)

**Files:**

- `apps/api/src/lib/csrf.ts` - Token generation and validation utilities
- `apps/api/src/middleware/csrf.ts` - Express middleware
- `apps/api/src/app.ts` - Global middleware registration

**Token Properties:**

- **Size:** 32 bytes (256 bits)
- **Encoding:** base64url (43 characters)
- **Lifetime:** 1 hour
- **Generation:** crypto.randomBytes() for cryptographic randomness

**Public Endpoints (CSRF exempted):**

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/invitations/accept`

**API Key Bypass:**

- Requests using `Bearer sk_*` tokens bypass CSRF validation
- API keys don't use cookies, so CSRF doesn't apply

**Cookie Configuration:**

```typescript
{
  httpOnly: false,        // Frontend must read this
  secure: true,           // HTTPS only in production
  sameSite: 'strict',     // Defense-in-depth with CSRF
  maxAge: 3600000,        // 1 hour
  path: '/',              // All routes
}
```

### Frontend (Web)

**Files:**

- `apps/web/src/lib/api-client.ts` - Axios interceptor for CSRF headers

**Behavior:**

- Reads `csrf-token` cookie before each state-changing request
- Attaches value to `X-CSRF-Token` header
- No manual intervention required - automatic for all requests

**Request Interceptor:**

```typescript
// Add CSRF token to POST/PATCH/DELETE/PUT requests
const csrfToken = getCsrfToken()
if (csrfToken) {
  config.headers['X-CSRF-Token'] = csrfToken
}
```

---

## Security Properties

### ✅ Defense-in-Depth

1. **SameSite=strict cookies** (primary defense)
2. **CSRF tokens** (additional layer if SameSite fails)
3. **CORS with credentials** (origin validation)
4. **Constant-time comparison** (prevents timing attacks)

### ✅ Timing Attack Prevention

Token comparison uses `crypto.timingSafeEqual()` to ensure validation time is independent of token content, preventing attackers from inferring token values through timing side-channels.

### ✅ OWASP Compliance

Implements OWASP Cross-Site Request Forgery Prevention Cheat Sheet recommendations:

- Stateless token pattern (scalable)
- Cryptographically strong tokens
- Secure cookie configuration
- Proper error messages (no token leakage)

---

## Error Codes

| Code                 | Status | Description                         | User Message                                                           |
| -------------------- | ------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `CSRF_TOKEN_MISSING` | 403    | Token missing from cookie or header | "CSRF token missing. Please refresh the page and try again."           |
| `CSRF_TOKEN_INVALID` | 403    | Token mismatch or validation failed | "CSRF token validation failed. Please refresh the page and try again." |

---

## Testing

### Backend Tests

**File:** `apps/api/src/middleware/csrf.test.ts` (15 tests)

**Coverage:**

- ✅ CSRF token cookie generation on GET requests
- ✅ Rejection of requests without CSRF token (403)
- ✅ Rejection of requests with invalid CSRF token (403)
- ✅ Acceptance of requests with valid CSRF token
- ✅ Public endpoint bypass (login, register)
- ✅ API key authentication bypass
- ✅ Constant-time comparison (timing attack prevention)
- ✅ User-friendly error messages
- ✅ Cookie security attributes

### Frontend Tests

**File:** `apps/web/src/lib/api-client.test.ts` (7 CSRF tests)

**Coverage:**

- ✅ CSRF token attachment to POST requests
- ✅ CSRF token attachment to PATCH requests
- ✅ CSRF token attachment to DELETE requests
- ✅ CSRF token attachment to PUT requests
- ✅ No CSRF token on GET requests
- ✅ Graceful handling of missing cookie
- ✅ URL-encoded token decoding

---

## OpenAPI Specification Update

### Required Changes

All state-changing endpoints (POST/PATCH/DELETE/PUT) except public endpoints should document the `X-CSRF-Token` header:

```yaml
parameters:
  - name: X-CSRF-Token
    in: header
    required: true
    description: CSRF token obtained from csrf-token cookie. Read the cookie value and send it in this header.
    schema:
      type: string
      example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz'
```

### Public Endpoints (No CSRF Header)

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/invitations/accept`

### Protected Endpoints (Require CSRF Header)

All other POST/PATCH/DELETE endpoints including:

- Auth: `/api/v1/auth/logout`, `/api/v1/auth/password`
- Organizations: Create, update, delete
- Members: Update role, remove, transfer ownership
- Invitations: Create, revoke
- API Keys: Create, revoke

---

## Migration Notes

### For Existing API Clients

**Browser-based clients:**

- No action required - cookies are automatically sent

**Mobile/native clients:**

- No action required - already use Bearer tokens (API keys)

**Third-party integrations:**

- Use API keys (`Bearer sk_*`) - CSRF protection bypassed
- Cookie-based auth requires reading `csrf-token` cookie and sending in header

### Backward Compatibility

❌ **Breaking change for cookie-based authentication**

Clients using cookie-based auth must update to include `X-CSRF-Token` header on state-changing requests. This is intentional for security.

✅ **Non-breaking for API key authentication**

API key authentication is unaffected.

---

## Performance Impact

- **Negligible:** Token generation uses fast crypto primitives
- **Stateless:** No server-side token storage or database lookups
- **Scalable:** Works across distributed services without shared state

---

## References

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Double Submit Cookie Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie)
- [Security Audit Results](../SECURITY_AUDIT_RESULTS.md) - Finding C-02

---

## Future Enhancements

**Optional (not required for current security posture):**

1. **CSRF Token Audit Trail**
   - Add `CsrfToken` model to track token generation and usage
   - Useful for security monitoring and forensics
   - Adds statefulness - evaluate cost/benefit

2. **Token Rotation**
   - Rotate tokens periodically (e.g., every 15 minutes)
   - Reduces window of opportunity for token theft

3. **Per-Session Tokens**
   - Tie CSRF tokens to user sessions
   - Invalidate on logout
   - Requires session storage

---

## Maintenance Checklist

- [ ] Update OpenAPI spec with `X-CSRF-Token` header for all protected endpoints
- [ ] Document CSRF exemption for new public endpoints
- [ ] Ensure constant-time comparison for any new token validation
- [ ] Test CSRF protection when adding new state-changing routes
