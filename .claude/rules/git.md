# Git Conventions

## Commit Messages

Use **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance (deps, config, etc.)
- `docs` — documentation changes
- `refactor` — code change that neither fixes a bug nor adds a feature
- `test` — adding or updating tests
- `ci` — continuous integration changes
- `perf` — performance improvements
- `style` — code style changes (formatting, etc.)

### Scope

Optional but recommended. Examples: `auth`, `invitations`, `api`, `web`, `prisma`, `deps`.

### Examples

```
feat(auth): add refresh token rotation
fix(invitations): handle expired token edge case
chore(deps): upgrade prisma to 6.x
docs(openapi): document membership endpoints
refactor(api): extract validation middleware
test(auth): add integration tests for login flow
ci: add typecheck step to GitHub Actions
```

### Guidelines

- **Use imperative mood** — "add feature" not "added feature"
- **Lowercase** — start with lowercase letter
- **No period** at the end of the description
- **Keep it short** — ideally under 72 characters
- **Be specific** — "fix null check in user query" is better than "fix bug"

## Branch Naming

Format: `<type>/<slug>`

Examples:

- `feat/refresh-token-rotation`
- `fix/invitation-expiry`
- `chore/upgrade-prisma`
- `docs/openapi-spec`

### Guidelines

- **Use kebab-case** for slugs
- **Keep it short** — under 50 characters
- **Be descriptive** — "feat/user-auth" is better than "feat/new-stuff"

## Branching Strategy

- **Never commit directly to `main`** — always use a feature branch.
- **Create a PR** for all changes — even small fixes.
- **Require CI to pass** before merging.
- **Squash merge** — keep main history clean.
- **Delete branch** after merging.

## Pull Requests

- **Use the `/review` command** before creating a PR.
- **Descriptive title** — use conventional commit format.
- **PR description** should include:
  - Summary of changes
  - Test plan
  - Screenshots (if UI changes)
  - Breaking changes (if any)

### PR Template

```markdown
## Summary

- Added refresh token rotation to auth flow
- Updated JWT middleware to validate refresh tokens
- Added integration tests for token refresh

## Test plan

- [ ] Manual test: login and refresh token
- [ ] Integration tests pass
- [ ] No breaking changes to existing endpoints
```

## Git Hooks

- **Pre-commit:** Lint and format staged files
- **Pre-push:** Run type check and tests

Configured via `.claude/hooks/` directory.

## Commit Hygiene

- **One logical change per commit** — don't mix unrelated changes.
- **Commit often** — small commits are easier to review and revert.
- **Write meaningful messages** — future you will thank you.
- **Don't commit secrets** — use `.env` files and `.gitignore`.

## Merge Conflicts

- **Resolve locally** before pushing.
- **Test after resolving** — make sure nothing broke.
- **Ask for help** if unsure — better to ask than break something.
