---
description: Generate PR title and description following industry best practices
---

# Generate Pull Request Content

Generate a pull request title and description based on the current branch's changes.

## Workflow

1. **Analyze git context:**

   ```bash
   git status
   git diff main...HEAD --stat
   git log main..HEAD --oneline
   git diff main...HEAD
   ```

2. **Review all changes:**
   - Read full diff to understand what changed
   - Identify the primary purpose (feat/fix/refactor/docs/etc.)
   - Note any breaking changes or important details
   - Check for related issues/tickets

3. **Generate PR title** following Conventional Commits format:
   - Format: `type(scope): description`
   - Max 72 characters
   - Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `perf`
   - Use imperative mood ("add" not "added")
   - Examples:
     - `feat(auth): add refresh token rotation`
     - `fix(invitations): prevent expired token reuse`
     - `refactor(prisma): extract member query helpers`

4. **Generate PR description** in markdown with these sections:

   ```markdown
   ## Summary

   [2-4 sentence overview of what this PR does and why]

   ## Changes

   - [Bulleted list of key changes]
   - [Use present tense: "Adds X", "Updates Y", "Fixes Z"]
   - [Group related changes together]

   ## Technical Details

   [Optional: Any implementation notes, architectural decisions, or trade-offs]

   ## Breaking Changes

   [Only if applicable - what breaks and migration path]

   ## Testing

   - [ ] Unit tests added/updated
   - [ ] Integration tests added/updated
   - [ ] Manual testing completed
   - [ ] All tests passing

   ## Security Checklist

   - [ ] No sensitive data exposed in logs or responses
   - [ ] Input validation via Zod on all endpoints
   - [ ] RBAC enforced with `requireRole()` where applicable
   - [ ] Tenant isolation maintained (`req.tenantId` used)
   - [ ] OWASP Top 10 considerations reviewed

   ## Related Issues

   [If applicable: Closes #123, Fixes #456]
   ```

5. **Output format:**

   **CRITICAL: Output raw markdown source code, not rendered markdown.**

   The user needs to copy-paste the markdown source. Format your response like this:

   ````
   **PR Title:**
   chore(scope): description here

   **PR Description (raw markdown - copy this):**
   ```markdown
   ## Summary

   [content here...]

   ## Changes

   - Item 1
   - Item 2

   [etc...]
   ````

   ````

   **RULES:**
   - Put the description inside a markdown code block (```markdown ... ```)
   - This ensures the user sees the raw markdown source, not rendered HTML
   - NO warnings about being on main branch
   - NO instructions for creating feature branches
   - The user handles branching workflow - just provide the title and description
   ````

## Best Practices Applied

### Title Guidelines (Conventional Commits)

- **Type prefix** — Makes PR purpose clear at a glance
- **Scope** — Identifies affected area (optional but recommended)
- **Imperative mood** — "Add feature" not "Added feature" or "Adds feature"
- **Lowercase** — Except for proper nouns (e.g., "Prisma", "RBAC")
- **No period** — Title is a phrase, not a sentence
- **72 char limit** — Ensures readability in git log and GitHub UI

### Description Guidelines (Industry Standard)

- **Summary first** — Busy reviewers should understand the PR in 30 seconds
- **What and Why** — Not just what changed, but why it matters
- **Bulleted changes** — Easier to scan than paragraphs
- **Testing evidence** — Checkboxes show what verification was done
- **Security focus** — Explicit security checklist for this project
- **Linked issues** — Automatic issue closing via GitHub keywords

### Writing Style

- **Present tense** — "Adds" not "Added" (matches Conventional Commits)
- **Active voice** — "This PR adds" not "X is added by this PR"
- **Concrete specifics** — "Reduces query time by 40%" not "Improves performance"
- **Audience-aware** — Assume reviewer knows the codebase but not your thought process

## Example Output

**PR Title:**
feat(invitations): add email notifications for pending invites

**PR Description (raw markdown - copy this):**

```markdown
## Summary

Adds automated email notifications when users are invited to an organization. Invitations previously required manual communication outside the app. This PR integrates SMTP email sending to notify invitees immediately when an invitation is created.

## Changes

- Adds email service using Nodemailer (`apps/api/src/lib/email.ts`)
- Creates invitation email template with accept/decline links
- Sends email asynchronously after invitation creation
- Adds email configuration validation (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
- Updates invitation flow to handle email delivery failures gracefully
- Adds integration tests for email sending logic

## Technical Details

Emails are sent asynchronously after the invitation is created and committed to the database. If email delivery fails, the invitation is still created but a warning is logged. This prevents email service outages from blocking the invitation flow entirely.

Email templates use plain HTML with inline CSS for maximum email client compatibility.

## Testing

- [x] Unit tests added for email template rendering
- [x] Integration tests added for invitation + email flow
- [x] Manual testing completed with real SMTP server (Mailtrap)
- [x] All tests passing

## Security Checklist

- [x] No sensitive data exposed in logs or responses (email addresses logged at info level only)
- [x] Input validation via Zod on email configuration
- [x] RBAC enforced with `requireRole('ADMIN')` on invitation creation
- [x] Tenant isolation maintained (invitations scoped to `req.tenantId`)
- [x] OWASP Top 10 considerations reviewed (no injection vectors in email templates)

## Related Issues

Closes #42

---
```

## Notes

- **DO NOT** create the PR or push to GitHub — only generate the content
- **DO NOT** warn about being on main branch — user handles branching workflow
- **DO NOT** provide instructions for creating feature branches
- **DO** analyze the full diff, not just the latest commit message
- **DO** look for breaking changes and call them out explicitly
- **DO** verify test coverage in the diff before claiming tests were added
- **DO** output raw markdown (no code blocks wrapping the description)

## See Also

- `.claude/rules/git.md` — Conventional commit format
- `.claude/commands/review.md` — Pre-PR code review checklist
- `CLAUDE.md` — Git workflow and PR merge process
