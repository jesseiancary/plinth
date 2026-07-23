# Clarify Command

Transform vague or ambiguous user requests into well-defined, actionable prompts with clear success criteria.

## Purpose

When the user provides a high-level request without sufficient detail, use this command to:

- Gather missing context and requirements
- Surface critical security/RBAC considerations
- Define acceptance criteria and edge cases
- Output a structured, executable prompt
- Ensure nothing important is overlooked

## Process

### 1. Analyze the Request

Identify what's unclear:

- [ ] **Scope unclear** - Which files/features are affected?
- [ ] **Requirements unclear** - What should it do? What shouldn't it do?
- [ ] **Role/permission unclear** - Who can do this? (OWNER/ADMIN/MEMBER/public)
- [ ] **Success criteria unclear** - How do we know it's done?
- [ ] **Edge cases unclear** - What could go wrong?
- [ ] **Testing unclear** - What needs to be tested?

### 2. Ask Clarifying Questions

**Scope & Context:**

- Which part of the codebase is affected? (API, Web, both?)
- Is this a new feature, bug fix, enhancement, or refactoring?
- Are there existing files/endpoints to modify, or start from scratch?
- What's the user journey? (e.g., "User clicks X → sees Y → system does Z")

**Requirements:**

- What problem are we solving? (What's broken or missing?)
- What are the inputs? (User provides X, system receives Y)
- What are the outputs? (System returns Z, UI displays W)
- What should happen in success case? Failure case?
- Are there any constraints? (Performance, compatibility, dependencies)

**Security & Access Control (CRITICAL):**

- Is this an authenticated endpoint or public?
- Which role is required? (OWNER, ADMIN, MEMBER, or different for different operations?)
- Is this organization-scoped? (tenant isolation required?)
- Can users access each other's data? (horizontal escalation check)
- Can members perform admin actions? (vertical escalation check)
- Are there RBAC edge cases? (last owner, owner demotion, cross-tenant access)

**Data Model:**

- Which Prisma models are involved?
- Do we need a migration? (new fields, relations, constraints)
- How is data validated? (Zod schema requirements)
- What indexes might be needed?
- Are there cascade delete implications?

**Frontend (if applicable):**

- Is this a new page or component modification?
- What's the layout? (Dashboard? Auth page? Public page?)
- What are the user interactions? (Form submission? Button click? Navigation?)
- What loading/error/empty states are needed?
- Is this mobile-responsive? Accessible?

**Testing:**

- What are the success cases to test?
- What are the failure cases? (401, 403, 404, 409, 400 validation errors)
- What edge cases need coverage? (expired tokens, last owner, duplicate slugs)
- Do we need integration tests, unit tests, or both?
- What's the expected coverage increase?

**Documentation:**

- Does OpenAPI spec need updating?
- Are there breaking changes?
- Do we need to update README or other docs?

### 3. Surface Critical Requirements

**Always verify these are addressed:**

**🔴 CRITICAL (Must be explicit in prompt):**

- **A01 Broken Access Control:**
  - [ ] Uses `req.tenantId` (NEVER `req.body.organizationId`)
  - [ ] Protected with `authenticate` middleware
  - [ ] Role enforced with `requireRole()` middleware
  - [ ] Prisma queries scoped to `organizationId: req.tenantId`
  - [ ] 404 vs 403 pattern decision documented
  - [ ] RBAC edge cases identified (last owner, owner protection, etc.)

- **A02 Security Misconfiguration:**
  - [ ] Error responses sanitized (no stack traces, DB errors, internals)
  - [ ] No hardcoded secrets
  - [ ] Security headers configured (helmet)

- **A03 Supply Chain:**
  - [ ] New dependencies justified and vetted
  - [ ] No `eval()`, `Function()`, or dynamic `require()`

**🟡 MODERATE (Should be addressed):**

- **A04 Cryptographic Failures:**
  - [ ] Tokens use `crypto.randomBytes()` (NEVER `Math.random()`)
  - [ ] Sensitive data hashed before storage (bcrypt for passwords, SHA-256 for tokens)

- **A05 Injection:**
  - [ ] All inputs validated with Zod
  - [ ] Prisma ORM used (no `$queryRawUnsafe`)
  - [ ] React auto-escaping (no `dangerouslySetInnerHTML` without DOMPurify)

- **A07 Authentication:**
  - [ ] JWT expiry appropriate (≤15min access, 7d refresh)
  - [ ] Rate limiting considered
  - [ ] Generic error messages (prevent account enumeration)

**🔵 ADVISORY (Good to include):**

- Threat modeling (A06)
- Rate limiting on expensive operations (A06)
- Security logging (A09)
- Error handling (A10)

### 4. Output Refined Prompt

Generate a structured prompt with:

```markdown
## Task Summary

[One-sentence description of what needs to be done]

## Context

- **Type:** [New feature | Bug fix | Enhancement | Refactoring]
- **Affected areas:** [API | Web | Both | Specific files]
- **Current behavior:** [What happens now]
- **Desired behavior:** [What should happen]

## Requirements

### Functional

1. [Requirement 1 - specific and testable]
2. [Requirement 2 - specific and testable]
3. [...]

### Security & Access Control

- **Authentication:** [Required | Public]
- **Required role:** [OWNER | ADMIN | MEMBER | N/A]
- **Tenant isolation:** [Yes - uses req.tenantId | No - user-scoped | N/A]
- **RBAC edge cases:** [Last owner protection | Owner demotion prevention | etc.]

### Data Model

- **Models involved:** [User | Organization | Membership | etc.]
- **Migration needed:** [Yes - describe changes | No]
- **Validation:** [List required Zod schemas]

### Frontend (if applicable)

- **UI location:** [Dashboard | Auth page | Public | Component]
- **User flow:** [Step 1 → Step 2 → Step 3]
- **States:** [Loading | Error | Empty | Success]

## Acceptance Criteria

- [ ] [Criterion 1 - measurable]
- [ ] [Criterion 2 - measurable]
- [ ] [...]

## Edge Cases to Handle

- [ ] [Edge case 1 - with expected behavior]
- [ ] [Edge case 2 - with expected behavior]
- [ ] [...]

## Testing Requirements

### Integration Tests

- [ ] Happy path: [describe test]
- [ ] 401 case: [describe test]
- [ ] 403 case: [describe test]
- [ ] 404 case: [describe test]
- [ ] Edge case: [describe test]

### Security Tests

- [ ] Horizontal escalation: [describe test]
- [ ] Vertical escalation: [describe test]
- [ ] Tenant isolation: [describe test]

## Success Criteria

- [ ] All tests pass (including new tests)
- [ ] TypeScript compiles without errors
- [ ] Linter passes
- [ ] Security checklist verified (OWASP A01-A10)
- [ ] OpenAPI spec updated (if API change)
- [ ] Coverage meets 80% threshold
- [ ] Code reviewed against security rules

## Related Files

- [File 1 - why it's relevant]
- [File 2 - why it's relevant]
- [...]

## Open Questions

- [ ] [Question 1 - needs user decision]
- [ ] [Question 2 - needs user decision]
```

## Example Usage

**Vague request:**

> "Add a way for users to manage team members"

**After /clarify:**

```markdown
## Task Summary

Implement member management endpoints for organizations (list, add, remove, update role)

## Context

- **Type:** New feature (Phase 3 - Multi-Tenancy)
- **Affected areas:** API (`apps/api/src/routes/members.ts`)
- **Current behavior:** No member management endpoints exist
- **Desired behavior:** Org admins can view/add/remove members, update roles

## Requirements

### Functional

1. List all members in an organization (with pagination)
2. Add a new member to an organization (invite flow handled separately)
3. Remove a member from an organization
4. Update a member's role (MEMBER ↔ ADMIN, protect OWNER)

### Security & Access Control

- **Authentication:** Required (JWT)
- **Required role:** ADMIN or OWNER (MEMBER can only view)
- **Tenant isolation:** Yes - all queries scoped to `req.tenantId`
- **RBAC edge cases:**
  - Cannot remove last OWNER
  - Cannot demote OWNER (transfer ownership required)
  - Admin cannot modify OWNER role
  - Cannot remove self if last OWNER

### Data Model

- **Models involved:** Membership, User, Organization
- **Migration needed:** No (schema already exists)
- **Validation:** ParamsSchema (slug, userId), UpdateRoleSchema (role enum)

## Acceptance Criteria

- [ ] GET /api/v1/orgs/:slug/members returns paginated member list
- [ ] DELETE /api/v1/orgs/:slug/members/:userId removes member (if not last owner)
- [ ] PATCH /api/v1/orgs/:slug/members/:userId updates role (respects RBAC rules)
- [ ] All endpoints return 403 for non-members
- [ ] All endpoints return 403 for insufficient role
- [ ] Owner protection rules enforced

## Edge Cases to Handle

- [ ] Attempting to remove last owner → 400 LAST_OWNER
- [ ] Admin trying to demote owner → 403 FORBIDDEN
- [ ] Owner trying to demote self → 400 CANNOT_DEMOTE_SELF
- [ ] Removing non-existent member → 404 MEMBER_NOT_FOUND
- [ ] Cross-tenant member access → 403 FORBIDDEN

## Testing Requirements

### Integration Tests

- [ ] Happy path: Admin removes member (200)
- [ ] 401 case: Unauthenticated request
- [ ] 403 case: Non-member tries to list members
- [ ] 403 case: Member tries to remove another member
- [ ] 404 case: Remove non-existent member
- [ ] 400 case: Attempt to remove last owner

### Security Tests

- [ ] Horizontal: User A cannot remove members from Org B
- [ ] Vertical: Member cannot remove Admin
- [ ] Tenant isolation: Queries filter by organizationId

## Success Criteria

- [ ] All tests pass (20+ new tests)
- [ ] TypeScript strict mode passes
- [ ] Security checklist verified (A01-A07)
- [ ] OpenAPI spec updated with 4 new endpoints
- [ ] Coverage ≥80% on new routes
- [ ] /review checklist passes

## Related Files

- `apps/api/src/routes/members.ts` - New route file
- `apps/api/src/middleware/rbac.ts` - Role enforcement
- `apps/api/src/lib/validation/members.ts` - Zod schemas
- `apps/api/prisma/schema.prisma` - Membership model reference

## Open Questions

- [ ] Should members be able to view other members? (Decision: Yes, MEMBER+ can view)
- [ ] Should we log member additions/removals? (Decision: Yes, use logMembershipChanged)
```

## When to Use This Command

Use `/clarify` when:

- User request is high-level or vague ("add auth", "fix the bug", "make it better")
- Requirements are incomplete (missing role, scope, or edge cases)
- Security implications are unclear
- You need to verify assumptions before starting work
- Task seems simple but might have hidden complexity
- User is new to the project and may not know conventions

## When NOT to Use This Command

Skip `/clarify` when:

- Request is already well-defined with clear acceptance criteria
- It's a trivial task (typo fix, update dependency)
- You're confident you understand all requirements
- User has explicitly provided detailed specifications

## Integration with Existing Workflows

After clarifying:

1. **Start with TDD:** Use `/tdd` command to implement with test-first approach
2. **Security review:** Reference `/security-audit` for deep security analysis
3. **Before PR:** Use `/review` to verify all clarified requirements were met
4. **Challenge assumptions:** Use `/grill` to stress-test the refined prompt

## Notes

- This command is about **asking the right questions**, not making assumptions
- **Always surface security implications** - tenant isolation bugs are the highest risk
- **Force specificity** - "handle errors" → "return 404 if org not found, 403 if not member"
- **Make tradeoffs explicit** - if multiple approaches exist, list pros/cons and ask user to choose
- **Document decisions** - open questions become documented requirements
