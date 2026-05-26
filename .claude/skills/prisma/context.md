# Prisma Skill Context

Auto-loaded when working on database schema, migrations, or Prisma queries.

## Schema Location

`apps/api/prisma/schema.prisma`

## Core Models

### User

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]

  @@map("users")
}
```

### Organization

```prisma
model Organization {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memberships Membership[]
  invitations Invitation[]
  apiKeys     ApiKey[]

  @@index([slug])
  @@map("organizations")
}
```

### Membership (Many-to-Many)

```prisma
model Membership {
  id             String   @id @default(cuid())
  role           Role     @default(MEMBER)
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([userId, organizationId])
  @@index([organizationId])
  @@index([userId])
  @@map("memberships")
}

enum Role {
  OWNER
  ADMIN
  MEMBER
}
```

### Invitation

```prisma
model Invitation {
  id             String   @id @default(cuid())
  email          String
  role           Role     @default(MEMBER)
  token          String   @unique
  expiresAt      DateTime
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedById    String
  createdAt      DateTime @default(now())

  @@index([organizationId])
  @@index([token])
  @@map("invitations")
}
```

### ApiKey

```prisma
model ApiKey {
  id             String    @id @default(cuid())
  name           String
  keyHash        String    @unique
  lastUsedAt     DateTime?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([organizationId])
  @@map("api_keys")
}
```

## Migration Workflow

### Create Migration

```bash
# Development (creates migration + applies it)
pnpm --filter api db:migrate

# Production (only applies migrations)
pnpm --filter api db:migrate:deploy
```

### Reset Database

```bash
# WARNING: Deletes all data
pnpm --filter api db:reset
```

### Generate Prisma Client

```bash
pnpm --filter api db:generate
```

### Seed Database

```bash
pnpm --filter api db:seed
```

## Query Patterns

### Tenant Isolation (CRITICAL)

**ALWAYS filter by `organizationId` for tenant-scoped resources:**

```typescript
// ✅ Correct
const members = await prisma.membership.findMany({
  where: { organizationId: req.tenantId },
})

// ❌ WRONG — security bug!
const members = await prisma.membership.findMany({
  where: { organizationId: req.body.organizationId },
})
```

### Include Relations

```typescript
const org = await prisma.organization.findUnique({
  where: { slug: 'acme' },
  include: {
    memberships: {
      include: {
        user: true,
      },
    },
  },
})
```

### Pagination (Cursor-Based)

```typescript
const members = await prisma.membership.findMany({
  where: { organizationId: tenantId },
  take: limit + 1, // Fetch one extra to check if there's a next page
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { createdAt: 'desc' },
})

const hasMore = members.length > limit
const data = hasMore ? members.slice(0, -1) : members
const nextCursor = hasMore ? data[data.length - 1].id : null
```

### Transactions

```typescript
await prisma.$transaction(async (tx) => {
  const org = await tx.organization.create({
    data: { name: 'Acme', slug: 'acme' },
  })

  await tx.membership.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      role: 'OWNER',
    },
  })
})
```

### Unique Constraints

```typescript
try {
  await prisma.organization.create({
    data: { name: 'Acme', slug: 'acme' },
  })
} catch (error) {
  if (error.code === 'P2002') {
    throw new AppError('Organization slug already exists', 409, 'SLUG_TAKEN')
  }
  throw error
}
```

## Indexing Strategy

### When to Add Indexes

- Foreign keys (automatically indexed by Prisma)
- Fields used in `where` clauses frequently
- Fields used for sorting (`orderBy`)
- Unique constraints
- Composite keys for joins

### Example Indexes

```prisma
model Membership {
  // ... fields

  @@unique([userId, organizationId]) // Prevents duplicate memberships
  @@index([organizationId]) // Fast lookup by org
  @@index([userId]) // Fast lookup by user
}
```

## Common Prisma Errors

| Code  | Meaning                       | Solution                           |
| ----- | ----------------------------- | ---------------------------------- |
| P2002 | Unique constraint violation   | Check for duplicates before insert |
| P2025 | Record not found              | Handle 404 case                    |
| P2003 | Foreign key constraint failed | Ensure related record exists       |
| P2016 | Query interpretation error    | Check query syntax                 |

## Best Practices

- **Always use transactions** for multi-step operations
- **Never use `prisma.$queryRaw`** unless absolutely necessary (document why)
- **Soft deletes** — consider adding `deletedAt` instead of hard deletes
- **Audit trails** — use `createdAt` and `updatedAt` on all models
- **Cascade deletes** — use `onDelete: Cascade` for dependent records
- **Indexes** — add indexes for frequently queried fields
- **Enums** — use Prisma enums for fixed sets of values (role, status, etc.)

## Connection Pooling

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

Default connection pool size: 10 connections per CPU core (configurable via `DATABASE_URL`).

## Testing with Prisma

```typescript
import { prisma } from '../lib/prisma'

beforeEach(async () => {
  // Reset database to known state
  await prisma.membership.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
})
```
