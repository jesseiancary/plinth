# Agents Directory

This directory contains specialized Claude Code agents for disciplined AI-assisted development. Each agent is a focused expert with isolated context and specific tools.

## What Are Agents?

Agents are **sub-instances of Claude** that run autonomously with:

- **Isolated context** — agents don't share conversation history with the main session
- **Specialized prompts** — tailored system instructions for specific domains
- **Controlled tool access** — only the tools needed for their task
- **Model selection** — haiku (fast), sonnet (balanced), opus (deep reasoning)
- **Persistent memory** — a per-agent file that survives across invocations, since conversation
  history does not (see [Agent Memory](#agent-memory))

## When Agents Are Invoked

### 1. Natural Language Detection (Automatic)

Claude Code automatically launches agents when your request matches their trigger patterns:

```
You: "Review this code for security issues"
→ Launches: security-auditor agent

You: "Help me design a REST API for user profiles"
→ Launches: api-designer agent

You: "Optimize this Prisma query, it's too slow"
→ Launches: db-architect agent
```

### 2. Explicit Task Tool Invocation (Manual)

You can explicitly request an agent using the Task tool:

```
You: "Use the form-engineer agent to review this form component"
→ Claude uses Task tool with subagent_type: "form-engineer"
```

### 3. From Slash Commands

Some commands automatically use agents:

```
/security-audit → Launches security-auditor agent
/review → Launches code-reviewer agent
```

### 4. Context-Based Auto-Loading

When working on specific file types, Claude may proactively use agents:

- Editing `.prisma` files → db-architect
- Modifying `openapi.yaml` → openapi-specialist
- Creating forms → form-engineer

## Available Agents

### Security & Code Quality

**code-reviewer** (sonnet, 🔴 red)

- **Purpose**: Security and correctness focused code review
- **Specialties**: OWASP Top 10 2025, multi-tenant isolation, RBAC edge cases
- **Use when**: Ready to commit, need pre-PR review, suspect security issues
- **Tools**: Read, Grep, Glob, Bash, Write (memory file only)
- **Triggers**: "review this", "check for security issues", "is this code safe"

**security-auditor** (opus, 🔴 red)

- **Purpose**: Comprehensive security audit and threat modeling
- **Specialties**: Vulnerability scanning, attack surface analysis, defense-in-depth
- **Use when**: Major feature complete, before production, compliance requirements
- **Tools**: Read, Grep, Glob, Bash, Write (memory file only)
- **Triggers**: "security audit", "find vulnerabilities", "threat model"

**ui-reviewer** (sonnet, 🟢 green)

- **Purpose**: Frontend UX, accessibility (WCAG 2.1 AA), performance
- **Specialties**: React 19 patterns, Tailwind 4.3, TanStack Query v5, a11y
- **Use when**: UI component ready, need accessibility check, UX feedback
- **Tools**: Read, Grep, Glob, Write (memory file only)
- **Triggers**: "review this component", "check accessibility", "UX feedback"

**quality-and-style-reviewer** (sonnet, 🩵 cyan)

- **Purpose**: Code quality and style review of uncommitted changes only (naming, duplication,
  consistency, style-rule conformance) — no security or correctness
- **Specialties**: Layered on top of `.claude/rules/code-style.md` and `.claude/rules/frontend.md`
- **Use when**: Before committing, want a quick style pass on the working tree
- **Tools**: Read, Grep, Glob, Bash, Write (memory file only)
- **Triggers**: "review my changes for style", "quality pass on the diff", "check uncommitted changes"

### API & Backend

**api-designer** (sonnet, 🔵 blue)

- **Purpose**: REST API design, OpenAPI spec, endpoint conventions
- **Specialties**: RESTful URLs, status codes, error shapes, pagination patterns
- **Use when**: Designing new endpoints, API contract decisions, OpenAPI updates
- **Tools**: Read, Grep, Glob, WebFetch, Write (memory file only)
- **Triggers**: "design an API for", "what HTTP status", "REST endpoint structure"

**db-architect** (sonnet, 🟣 purple)

- **Purpose**: Prisma schema design, query optimization, indexing strategy
- **Specialties**: N+1 prevention, cursor pagination, tenant isolation indexes
- **Use when**: Schema changes, slow queries, migration planning
- **Tools**: Read, Grep, Glob, Bash, Write (memory file only)
- **Triggers**: "optimize this query", "Prisma schema for", "database migration"

**rbac-specialist** (sonnet, 🟡 yellow)

- **Purpose**: Role-based access control, permission matrix, ownership flows
- **Specialties**: Owner/admin/member hierarchy, last owner protection, cross-tenant isolation
- **Use when**: Adding protected endpoints, membership logic, role transitions
- **Tools**: Read, Grep, Glob, Write (memory file only)
- **Triggers**: "RBAC for", "permission check", "role-based access"

**openapi-specialist** (haiku, 🔵 blue)

- **Purpose**: OpenAPI 3.1 spec maintenance, type generation, API documentation
- **Specialties**: Schema validation, example generation, frontend type generation
- **Use when**: Documenting endpoints, generating types, validating spec
- **Tools**: Read, Grep, Glob, Bash, WebFetch, Write (memory file only)
- **Triggers**: "update OpenAPI", "generate types", "document this endpoint"

**error-handler** (haiku, 🔴 red)

- **Purpose**: AppError patterns, user-friendly messages, error codes
- **Specialties**: Error response consistency, client-safe error handling
- **Use when**: Defining error responses, unhandled edge cases, error UX
- **Tools**: Read, Grep, Glob, Write (memory file only)
- **Triggers**: "error handling for", "what error code", "error message"

### Frontend Specialists

**form-engineer** (sonnet, 🟢 green)

- **Purpose**: Form validation, Zod schemas, multi-step flows, controlled components
- **Specialties**: Inline validation, error messages, submit states, optimistic updates
- **Use when**: Building forms, complex validation, multi-step wizards
- **Tools**: Read, Grep, Glob, Write (memory file only)
- **Triggers**: "create a form for", "form validation", "multi-step form"

**react-query-specialist** (sonnet, 🟢 green)

- **Purpose**: TanStack Query v5 patterns, cache invalidation, optimistic updates
- **Specialties**: Hierarchical query keys, mutation flows, background refetching
- **Use when**: Data fetching logic, cache issues, complex mutations
- **Tools**: Read, Grep, Glob, WebFetch, Write (memory file only)
- **Triggers**: "React Query for", "cache invalidation", "optimistic update"

**tailwind-designer** (haiku, 🟢 green)

- **Purpose**: Tailwind 4.3 CSS-first config, design systems, responsive patterns
- **Specialties**: @theme directive, design tokens, mobile-first breakpoints
- **Use when**: Styling components, design system setup, responsive layouts
- **Tools**: Read, Grep, Glob, Write (memory file only)
- **Triggers**: "Tailwind for", "responsive design", "design system"

### Testing

**test-architect** (sonnet, 🔵 blue)

- **Purpose**: Integration testing with Vitest + Supertest (API) + RTL (frontend)
- **Specialties**: Database reset patterns, auth test helpers, MSW mocking
- **Use when**: Writing test suites, improving coverage, test infrastructure
- **Tools**: Read, Grep, Glob, Bash, Write (memory file only)
- **Triggers**: "write tests for", "test this endpoint", "test coverage"

## Model Selection Rationale

- **Haiku** — Fast, cost-effective for straightforward tasks (Tailwind, OpenAPI validation, error codes)
- **Sonnet** — Balanced reasoning and speed for most development tasks (code review, API design, forms)
- **Opus** — Deep reasoning for complex security analysis (security-auditor)

## Agent Memory

Every agent in this directory has a persistent memory file at
`.claude/agents/memory/<agent-name>.md`. Agents run with isolated context — they don't see this
conversation or any prior invocation — so the memory file is their only way to carry
codebase-specific learning forward across sessions.

**Why this exists:** the written rules in `.claude/rules/` and `.claude/skills/` capture
project-wide conventions, but agents also accumulate narrower, domain-specific knowledge over
time — a naming decision the user ratified, a pattern that looks like a bug but is intentional
here, a tradeoff already litigated and settled. Without memory, every invocation rediscovers (or
re-flags) the same things from scratch.

**How it works:**

- Each agent's prompt has a `## Memory Protocol` section instructing it to `Read` its memory file
  before starting work, and to update it — narrowly — when the invocation prompt carries explicit
  user feedback on a past decision, or a genuinely recurring pattern emerges.
- Memory files use a consistent three-section structure: **Confirmed preferences**, **False
  positives / non-issues**, and **Recurring patterns / open questions**. Entries are terse, dated,
  and pruned rather than left to accumulate indefinitely.
- Every agent is granted `Write` for exactly this purpose and nothing else — `Edit` is disallowed
  fleet-wide, so no agent can touch source code, tests, or docs regardless of what it's asked to
  do.
- Memory is layered *on top of* `.claude/rules/` and `.claude/skills/`, never a substitute for
  them — durable, project-wide conventions still belong in those checked-in files, not in an
  agent's memory.

**Maintaining memory files:** they're plain markdown, safe to hand-edit if an entry becomes stale
or wrong. If an agent's memory file grows unwieldy, prune it — old entries superseded by newer
ones should be deleted, not kept for history.

## How to Use This Directory

### Adding a New Agent

1. Create `agent-name.md` with YAML frontmatter:

```markdown
---
name: agent-name
description: Brief description (shows in agent picker)
model: haiku | sonnet | opus
tools: Read, Grep, Glob, Bash, Write
disallowedTools: Edit, NotebookEdit
color: blue
---

# Purpose

What this agent specializes in and when to use it.

## Memory Protocol

You have a persistent memory file at `.claude/agents/memory/agent-name.md`. It survives across
invocations even though your conversation context does not — treat it as your only long-term
memory, layered on top of the relevant `.claude/rules/` and `.claude/skills/` files.

**Before you begin:** `Read` the memory file (it already exists — do not overwrite its structure)
and apply its contents as if they were additional project rules specific to this domain.

**When you finish:** update the memory file only if the invocation prompt contains explicit user
feedback on a past decision (confirmation or correction), or you noticed a genuinely recurring,
codebase-specific pattern not already covered by written rules. Leave the file untouched if nothing
new was learned. Keep entries terse and dated; prune stale or superseded ones rather than letting
the file grow unbounded.

## Key Responsibilities

- Specific task 1
- Specific task 2

## Constraints

- What this agent should NOT do
- Tool restrictions rationale

## Trigger Patterns

Natural language phrases that should invoke this agent:

- "design a..."
- "optimize this..."
- "review for..."
```

2. Create `.claude/agents/memory/agent-name.md` seeded with the standard template:

```markdown
# Agent Name — Memory

Durable, codebase-specific learnings not already covered by `.claude/rules/`. Updated by the
agent-name agent. Keep entries terse and dated.

## Confirmed preferences

## False positives / non-issues

## Recurring patterns / open questions
```

3. Update this README.md with the new agent
4. Reference the agent in relevant `.claude/commands/` and `.claude/skills/` files

### Disabling an Agent

Rename `agent-name.md` → `agent-name.md.disabled`

Claude Code will not load disabled agents.

### Testing Agent Behavior

You can invoke agents directly to test their behavior:

```
You: "Use the api-designer agent to help me design a REST API for blog posts"
```

## Best Practices

### DO:

- ✅ Use agents for isolated, focused tasks
- ✅ Let agents run autonomously (don't micromanage)
- ✅ Trust agent outputs (they're specialized for their domain)
- ✅ Provide clear, detailed prompts when invoking agents manually

### DON'T:

- ❌ Use agents for simple tasks the main Claude session can handle
- ❌ Chain multiple agents sequentially for a single task (use main session to coordinate)
- ❌ Edit files directly via agents when the main session should do it
- ❌ Give agents `Edit` access to source code — every agent in this directory is read-only on the
  codebase. `Write` is granted to every agent, but only to persist its own memory file (see
  [Agent Memory](#agent-memory)); it must never be used to write source, tests, or docs

## Integration with Other .claude/ Components

### Commands

Commands can explicitly invoke agents:

```markdown
# .claude/commands/security-audit.md

Run a comprehensive security audit using the security-auditor agent.

**Workflow:**

1. Launch security-auditor agent with full codebase context
2. Generate report with OWASP Top 10 2025 findings
3. Prioritize critical issues
```

### Skills

Skills provide context that agents can reference:

```markdown
# .claude/skills/security/owasp-top10.md

When the security-auditor agent runs, this skill is auto-loaded
to provide detailed OWASP Top 10 2025 guidance.
```

### Hooks

Hooks can trigger agent-based validation:

```bash
# .claude/hooks/security-check.sh

# If critical issues found, suggest:
echo "Run: /security-audit for comprehensive review"
```

### Rules

Agents inherit and enforce project rules:

```markdown
# .claude/rules/security.md

All agents MUST enforce:

- Tenant isolation via req.tenantId (never from request body)
- RBAC with requireRole() middleware
- Zod validation on all inputs
```

## See Also

- `.claude/commands/` — Repeatable workflows (some invoke agents)
- `.claude/skills/` — Auto-loaded context by domain
- `.claude/rules/` — Always-active code conventions
- `.claude/hooks/` — Event-driven automation
- `CLAUDE.md` — Main project instructions (loaded every session)

---

**Last Updated:** 2026-07-24
**Agent Count:** 13 specialized agents
**Coverage:** Security (2), Backend (4), Frontend (3), Testing (1), Code Quality (3)
