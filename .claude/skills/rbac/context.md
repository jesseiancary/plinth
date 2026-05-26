# RBAC Skill Context

Auto-loaded when working on role-based access control, permissions, or membership logic.

## Role Hierarchy

```
owner > admin > member
```

### Owner

- **Full control** of the organization
- Can manage all members and invitations
- Can transfer ownership
- Cannot be removed (must transfer ownership first)
- Only one owner per organization

### Admin

- Can manage members (invite, remove, change roles)
- Can manage invitations
- Can manage API keys
- Cannot demote or remove owner
- Cannot promote members to owner

### Member

- Read access to organization resources
- Cannot manage members or invitations
- Cannot manage API keys
- Cannot access billing settings

## Permission Matrix

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| View organization | ✅ | ✅ | ✅ |
| Update organization settings | ✅ | ✅ | ❌ |
| Delete organization | ✅ | ❌ | ❌ |
| View members | ✅ | ✅ | ✅ |
| Invite members | ✅ | ✅ | ❌ |
| Remove members | ✅ | ✅ | ❌ |
| Change member roles | ✅ | ✅ | ❌ |
| Transfer ownership | ✅ | ❌ | ❌ |
| Create API keys | ✅ | ✅ | ❌ |
| Delete API keys | ✅ | ✅ | ❌ |
| View billing | ✅ | ❌ | ❌ |
| Manage subscription | ✅ | ❌ | ❌ |

## Middleware Implementation

### `requireRole` Middleware

```typescript
import { RequestHandler } from 'express'
import { AppError } from '../lib/errors'
import { Role } from '@prisma/client'

const roleHierarchy: Record<Role, number> = {
  OWNER: 3,
  ADMIN: 2,
  MEMBER: 1,
}

export const requireRole = (minRole: Role): RequestHandler => {
  return (req, res, next) => {
    const userRole = req.membership?.role

    if (!userRole) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED')
    }

    if (roleHierarchy[userRole] < roleHierarchy[minRole]) {
      throw new AppError('Insufficient permissions', 403, 'FORBIDDEN')
    }

    next()
  }
}
```

### Usage in Routes

```typescript
import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'

const router = Router()

// Anyone in the org can view members
router.get(
  '/orgs/:slug/members',
  authenticate,
  requireRole('MEMBER'),
  MemberController.list
)

// Only admins and owners can invite
router.post(
  '/orgs/:slug/invitations',
  authenticate,
  requireRole('ADMIN'),
  InvitationController.create
)

// Only owners can delete the org
router.delete(
  '/orgs/:slug',
  authenticate,
  requireRole('OWNER'),
  OrganizationController.delete
)
```

## Special Permission Rules

### Transfer Ownership

- Only current owner can transfer
- Cannot transfer to non-member
- Previous owner becomes admin
- New owner must accept (via confirmation flow)

```typescript
export const transferOwnership = async (orgId: string, newOwnerId: string, currentOwnerId: string) => {
  await prisma.$transaction([
    // Demote current owner to admin
    prisma.membership.update({
      where: {
        userId_organizationId: {
          userId: currentOwnerId,
          organizationId: orgId,
        },
      },
      data: { role: 'ADMIN' },
    }),
    // Promote new owner
    prisma.membership.update({
      where: {
        userId_organizationId: {
          userId: newOwnerId,
          organizationId: orgId,
        },
      },
      data: { role: 'OWNER' },
    }),
  ])
}
```

### Remove Member

- Owner can remove anyone except themselves
- Admin can remove members, but not owner or other admins
- Members cannot remove anyone

```typescript
export const canRemoveMember = (removerRole: Role, targetRole: Role): boolean => {
  if (removerRole === 'OWNER') {
    return true // Owner can remove anyone
  }

  if (removerRole === 'ADMIN') {
    return targetRole === 'MEMBER' // Admin can only remove members
  }

  return false // Members cannot remove anyone
}
```

### Change Member Role

- Owner can change anyone's role (except their own)
- Admin can only promote/demote members (not owner or other admins)
- Members cannot change roles

```typescript
export const canChangeRole = (
  changerRole: Role,
  targetRole: Role,
  newRole: Role
): boolean => {
  // Cannot promote to owner (use transfer ownership instead)
  if (newRole === 'OWNER') {
    return false
  }

  if (changerRole === 'OWNER') {
    return targetRole !== 'OWNER' // Owner can change anyone except other owners
  }

  if (changerRole === 'ADMIN') {
    // Admin can only change member roles
    return targetRole === 'MEMBER' && newRole !== 'OWNER'
  }

  return false
}
```

## Invitation Flow

1. Admin/owner creates invitation with specified role
2. Invitation email sent with unique token
3. Recipient clicks link, validates token
4. If email matches existing user, add membership
5. If new user, create account + membership
6. Invitation marked as accepted, cannot be reused

```typescript
export const createInvitation = async (
  orgId: string,
  email: string,
  role: Role,
  invitedById: string
) => {
  // Generate unique token
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invitation = await prisma.invitation.create({
    data: {
      email,
      role,
      token,
      expiresAt,
      organizationId: orgId,
      invitedById,
    },
  })

  // Send invitation email
  await sendInvitationEmail(email, token, orgId)

  return invitation
}
```

## Security Checklist

- [ ] Route protected with `authenticate` middleware
- [ ] Correct role requirement enforced with `requireRole()`
- [ ] Cannot escalate privileges (e.g., member promoting self to admin)
- [ ] Cannot perform actions on other organizations
- [ ] Owner protection (cannot be removed, only transferred)
- [ ] Invitation tokens are unique, single-use, and time-limited
- [ ] Role changes are logged for audit trail

## Common Patterns

### Check If User Is Member

```typescript
const membership = await prisma.membership.findUnique({
  where: {
    userId_organizationId: {
      userId: req.user.id,
      organizationId: org.id,
    },
  },
})

if (!membership) {
  throw new AppError('Not a member of this organization', 403, 'NOT_MEMBER')
}
```

### Get User's Role in Organization

```typescript
const membership = await prisma.membership.findUnique({
  where: {
    userId_organizationId: {
      userId: req.user.id,
      organizationId: req.tenantId,
    },
  },
  select: { role: true },
})

const userRole = membership?.role
```

### List Organizations User Belongs To

```typescript
const orgs = await prisma.organization.findMany({
  where: {
    memberships: {
      some: {
        userId: req.user.id,
      },
    },
  },
  include: {
    memberships: {
      where: { userId: req.user.id },
      select: { role: true },
    },
  },
})
```
