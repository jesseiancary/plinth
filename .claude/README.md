# .claude Directory

This directory contains configuration and context for Claude Code, enabling disciplined AI-assisted
development.

## Directory Structure

```
.claude/
├── rules/           # Always-active code guidelines
│   ├── code-style.md
│   ├── api-conventions.md
│   ├── testing.md
│   └── git.md
├── commands/        # Slash commands for workflows
│   ├── review.md
│   ├── add-endpoint.md
│   ├── add-migration.md
│   └── fix-issue.md
├── skills/          # Auto-loaded context for domains
│   ├── openapi/
│   ├── prisma/
│   └── rbac/
├── agents/          # Specialized subagent definitions
│   ├── code-reviewer.json
│   ├── api-designer.json
│   └── db-architect.json
└── hooks/           # Event-driven scripts
    ├── validate-types.sh
    ├── lint-staged.sh
    └── README.md
```

## Rules (Always Active)

Rules are always loaded and enforced during development:

- **code-style.md** — TypeScript strict mode, const-only, named exports, type safety
- **api-conventions.md** — REST design, status codes, error shapes, tenant isolation
- **testing.md** — Integration-first, database reset patterns, coverage requirements
- **git.md** — Conventional commits, branch naming, PR workflow

## Commands (Invoke with `/command-name`)

Slash commands provide repeatable workflows:

- `/review` — Pre-PR checklist: types, tests, OpenAPI sync, security, edge cases, documentation
- `/review-dx` — Developer experience review: API design, docs quality, error messages
- `/add-endpoint` — Scaffold new route: controller + schema + OpenAPI + tests
- `/add-migration` — Prisma schema change workflow with validation
- `/fix-issue` — Structured bug investigation: reproduce → isolate → fix → test
- `/sync-openapi` — Verify OpenAPI spec accuracy and regenerate types

## Skills (Auto-Loaded)

Skills are automatically loaded based on task context:

- **openapi/** — Loaded when working on API spec, type generation, or documentation
- **prisma/** — Loaded when modifying schema, migrations, or database queries
- **rbac/** — Loaded when working on permissions, roles, or membership logic

## Agents (Specialized Subagents)

Agents are invoked for specific domains requiring isolated context:

- **code-reviewer** — Security and correctness focused review (tenant isolation, auth, input
  validation)
- **api-designer** — REST design decisions and OpenAPI spec guidance
- **db-architect** — Schema design, indexing strategy, query optimization

## Hooks (Event-Driven Scripts)

Hooks run in response to specific events:

- **validate-types.sh** — Runs `tsc --noEmit` before Claude edits TypeScript files
- **lint-staged.sh** — ESLint + Prettier on staged files before commit
- **validate-openapi.sh** — Validates OpenAPI spec and ensures types are regenerated

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
