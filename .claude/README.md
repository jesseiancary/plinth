# .claude Directory

This directory contains configuration and context for Claude Code, enabling disciplined AI-assisted
development.

## Directory Structure

```
.claude/
├── rules/           # Always-active code guidelines
│   ├── code-style.md
│   ├── api-conventions.md
│   ├── frontend.md
│   ├── testing.md
│   └── git.md
├── commands/        # Slash commands for workflows
│   ├── review.md
│   ├── review-dx.md
│   ├── add-endpoint.md
│   ├── add-component.md
│   ├── add-page.md
│   ├── add-migration.md
│   ├── fix-issue.md
│   └── sync-openapi.md
├── skills/          # Auto-loaded context for domains
│   ├── openapi/
│   ├── prisma/
│   ├── rbac/
│   ├── react/
│   └── tailwind/
├── agents/          # Specialized subagent definitions
│   ├── code-reviewer.json
│   ├── api-designer.json
│   ├── db-architect.json
│   ├── ui-reviewer.json
│   └── test-architect.json
└── hooks/           # Event-driven scripts
    ├── validate-types.sh
    ├── lint-staged.sh
    └── README.md
```

## Rules (Always Active)

Rules are always loaded and enforced during development:

- **code-style.md** — TypeScript strict mode, const-only, named exports, type safety
- **api-conventions.md** — REST design, status codes, error shapes, tenant isolation, security headers
- **security.md** — OWASP Top 10 2025 security controls (A01-A10, graduated enforcement)
- **frontend.md** — React patterns, feature-based structure, TanStack Query, Tailwind CSS
- **testing.md** — Integration-first, database reset patterns, coverage requirements
- **git.md** — Conventional commits, branch naming, PR workflow

## Commands (Invoke with `/command-name`)

Slash commands provide repeatable workflows:

**Backend:**

- `/review` — Pre-PR checklist: types, tests, OpenAPI sync, OWASP Top 10 security, edge cases
- `/security-audit` — Comprehensive security audit (OWASP Top 10 2025 + threat modeling)
- `/review-dx` — Developer experience review: API design, docs quality, error messages
- `/add-endpoint` — Scaffold new API route: controller + schema + OpenAPI + tests
- `/add-migration` — Prisma schema change workflow with validation
- `/sync-openapi` — Verify OpenAPI spec accuracy and regenerate types

**Frontend:**

- `/add-component` — Scaffold React component with props, tests, and accessibility
- `/add-page` — Scaffold route/page with React Router, layout, and auth protection

**General:**

- `/fix-issue` — Structured bug investigation: reproduce → isolate → fix → test

## Skills (Auto-Loaded)

Skills are automatically loaded based on task context:

**Backend:**

- **openapi/** — API spec structure, type generation, documentation patterns
- **prisma/** — Schema design, migrations, database queries, indexing
- **rbac/** — Permissions, roles, membership logic, tenant isolation
- **security/** — OWASP Top 10 2025 guidance, vulnerability prevention, threat modeling

**Frontend:**

- **react/** — Component patterns, TanStack Query, state management, hooks
- **tailwind/** — Design tokens, component composition, responsive patterns

## Agents (Specialized Subagents)

Agents are invoked for specific domains requiring isolated context:

**Backend:**

- **code-reviewer** — Security and correctness (OWASP Top 10 2025 focus, tenant isolation, auth)
- **security-auditor** — Comprehensive vulnerability assessment and threat modeling (OWASP Top 10 2025)
- **api-designer** — REST design decisions and OpenAPI spec guidance
- **db-architect** — Schema design, indexing strategy, query optimization
- **test-architect** — Test strategy, coverage analysis, test quality

**Frontend:**

- **ui-reviewer** — UX, accessibility (WCAG 2.1), performance, React patterns

## Hooks (Event-Driven Scripts)

Hooks run in response to specific events:

- **validate-types.sh** — Runs `tsc --noEmit` before Claude edits TypeScript files
- **lint-staged.sh** — ESLint + Prettier on staged files before commit
- **validate-openapi.sh** — Validates OpenAPI spec and ensures types are regenerated
- **security-check.sh** — OWASP Top 10 validation (blocks critical issues, warns on moderate)

All hooks are executable shell scripts that return exit code 0 for success.

## Usage Philosophy

This .claude/ directory enables a disciplined workflow that:

1. **Prevents security bugs** — Tenant isolation and auth rules are always enforced
2. **Maintains consistency** — Code style and API conventions are consistent
3. **Reduces mistakes** — Checklists and workflows catch issues before they're committed
4. **Documents decisions** — Skills and agents capture domain knowledge
5. **Accelerates development** — Commands automate repetitive tasks

The goal is not "vibe coding" but **thoughtful, systematic AI-assisted development** with clear
guardrails and repeatable processes.
