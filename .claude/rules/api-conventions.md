# API Conventions

## URL Structure

Base path: `/api/v1`

Format: `noun-plural/resource-id/sub-resource`

Examples:

- `GET /api/v1/orgs/:slug/members`
- `POST /api/v1/orgs/:slug/invitations`
- `DELETE /api/v1/orgs/:slug/api-keys/:id`

## HTTP Methods

- `GET` — retrieve resources (idempotent)
- `POST` — create new resources
- `PUT` — full resource replacement (rarely used)
- `PATCH` — partial update (rarely used)
- `DELETE` — remove resources (idempotent)

## Status Codes

- `200` — success with body
- `201` — resource created (include `Location` header)
- `204` — success, no body (DELETE operations)
- `400` — validation error (Zod)
- `401` — unauthenticated (missing or invalid token)
- `403` — authenticated but insufficient role
- `404` — resource not found
- `409` — conflict (duplicate slug, already a member, etc.)
- `429` — rate limited
- `500` — unexpected server error (never expose internals)

## Error Response Format

Always use this shape:

```json
{
  "error": {
    "code": "INVITATION_EXPIRED",
    "message": "This invitation has expired.",
    "details": {}
  }
}
```

- `code` — machine-readable error code (SCREAMING_SNAKE_CASE)
- `message` — human-readable description
- `details` — optional object with additional context (e.g., validation errors)

## Request Validation

- **All inputs must be validated with Zod** before touching the database.
- **Validate in this order:** headers → params → query → body.
- **Return early** on validation failure with 400 status.

## Pagination

Cursor-based using `?cursor=` + `?limit=` query params.

- Default limit: 20
- Max limit: 100
- Response shape:

```json
{
  "data": [...],
  "nextCursor": "base64encodedcursor" | null
}
```

## Authentication

- **JWT tokens** for user sessions: `Authorization: Bearer <access_token>`
- **API keys** for programmatic access: `Authorization: Bearer sk_live_...`
- **httpOnly cookies** for refresh tokens (not accessible to JavaScript)

## Tenant Isolation

- **CRITICAL:** `organizationId` must ALWAYS be sourced from `req.tenantId` (derived from JWT or API
  key context).
- **NEVER** trust the client to provide `organizationId` in the request body or query params.
- **All Prisma queries** must filter by `organizationId` to enforce tenant isolation.
- Cross-tenant access is a security bug, not a feature.

## Role-Based Access Control

Roles: `owner | admin | member`

- `owner` — full control, cannot be removed, can transfer ownership
- `admin` — manage members and invitations, cannot demote owner
- `member` — read access to org resources

Use the `requireRole()` middleware to enforce permissions.

## Response Format

- **Consistent naming:** use camelCase for JSON keys.
- **ISO 8601 timestamps:** always return dates in UTC.
- **No null pollution:** prefer omitting keys over setting them to `null`.
- **Envelope responses** only when pagination metadata is needed.

## 404 vs 403 Decision Matrix

When a resource is not found OR user lacks access, choose the status code carefully:

### Use 404 (hide existence from non-members)

- Organization doesn't exist → **404** (don't confirm org exists to non-members)
- Member doesn't exist within org → **404** (if user is not org member)
- Invitation doesn't exist → **404** (public endpoint, don't leak info)

### Use 403 (user knows resource exists but can't access it)

- User is org member but has insufficient role → **403 FORBIDDEN**
- User tries to demote owner (when not owner) → **403 FORBIDDEN**
- User tries to access admin-only feature → **403 FORBIDDEN**

### Decision Tree

```
Request comes in
    ↓
1. Is auth token valid? NO → 401 UNAUTHENTICATED
    ↓ YES
2. Does org exist? NO → 404 ORG_NOT_FOUND
    ↓ YES
3. Is user a member? NO → 403 NOT_ORG_MEMBER
    ↓ YES
4. Does user have required role? NO → 403 FORBIDDEN
    ↓ YES
5. Does specific resource exist? NO → 404 RESOURCE_NOT_FOUND
    ↓ YES
6. Process request → 200/201/204
```

**Rationale:** Use 404 when the user shouldn't even know if the resource exists (prevents information leakage about organizations they're not a member of). Use 403 when the user is already "inside" the organization but lacks permissions for a specific action.

## PATCH Usage in Phase 3

While PATCH is generally less common than GET/POST/DELETE, Phase 3 uses it for partial updates:

- `PATCH /orgs/:slug` — update org name/slug (admin+)
- `PATCH /orgs/:slug/members/:userId` — update member role (admin+)

**Use PATCH (not PUT) because:**

- We're updating a subset of fields, not replacing the entire resource
- Client doesn't need to send all fields
- More forgiving for API evolution (adding fields doesn't break clients)
- RESTful semantics: PUT = full replacement, PATCH = partial update
