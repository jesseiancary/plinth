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
