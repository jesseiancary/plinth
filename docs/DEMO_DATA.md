# Demo Data & QA Credentials

This file documents all seeded data for local development, QA, and demos.

**⚠️ WARNING:** These credentials are for local development only. Never use in production.

---

## Test Users

All users share the same password: `password123`

### 1. Admin User (Primary Demo Account)

- **Email:** `admin@example.com`
- **Password:** `password123`
- **Memberships:**
  - **Acme Corporation** (`/orgs/acme`) - OWNER role
  - **Globex Corporation** (`/orgs/globex`) - ADMIN role
- **Use for:** Testing multi-org scenarios, full permissions, org switching

### 2. Member User

- **Email:** `member@example.com`
- **Password:** `password123`
- **Memberships:**
  - **Acme Corporation** (`/orgs/acme`) - MEMBER role
- **Use for:** Testing limited permissions, read-only scenarios

### 3. Guest User

- **Email:** `guest@example.com`
- **Password:** `password123`
- **Memberships:**
  - **Globex Corporation** (`/orgs/globex`) - OWNER role
- **Use for:** Testing single-org accounts, ownership transfer scenarios

---

## Organizations

### 1. Acme Corporation

- **Slug:** `acme`
- **Name:** Acme Corporation
- **Members:** 2 (Admin as OWNER, Member as MEMBER)
- **Pending Invitations:** 1 (newuser@example.com)
- **API Keys:** 3 (1 active, 1 unused, 1 revoked)

### 2. Globex Corporation

- **Slug:** `globex`
- **Name:** Globex Corporation
- **Members:** 2 (Admin as ADMIN, Guest as OWNER)
- **Pending Invitations:** 0
- **API Keys:** 0

---

## Sample Invitations

### Pending Invitation

- **Email:** `newuser@example.com`
- **Organization:** Acme Corporation
- **Role:** MEMBER
- **Status:** PENDING
- **Expires:** 72 hours from seed
- **Token:** Check seed output (regenerated each time)
- **Use for:** Testing invitation acceptance flow

### Expired Invitation

- **Email:** `expired@example.com`
- **Organization:** Acme Corporation
- **Role:** MEMBER
- **Status:** EXPIRED
- **Use for:** Testing expired invitation error handling

---

## Sample API Keys

### Production API Key

- **Name:** Production API Key
- **Organization:** Acme Corporation
- **Scopes:** `org:read`, `members:read`, `members:write`
- **Status:** Active (last used)
- **Key:** Check seed output (regenerated each time)
- **Use for:** Testing API authentication with full scopes

### CI/CD Pipeline Key

- **Name:** CI/CD Pipeline
- **Organization:** Acme Corporation
- **Scopes:** `org:read`
- **Status:** Active (never used)
- **Key:** Check seed output (regenerated each time)
- **Use for:** Testing limited scope API access

### Revoked API Key

- **Name:** Revoked API Key
- **Organization:** Acme Corporation
- **Scopes:** `org:read`, `members:read`
- **Status:** Revoked (7 days ago)
- **Use for:** Testing revoked key rejection

---

## QA Test Scenarios

### Multi-Tenancy Testing

1. Log in as `admin@example.com`
2. Use org switcher to toggle between Acme and Globex
3. Verify tenant isolation (cannot see other org's data)

### Role-Based Access Testing

1. **As admin@example.com (OWNER of Acme):**
   - Can manage members, settings, API keys
   - Can delete organization
   - Cannot be removed

2. **As member@example.com (MEMBER of Acme):**
   - Can view members
   - Cannot remove members
   - Cannot access settings or API keys

3. **As admin@example.com (ADMIN of Globex):**
   - Can manage members and settings
   - Cannot delete organization (only OWNER can)
   - Can be removed by the owner

### Invitation Flow Testing

1. Log in as admin (OWNER of Acme)
2. Send invitation to test email
3. Log out, accept invitation (use token from seed output)
4. Verify new member is added

### API Key Testing

1. Use Production API Key from seed output
2. Make API request with `Authorization: Bearer sk_live_...`
3. Verify access granted
4. Try with revoked key, verify 401 error

---

## Re-seeding

To reset database to initial state:

```bash
pnpm --filter api db:seed
```

**Note:** API keys and invitation tokens are regenerated each time. Check console output for new values.

---

## Frontend Demo Flow

### Recommended Demo Path:

1. **Start:** Navigate to `http://localhost:5173`
2. **Login:** Use `admin@example.com` / `password123`
3. **Dashboard:** Auto-redirects to `/orgs/acme/members`
4. **Org Switcher:** Click dropdown, select "Globex Corporation"
5. **Navigation:** Use sidebar to explore Members, Settings, API Keys
6. **Logout:** Click user menu → Sign out

### Expected Behavior:

- ✅ Auth persists on page refresh (localStorage)
- ✅ Org selection persists (localStorage)
- ✅ Protected routes redirect to /login when not authenticated
- ✅ 401 responses trigger automatic token refresh
- ✅ Failed refresh redirects to /login

---

## Database State After Seed

```
Users: 3
Organizations: 2
Memberships: 4
  - admin@example.com → acme (OWNER)
  - admin@example.com → globex (ADMIN)
  - member@example.com → acme (MEMBER)
  - guest@example.com → globex (OWNER)
Invitations: 2 (1 pending, 1 expired)
API Keys: 3 (2 active, 1 revoked)
```
