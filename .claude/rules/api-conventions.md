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
