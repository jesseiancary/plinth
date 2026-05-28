# Developer Experience Review Command

Review API design, documentation quality, and developer ergonomics.

## Purpose

This command provides a comprehensive developer experience (DX) checklist focused on how external
developers will interact with your API. Unlike the `/review` command (which focuses on code quality,
security, and correctness), this command evaluates the API from a **developer consumer's
perspective**.

## When to Use

- Before releasing API documentation publicly
- After adding new endpoints or features
- When updating API design patterns
- Before major version releases
- When receiving developer feedback
- As part of Phase 4+ quality assurance

## Developer Experience Checklist

### 1. API Design Consistency

#### URL Structure

- [ ] All organization-scoped endpoints follow `/api/v1/orgs/{slug}/{resource}` pattern
- [ ] URL paths use plural nouns (`/members`, `/invitations`, `/api-keys`)
- [ ] Path parameters are consistently named (`{slug}`, `{memberId}`, `{invitationId}`)
- [ ] No mixing of camelCase and kebab-case in URLs
- [ ] Resource IDs in URLs match the resource type (clear what you're operating on)

#### HTTP Methods

- [ ] GET requests are read-only and idempotent
- [ ] POST creates new resources (returns 201)
- [ ] PATCH updates existing resources (returns 200)
- [ ] DELETE removes resources (returns 204)
- [ ] No business logic in GET requests (no side effects)

#### Status Codes

- [ ] Success responses use appropriate codes (200, 201, 204)
- [ ] Error responses use correct codes (400, 401, 403, 404, 409, 410)
- [ ] 401 for missing/invalid authentication
- [ ] 403 for insufficient permissions
- [ ] 404 for resource not found (doesn't leak organization existence)
- [ ] 409 for conflicts (duplicate slug, already member)
- [ ] 410 for expired/revoked resources (invitations, tokens)

#### Pagination

- [ ] All list endpoints support cursor-based pagination
- [ ] Pagination parameters are consistent (`cursor`, `limit`)
- [ ] Response includes `nextCursor` (null when no more pages)
- [ ] Default limit is sensible (20 items)
- [ ] Maximum limit is enforced (100 items)
- [ ] Cursor format is opaque to clients

#### Filtering & Sorting

- [ ] Query parameters for filtering are consistent across endpoints
- [ ] Boolean filters use `true`/`false` (e.g., `?active=true`)
- [ ] Enum filters match schema values (e.g., `?status=PENDING`)
- [ ] Sort parameters are predictable and documented

---

### 2. Error Response Quality

#### Error Format

- [ ] All errors follow standard format: `{ error: { code, message, details } }`
- [ ] Error codes are in SCREAMING_SNAKE_CASE
- [ ] Error codes are unique and descriptive (not generic)
- [ ] Error messages are human-readable and actionable
- [ ] Details object provides context without leaking internals

#### Error Code Consistency

- [ ] `VALIDATION_ERROR` for Zod validation failures
- [ ] `UNAUTHENTICATED` for missing/invalid tokens
- [ ] `FORBIDDEN` for insufficient permissions
- [ ] `ORG_NOT_FOUND` for organization not found
- [ ] `NOT_ORG_MEMBER` for accessing org without membership
- [ ] `LAST_OWNER` for operations blocked by last-owner rule
- [ ] `INVITATION_EXPIRED` for expired invitation tokens
- [ ] `ALREADY_MEMBER` for inviting existing member

#### Error Messages

- [ ] Messages explain what went wrong ("Organization slug already exists")
- [ ] Messages suggest how to fix ("Use a unique slug between 3-63 characters")
- [ ] No stack traces or internal error details exposed
- [ ] Validation errors include field name and constraint
- [ ] Permission errors explain required role

---

### 3. Documentation Completeness

#### Endpoint Documentation

- [ ] Every endpoint has a clear, concise summary (< 50 chars)
- [ ] Description explains when and why to use this endpoint
- [ ] All parameters have descriptions
- [ ] Request body schema is complete with constraints
- [ ] All possible responses are documented (including errors)
- [ ] Security requirements are clearly stated

#### Examples

- [ ] Request examples use realistic data (not "foo", "bar", "string")
- [ ] Response examples match actual API responses
- [ ] Examples are copy-pasteable
- [ ] Examples show complete request/response cycle
- [ ] Error response examples show actual error format
- [ ] Pagination examples show how to fetch multiple pages

#### Edge Cases

- [ ] Documentation explains what happens when invitation expires
- [ ] Last-owner protection is documented
- [ ] Token expiry behavior is documented (72 hours)
- [ ] API key scope enforcement is explained
- [ ] Rate limiting behavior is documented
- [ ] Concurrent request handling is explained (if relevant)

---

### 4. Authentication & Authorization

#### Authentication Methods

- [ ] JWT access token authentication is documented
- [ ] API key authentication is documented
- [ ] Which endpoints support which auth methods is clear
- [ ] Token format is documented (Bearer scheme)
- [ ] Token expiry is documented (15m for access, 7d for refresh)
- [ ] Refresh token flow is documented

#### Authorization

- [ ] Required roles are documented for each endpoint
- [ ] RBAC model is explained (OWNER > ADMIN > MEMBER)
- [ ] Permission errors clearly state required vs actual role
- [ ] Scope system for API keys is documented
- [ ] Multi-tenant isolation is explained

#### Security Documentation

- [ ] API keys must never be committed to version control (documented)
- [ ] Refresh tokens are httpOnly cookies (documented)
- [ ] Token rotation behavior is documented
- [ ] Best practices for storing tokens are provided

---

### 5. Multi-Tenant Clarity

#### Tenant Context

- [ ] It's clear that `{slug}` identifies the organization context
- [ ] Documentation explains you must be a member to access org resources
- [ ] 404 vs 403 distinction is explained (don't leak org existence)
- [ ] Personal organization on registration is documented
- [ ] Org slug uniqueness is documented

#### Tenant Isolation

- [ ] Cross-tenant access attempts return 404 (not 403)
- [ ] Organization switching workflow is documented
- [ ] API key scoping to organization is clear
- [ ] Invitation tokens are org-specific

---

### 6. Developer Ergonomics

#### Discoverability

- [ ] Related endpoints are cross-referenced in documentation
- [ ] Common workflows are documented end-to-end
- [ ] Scalar UI groups endpoints logically with tags
- [ ] OpenAPI spec has meaningful operationIds
- [ ] Examples guide developers through typical use cases

#### Onboarding

- [ ] "Getting Started" documentation exists
- [ ] Authentication flow is clear (register → login → use token)
- [ ] First API call example is provided
- [ ] Common patterns are documented (creating org, inviting members)
- [ ] Troubleshooting guide for common errors

#### API Exploration

- [ ] Scalar UI `/docs` endpoint works and is discoverable
- [ ] Try-it-out feature works in Scalar (for GET endpoints)
- [ ] Authentication can be configured in Scalar UI
- [ ] Response examples help understand data structure
- [ ] Error examples help debug issues

---

### 7. Consistency Across Endpoints

#### Naming Conventions

- [ ] Field names are consistent (camelCase in JSON)
- [ ] Timestamps are ISO 8601 format (`createdAt`, `updatedAt`)
- [ ] Boolean fields use true/false (not 1/0)
- [ ] ID fields are named consistently (`id`, `userId`, `organizationId`)
- [ ] Enum values are consistent (SCREAMING_SNAKE_CASE)

#### Response Patterns

- [ ] Single resource: `{ id, name, ... }` (direct object)
- [ ] List resources: `{ data: [...], nextCursor: ... }` (paginated)
- [ ] Create resource: returns the created resource (201)
- [ ] Update resource: returns the updated resource (200)
- [ ] Delete resource: returns 204 (no content)

#### Relationship Loading

- [ ] Related resources are included when needed (e.g., `user` in `Membership`)
- [ ] Nested loading is predictable and documented
- [ ] No unnecessary nesting (keep responses flat)
- [ ] Related IDs are included for client-side joins

---

### 8. Performance & Rate Limiting

#### Response Times

- [ ] Endpoints respond in < 200ms for typical requests
- [ ] Slow endpoints (if any) are documented
- [ ] Pagination limits are reasonable for performance

#### Rate Limiting

- [ ] Rate limits are documented (requests per minute/hour)
- [ ] Rate limit headers are returned (`X-RateLimit-*`)
- [ ] 429 status code is used for rate limit exceeded
- [ ] Retry-After header is provided when rate limited

---

### 9. Versioning & Changes

#### API Versioning

- [ ] API is versioned in URL (`/api/v1/...`)
- [ ] Version strategy is documented
- [ ] Breaking changes policy is documented
- [ ] Deprecation notices are provided in advance

#### Changelog

- [ ] API changes are documented in CHANGELOG
- [ ] New endpoints are announced
- [ ] Breaking changes are clearly marked
- [ ] Migration guides provided for major changes

---

### 10. Real-World Usage

#### Common Workflows

- [ ] "Create organization and invite team members" workflow is documented
- [ ] "Generate and use API key" workflow is documented
- [ ] "Accept invitation" workflow is documented
- [ ] "Transfer organization ownership" workflow is documented

#### Error Handling

- [ ] Developers know how to handle common errors
- [ ] Retry logic for transient errors is documented
- [ ] Error codes map to clear remediation steps
- [ ] Support/troubleshooting contact is provided

#### Client Integration

- [ ] Examples show how to handle refresh token expiry
- [ ] Pagination loop example is provided
- [ ] Error handling patterns are demonstrated
- [ ] TypeScript types are available for client use

---

## How to Perform a DX Review

### 1. Think Like a First-Time User

Ask yourself:

- If I had never seen this API before, could I complete a basic task?
- Are the examples realistic and helpful?
- Do error messages tell me what I did wrong and how to fix it?
- Can I find related endpoints easily?

### 2. Test the Happy Path

For a key workflow (e.g., create org → invite member → member accepts):

- [ ] Follow the documentation step by step
- [ ] Use only the examples provided (no insider knowledge)
- [ ] Verify all requests succeed with documented examples
- [ ] Check that response format matches documentation

### 3. Test the Unhappy Path

Intentionally cause errors:

- [ ] Try creating org with duplicate slug → check error is helpful
- [ ] Try accessing org you're not a member of → verify 404 (not 403)
- [ ] Try expired invitation token → verify clear error message
- [ ] Try insufficient permissions → verify error explains required role

### 4. Check Documentation Accuracy

- [ ] Run actual API calls and compare responses to OpenAPI examples
- [ ] Verify all documented fields exist in responses
- [ ] Verify all error codes mentioned in docs are actually returned
- [ ] Check that status codes match documentation

### 5. Evaluate Consistency

Compare multiple endpoints:

- [ ] URL patterns are consistent
- [ ] Error format is identical across all endpoints
- [ ] Pagination works the same way everywhere
- [ ] Authentication is handled consistently

---

## Common DX Issues & Fixes

### Issue: Generic Error Messages

**Bad:** `{ error: { code: "ERROR", message: "Invalid request" } }`
**Good:** `{ error: { code: "ORG_SLUG_EXISTS", message: "Organization slug 'acme' is already taken", details: { slug: "acme" } } }`

### Issue: Inconsistent URL Patterns

**Bad:** `/api/v1/organization/:id/member/:memberId` (mixed singular/plural)
**Good:** `/api/v1/orgs/:slug/members/:memberId` (consistent plural)

### Issue: Unclear Authentication

**Bad:** Documentation says "requires auth" but doesn't explain how
**Good:** "Requires JWT access token in Authorization header: `Bearer <token>`"

### Issue: Missing Pagination Examples

**Bad:** Documents cursor/limit parameters but no example of fetching all pages
**Good:** Shows complete pagination loop with `while (nextCursor !== null)` example

### Issue: Leaking Internal Details

**Bad:** Returns 403 when org doesn't exist (leaks existence)
**Good:** Returns 404 whether org doesn't exist OR user isn't a member

---

## Success Criteria

A good DX review should result in:

✅ A developer can complete a basic workflow using only the documentation
✅ Error messages are actionable and help debug issues
✅ API patterns are predictable across all endpoints
✅ Authentication and authorization are clear
✅ Examples are realistic and copy-pasteable
✅ Edge cases are documented
✅ The Scalar UI `/docs` page is navigable and helpful

---

## After the Review

Document findings:

1. List DX issues found (prioritize by severity)
2. Create tickets for documentation gaps
3. Update OpenAPI spec with better examples
4. Add missing error response documentation
5. Create integration guides for common workflows
6. Update `/docs` with clarifications

---

## Phase 4 Specific: OpenAPI Quality

Since Phase 4 focuses on documentation:

- [ ] Run `/sync-openapi` to verify spec accuracy
- [ ] Every endpoint has request/response examples
- [ ] All error codes are documented with examples
- [ ] Scalar UI is tested for all endpoints
- [ ] Generated TypeScript types work correctly
- [ ] API is usable by a frontend developer without backend knowledge
