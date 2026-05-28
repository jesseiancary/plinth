# Sync OpenAPI Command

Ensure OpenAPI specification stays in sync with API implementation.

## Purpose

This command provides a systematic workflow to verify that the OpenAPI spec accurately reflects
the actual API endpoints, validates the spec, and regenerates TypeScript types.

## When to Use

- After adding or modifying API endpoints
- Before creating a pull request
- When fixing API documentation issues
- After changing request/response schemas

## Workflow Steps

### 1. Validate OpenAPI Spec

```bash
pnpm --filter openapi validate
```

This checks for:

- Valid YAML syntax
- OpenAPI 3.1 compliance
- Schema reference integrity
- No duplicate operationIds
- Proper security scheme definitions

### 2. Verify Route-to-Spec Coverage

Manually verify that all routes in the codebase are documented:

**Check route files:**

```bash
# List all route definitions
grep -r "router\.(get|post|patch|delete|put)" apps/api/src/routes/ | grep -v test
```

**Cross-reference with OpenAPI spec:**

- Each route should have a corresponding path in `packages/openapi/openapi.yaml`
- HTTP methods should match
- Path parameters should be documented

**Common gaps to check:**

- New endpoints not yet documented
- Changed path parameters
- Updated request/response schemas
- New error responses (400, 401, 403, 404, etc.)

### 3. Verify Schema Completeness

For each endpoint, ensure the OpenAPI spec includes:

- [ ] Summary and description
- [ ] All path parameters with types and descriptions
- [ ] All query parameters with types, defaults, and constraints
- [ ] Request body schema (if applicable)
- [ ] Success response schema (200, 201, 204)
- [ ] Error response schemas (400, 401, 403, 404, 409, 410, 500)
- [ ] Security requirements (bearerAuth, apiKeyAuth, or empty [])
- [ ] Appropriate tags for grouping
- [ ] operationId for code generation

### 4. Validate Against Zod Schemas

Compare OpenAPI schemas with Zod validation schemas:

**Zod schemas location:** `apps/api/src/lib/validation/`

For each endpoint:

- Request body properties should match Zod schema
- Required fields should match
- Type constraints (minLength, maxLength, pattern) should match
- Enum values should match

**Example comparison:**

```typescript
// Zod schema in apps/api/src/lib/validation/orgs.ts
export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(3).max(63).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
})

// Should match OpenAPI spec in packages/openapi/openapi.yaml
# /api/v1/orgs:
#   post:
#     requestBody:
#       content:
#         application/json:
#           schema:
#             properties:
#               name:
#                 type: string
#                 minLength: 1
#                 maxLength: 255
#               slug:
#                 type: string
#                 minLength: 3
#                 maxLength: 63
#                 pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$'
```

### 5. Verify Response Schemas Match Actual API

For critical endpoints, manually test and compare:

```bash
# Start API server
pnpm --filter api dev

# Test endpoint
curl -X GET http://localhost:3001/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN" | jq

# Compare response structure with OpenAPI spec
```

### 6. Check Error Response Consistency

Verify that all error responses follow the standard format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

All error codes should be:

- Documented in OpenAPI spec
- Unique and descriptive (INVITATION_EXPIRED, ORG_NOT_FOUND, etc.)
- Listed in `.claude/skills/openapi/context.md` error code table

### 7. Generate TypeScript Types

After validating the spec:

```bash
pnpm --filter openapi generate:types
```

This generates `packages/types/src/generated.ts` from the OpenAPI spec.

### 8. Verify Generated Types

Check that generated types compile:

```bash
pnpm typecheck
```

If there are type errors in generated types:

- The OpenAPI spec may have invalid schema definitions
- Required fields may be missing
- Type references may be broken

### 9. Test with Scalar UI

Open http://localhost:3001/docs and verify:

- All endpoints are visible and grouped correctly
- Request examples are realistic
- Response examples match actual API
- Security schemes work (can authenticate in Scalar UI)
- Try-it-out feature works for GET endpoints

### 10. Update API Documentation if Needed

If you found discrepancies:

1. Update `packages/openapi/openapi.yaml`
2. Add missing endpoints or fix schemas
3. Regenerate types: `pnpm --filter openapi generate:types`
4. Run validation: `pnpm --filter openapi validate`
5. Commit changes with message: `docs(openapi): sync spec with implementation`

## Phase 4 Specific Checks

Since Phase 4 is focused on documentation completeness:

### Request/Response Examples

For each endpoint, verify OpenAPI spec includes:

```yaml
requestBody:
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/CreateOrg'
      example:
        name: 'Acme Corp'
        slug: 'acme-corp'

responses:
  '201':
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Organization'
        example:
          id: 'clx1234567890'
          name: 'Acme Corp'
          slug: 'acme-corp'
          createdAt: '2026-05-28T10:00:00Z'
          updatedAt: '2026-05-28T10:00:00Z'
```

### Security Documentation

Ensure each endpoint clearly documents:

- Which authentication method is required (JWT or API key)
- Which role is required (OWNER, ADMIN, MEMBER)
- What happens when authentication fails (401)
- What happens when authorization fails (403)

### Pagination Documentation

For paginated endpoints (`/members`, `/invitations`, `/api-keys`):

- Document `cursor` and `limit` query parameters
- Document `nextCursor` in response
- Include example showing pagination

### Multi-Tenant URL Structure

Verify all org-scoped endpoints follow:

- `/api/v1/orgs/{slug}/resource` pattern
- `{slug}` parameter is documented
- Organization existence is validated (404 if not found)

## Common Issues & Fixes

### Issue: Missing endpoint in spec

**Fix:** Add the path and operation to `packages/openapi/openapi.yaml`

### Issue: Schema mismatch between Zod and OpenAPI

**Fix:** Update OpenAPI schema to match Zod validation (Zod is source of truth for validation)

### Issue: operationId conflict

**Fix:** Ensure each operationId is unique across the entire spec

### Issue: Missing error responses

**Fix:** Document all possible error status codes (especially 403, 404, 409, 410)

### Issue: Generated types don't match expected usage

**Fix:** Check that OpenAPI schemas use correct types (string, integer, boolean, not "String")

### Issue: Circular schema references

**Fix:** Break circular dependencies with inline schemas or restructure refs

## Checklist

- [ ] OpenAPI spec validates without errors
- [ ] All routes in codebase are documented in spec
- [ ] Request schemas match Zod validation
- [ ] Response schemas match actual API responses
- [ ] All error codes are documented
- [ ] Security schemes are correctly applied
- [ ] Examples are realistic and helpful
- [ ] TypeScript types generated successfully
- [ ] Types compile without errors
- [ ] Scalar UI displays all endpoints correctly
- [ ] Try-it-out feature works in Scalar
- [ ] Pagination is documented for list endpoints
- [ ] Multi-tenant URL structure is consistent

## Output

After running this workflow, you should have:

1. A validated OpenAPI spec
2. Generated TypeScript types in `packages/types/src/generated.ts`
3. Confidence that the spec accurately reflects the API
4. A list of any discrepancies to fix
