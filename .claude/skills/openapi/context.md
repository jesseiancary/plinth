# OpenAPI Skill Context

Auto-loaded when working on API specification, type generation, or API documentation.

## OpenAPI Spec Location

`packages/openapi/openapi.yaml`

## Type Generation Workflow

1. Update `openapi.yaml` with new endpoint definitions
2. Run `pnpm --filter openapi generate:types` to generate TypeScript types
3. Run `pnpm --filter openapi generate:zod` to generate Zod schemas
4. Import generated types/schemas in API route handlers

## OpenAPI 3.1 Structure

```yaml
openapi: 3.1.0
info:
  title: Plinth API
  version: 1.0.0
  description: Multi-tenant SaaS API

servers:
  - url: http://localhost:3000/api/v1
    description: Development
  - url: https://api.plinth.dev/api/v1
    description: Production

paths:
  /orgs/{slug}/members:
    get:
      summary: List organization members
      operationId: listMembers
      tags:
        - Organizations
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Member'

components:
  schemas:
    Member:
      type: object
      required:
        - id
        - role
        - userId
        - organizationId
      properties:
        id:
          type: string
        role:
          type: string
          enum: [owner, admin, member]
        userId:
          type: string
        organizationId:
          type: string
        createdAt:
          type: string
          format: date-time

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []
```

## Common Tasks

### Add New Endpoint

1. Define path in `paths` section
2. Specify HTTP method (get, post, put, delete)
3. Add request parameters (path, query, body)
4. Define response schemas
5. Add security requirements
6. Tag appropriately for documentation grouping

### Add New Schema

1. Add to `components/schemas`
2. Use `$ref` for reusability
3. Mark required fields
4. Add descriptions for clarity
5. Use appropriate formats (date-time, email, uri, etc.)

### Validate Spec

```bash
pnpm --filter openapi validate
```

This checks for:

- Valid YAML syntax
- OpenAPI 3.1 compliance
- Schema references exist
- No duplicate operationIds

### Generate Types

```bash
# TypeScript types
pnpm --filter openapi generate:types

# Zod schemas
pnpm --filter openapi generate:zod
```

## Best Practices

- **Descriptive summaries** — each endpoint should have a clear summary
- **Detailed descriptions** — explain what the endpoint does, when to use it
- **Example values** — include examples in schemas
- **Error responses** — document all possible error codes (400, 401, 403, 404, etc.)
- **Consistent naming** — use camelCase for properties, kebab-case for paths
- **Reuse schemas** — use `$ref` instead of duplicating schema definitions
- **Tag organization** — group related endpoints with tags

## Scalar Documentation

The OpenAPI spec is served at `/docs` using Scalar UI.

Scalar features:

- Interactive API playground
- Code generation in multiple languages
- Request/response examples
- Authentication flows

## Common Patterns

### Pagination Response

```yaml
PaginatedResponse:
  type: object
  required:
    - data
    - nextCursor
  properties:
    data:
      type: array
      items:
        $ref: '#/components/schemas/Resource'
    nextCursor:
      type: string
      nullable: true
```

### Error Response

```yaml
ErrorResponse:
  type: object
  required:
    - error
  properties:
    error:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: object
          additionalProperties: true
```

### Path Parameters

```yaml
parameters:
  - name: slug
    in: path
    required: true
    description: Organization slug
    schema:
      type: string
      pattern: '^[a-z0-9-]+$'
```

### Query Parameters

```yaml
parameters:
  - name: cursor
    in: query
    required: false
    description: Pagination cursor
    schema:
      type: string
  - name: limit
    in: query
    required: false
    description: Number of items to return
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20
```

## Phase 3 Specific Patterns

### Multi-Tenant Endpoints

All organization-scoped endpoints follow this pattern:

```yaml
/orgs/{slug}/members:
  get:
    summary: List organization members
    security:
      - bearerAuth: []
    parameters:
      - $ref: '#/components/parameters/OrgSlug'
    responses:
      '200':
        description: Success
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MembersList'
      '401':
        $ref: '#/components/responses/Unauthorized'
      '403':
        $ref: '#/components/responses/Forbidden'
      '404':
        $ref: '#/components/responses/NotFound'
```

### Role-Based Security

Document required roles using OpenAPI extensions:

```yaml
/orgs/{slug}/invitations:
  post:
    summary: Create invitation
    x-required-role: admin # Custom extension for documentation
    security:
      - bearerAuth: []
```

### Common Parameters

Define reusable parameters:

```yaml
components:
  parameters:
    OrgSlug:
      name: slug
      in: path
      required: true
      description: Organization slug (user-friendly identifier)
      schema:
        type: string
        pattern: '^[a-z0-9-]+$'
        example: 'acme'
```

### Error Codes for Phase 3

| Endpoint    | Error Code            | Status | Description               |
| ----------- | --------------------- | ------ | ------------------------- |
| All         | `UNAUTHENTICATED`     | 401    | No valid auth token       |
| All         | `NOT_ORG_MEMBER`      | 403    | User not in org           |
| All         | `FORBIDDEN`           | 403    | Insufficient role         |
| All         | `ORG_NOT_FOUND`       | 404    | Org doesn't exist         |
| Invitations | `INVITATION_EXPIRED`  | 400    | Token past expiry         |
| Invitations | `ALREADY_MEMBER`      | 409    | User already in org       |
| Membership  | `LAST_OWNER`          | 400    | Cannot remove last owner  |
| Membership  | `CANNOT_DEMOTE_OWNER` | 403    | Admin cannot demote owner |

---

## Phase 4 — Documentation Excellence

Phase 4 focuses on API documentation completeness and developer experience. The OpenAPI spec should
be comprehensive, accurate, and developer-friendly.

### Documentation Completeness Checklist

For every endpoint, ensure:

1. **Clear Summary** — Concise one-line description (50 chars max)
2. **Detailed Description** — Explains what the endpoint does, when to use it, and any important
   behaviors
3. **Complete Parameters** — All path, query, and body parameters documented with types,
   descriptions, constraints
4. **All Responses** — Success and all error responses (400, 401, 403, 404, 409, 410, 500)
5. **Realistic Examples** — Request and response examples that developers can copy-paste
6. **Security Docs** — Clear indication of auth requirements and required roles
7. **Tags** — Properly categorized for logical grouping in Scalar UI

### Request/Response Examples

**IMPORTANT:** All endpoints should include realistic examples that developers can use as templates.

Good example:

```yaml
/api/v1/orgs:
  post:
    summary: Create organization
    description: |
      Create a new organization and automatically assign the authenticated user as OWNER.
      The organization slug must be unique across the platform and will be used in URLs.
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/CreateOrganizationRequest'
          example:
            name: 'Acme Corporation'
            slug: 'acme-corp'
    responses:
      '201':
        description: Organization created successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrganizationWithMembership'
            example:
              id: 'clx1234567890abcdef'
              name: 'Acme Corporation'
              slug: 'acme-corp'
              createdAt: '2026-05-28T14:30:00.000Z'
              updatedAt: '2026-05-28T14:30:00.000Z'
              membership:
                id: 'clx9876543210zyxwvu'
                role: 'OWNER'
                createdAt: '2026-05-28T14:30:00.000Z'
```

### Error Response Documentation

**Every endpoint must document all possible error responses** with realistic examples:

```yaml
responses:
  '400':
    description: Validation error - request body is invalid
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
        example:
          error:
            code: 'VALIDATION_ERROR'
            message: 'Slug must be between 3 and 63 characters'
            details:
              field: 'slug'
              constraint: 'minLength'

  '401':
    description: Unauthenticated - missing or invalid access token
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
        example:
          error:
            code: 'UNAUTHENTICATED'
            message: 'Access token is missing or invalid'
            details: {}

  '403':
    description: Forbidden - insufficient permissions
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
        example:
          error:
            code: 'FORBIDDEN'
            message: 'This operation requires ADMIN role'
            details:
              required: 'ADMIN'
              actual: 'MEMBER'

  '404':
    description: Organization not found or not a member
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
        example:
          error:
            code: 'ORG_NOT_FOUND'
            message: 'Organization not found'
            details: {}

  '409':
    description: Conflict - organization slug already exists
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/Error'
        example:
          error:
            code: 'ORG_SLUG_EXISTS'
            message: 'An organization with this slug already exists'
            details:
              slug: 'acme-corp'
```

### Pagination Documentation

For paginated endpoints, clearly document cursor-based pagination:

```yaml
parameters:
  - name: cursor
    in: query
    required: false
    description: |
      Pagination cursor returned from previous request's `nextCursor` field.
      Omit this parameter to get the first page of results.
    schema:
      type: string
    example: 'clx1234567890abcdef'

  - name: limit
    in: query
    required: false
    description: Number of items to return per page
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20
    example: 20

responses:
  '200':
    description: Paginated list of members
    content:
      application/json:
        schema:
          type: object
          required:
            - data
            - nextCursor
          properties:
            data:
              type: array
              items:
                $ref: '#/components/schemas/Membership'
            nextCursor:
              type: string
              nullable: true
              description: Cursor for next page, or null if no more pages
        example:
          data:
            - id: 'clx1234567890abcdef'
              role: 'OWNER'
              userId: 'clx1111111111111111'
              user:
                id: 'clx1111111111111111'
                name: 'John Doe'
                email: 'john@acme.com'
              createdAt: '2026-05-20T10:00:00.000Z'
            - id: 'clx2345678901bcdefg'
              role: 'ADMIN'
              userId: 'clx2222222222222222'
              user:
                id: 'clx2222222222222222'
                name: 'Jane Smith'
                email: 'jane@acme.com'
              createdAt: '2026-05-22T15:30:00.000Z'
          nextCursor: 'clx2345678901bcdefg'
```

### Security Scheme Documentation

For endpoints with different auth methods:

```yaml
# JWT-only endpoint
/api/v1/orgs:
  post:
    security:
      - bearerAuth: []
    description: Requires JWT access token (user authentication)

# JWT or API key
/api/v1/orgs/{slug}/members:
  get:
    security:
      - bearerAuth: []
      - apiKeyAuth: []
    description: |
      Authenticate with either a JWT access token or an API key with `members:read` scope.

# Public endpoint (no auth)
/api/v1/invitations/validate/{token}:
  get:
    security: []
    description: Public endpoint - no authentication required
```

### Scalar-Specific Optimization

Scalar UI provides interactive documentation. Optimize for it:

1. **Use descriptive summaries** — They appear as endpoint titles in Scalar
2. **Add markdown to descriptions** — Scalar renders markdown (lists, code blocks, etc.)
3. **Include code examples** — Scalar shows language-specific examples
4. **Use meaningful operationIds** — They're used for code generation
5. **Group with tags** — Scalar organizes endpoints by tags

### Type Safety Guidelines

For TypeScript type generation to work correctly:

1. **Use proper types** — `string`, `integer`, `boolean`, `array`, `object` (not "String")
2. **Mark required fields** — Use `required: [field1, field2]` at the schema level
3. **Use `$ref` for reuse** — Don't duplicate schema definitions
4. **Avoid `additionalProperties: true`** — Unless intentionally allowing arbitrary props
5. **Use `nullable: true`** — For fields that can be null (not `type: ['string', 'null']`)
6. **Use enums** — For fixed sets of values (role: OWNER | ADMIN | MEMBER)

### Multi-Tenant URL Consistency

All organization-scoped resources follow this URL structure:

```
/api/v1/orgs/{slug}/{resource}
/api/v1/orgs/{slug}/{resource}/{resourceId}
/api/v1/orgs/{slug}/{resource}/{resourceId}/{subresource}
```

Examples:

- `/api/v1/orgs/acme/members` — List members
- `/api/v1/orgs/acme/members/clx123` — Specific member
- `/api/v1/orgs/acme/invitations` — List invitations
- `/api/v1/orgs/acme/api-keys` — List API keys

### Developer Experience Best Practices

To create excellent API documentation:

1. **Think like a first-time user** — What would you need to know to use this endpoint?
2. **Document edge cases** — What happens when the invitation expires? When you're the last owner?
3. **Provide context** — Why would a developer call this endpoint?
4. **Show realistic data** — Use plausible IDs, emails, names (not "string", "foo", "bar")
5. **Explain error codes** — Each error code should have a clear, actionable message
6. **Include workflows** — Some operations require multiple API calls (document the flow)

### Validation Against Implementation

The OpenAPI spec should match the actual API implementation:

1. **Zod schemas are source of truth** — OpenAPI should reflect Zod validation rules
2. **Test responses match spec** — Run API calls and compare response shapes
3. **Error codes match** — AppError codes in codebase should match OpenAPI error examples
4. **Status codes match** — Controller status codes should match OpenAPI responses

### Commands for Phase 4

Use these commands to maintain documentation quality:

- `/sync-openapi` — Comprehensive workflow to verify spec accuracy
- `/review` — Pre-PR checklist including OpenAPI validation
- Validate spec: `pnpm --filter openapi validate`
- Generate types: `pnpm --filter openapi generate:types`
- View docs: http://localhost:3001/docs (when API is running)

### Common Phase 4 Tasks

**Adding a new endpoint:**

1. Implement route + controller + Zod validation
2. Add endpoint to `openapi.yaml` with full documentation
3. Include request/response examples
4. Document all error responses
5. Run `pnpm --filter openapi validate`
6. Run `pnpm --filter openapi generate:types`
7. Test in Scalar UI at `/docs`

**Updating an existing endpoint:**

1. Update implementation and Zod schema
2. Update OpenAPI spec to match
3. Update examples if needed
4. Regenerate types
5. Verify in Scalar UI

**Fixing documentation gaps:**

1. Run `/sync-openapi` to identify issues
2. Add missing descriptions, examples, or error responses
3. Validate and regenerate types
4. Test in Scalar UI

### Phase 4 Quality Standards

Before considering Phase 4 complete, every endpoint should have:

- ✅ Clear, concise summary (< 50 chars)
- ✅ Detailed description explaining purpose and behavior
- ✅ All parameters documented with types and constraints
- ✅ Request body schema with example (if applicable)
- ✅ Success response(s) with example
- ✅ All error responses with examples (400, 401, 403, 404, 409, 410)
- ✅ Proper security scheme(s) applied
- ✅ Appropriate tag for grouping
- ✅ Unique operationId
- ✅ Realistic, copy-pasteable examples
- ✅ Validation in Scalar UI works correctly
