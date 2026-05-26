# Add Migration Command

Guide for creating a new Prisma migration.

## Steps

1. **Modify schema** in `apps/api/prisma/schema.prisma`
2. **Create migration** with descriptive name
3. **Review migration SQL** before applying
4. **Update seed data** if needed
5. **Update types** and regenerate
6. **Test migration** on fresh database

## Migration Naming

Use descriptive names that explain the change:

```bash
# Good examples
pnpm prisma migrate dev --name add_api_keys_table
pnpm prisma migrate dev --name add_organization_slug_index
pnpm prisma migrate dev --name make_user_email_unique

# Bad examples
pnpm prisma migrate dev --name update
pnpm prisma migrate dev --name fix
pnpm prisma migrate dev --name changes
```

## Common Schema Patterns

### Add New Table

```prisma
model ApiKey {
  id             String   @id @default(cuid())
  name           String
  keyHash        String   @unique
  lastUsedAt     DateTime?
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId])
  @@map("api_keys")
}
```

### Add Column to Existing Table

```prisma
model User {
  // ... existing fields
  avatarUrl String?
}
```

### Add Index

```prisma
model Organization {
  slug String @unique

  @@index([slug])
}
```

### Add Foreign Key

```prisma
model Membership {
  userId         String
  user           User @relation(fields: [userId], references: [id], onDelete: Cascade)
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
}
```

## Migration Commands

```bash
# Create migration (development)
pnpm --filter api db:migrate

# Apply migrations (production)
pnpm --filter api db:migrate:deploy

# Reset database (WARNING: deletes all data)
pnpm --filter api db:reset

# Generate Prisma Client
pnpm --filter api db:generate

# Seed database
pnpm --filter api db:seed
```

## Checklist

- [ ] Schema modified in `schema.prisma`
- [ ] Migration created with descriptive name
- [ ] Migration SQL reviewed
- [ ] Migration applied successfully
- [ ] Prisma Client regenerated
- [ ] Seed data updated if needed
- [ ] Types regenerated if schema exports changed
- [ ] Tests updated to handle new schema
- [ ] Migration tested on fresh database
