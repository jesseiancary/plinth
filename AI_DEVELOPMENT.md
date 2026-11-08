# AI-Assisted Development

> How this project was built with Claude Code — and why it reads like a codebase with a team behind
> it, not a weekend of prompting.

This is a portfolio project with two deliverables. The obvious one is the product: a production-grade
multi-tenant SaaS starter — tenant isolation, RBAC, invitation flows, API key management, and a
fully documented public REST API. The second, less obvious one is _this document's subject_: a
disciplined, repeatable workflow for building software with an AI pair, with real guardrails instead
of good intentions.

The distinction this project cares about is **thoughtful AI-assisted development versus "vibe
coding."** Vibe coding is prompting until the screen looks right and shipping whatever comes out.
That is not what happened here. Every change passed through the same rules, the same review
commands, and the same automated gates — the kind of process a careful engineer would set up for a
team, encoded so an AI follows it on every single turn.

---

## The Core Idea: Guardrails, Not Vibes

An LLM is fast and tireless but has no memory of yesterday's decisions and no instinct for _this_
codebase's conventions. Left unguided it will cheerfully invent a second error-response shape,
trust a client-supplied `organizationId`, or add a `let` where a `const` belongs — each one locally
reasonable, collectively a mess.

The fix is to make the conventions **part of the environment**, not something you re-explain every
session. The [`.claude/`](.claude/) directory does exactly that. It encodes the project's standards
as always-active rules, scaffolds repetitive work as slash commands, loads domain expertise on
demand as skills, delegates specialized judgment to subagents, and enforces the non-negotiables with
hooks that run automatically. The result: the AI starts every task already knowing how this project
expects things to be done.

---

## The `.claude/` System

Five mechanisms, each doing a different job. Together they turn "an assistant that writes code" into
"an assistant that writes _this project's_ code."

### 1. Rules — always-active standards (6)

Rules load at the start of every session and are enforced on every change. They are the project's
constitution:

- **`code-style.md`** — TypeScript strict mode, `const`-first, named exports, no `any`, Zod-inferred
  types.
- **`api-conventions.md`** — REST URL structure, status-code semantics, the single error-response
  shape, cursor pagination, the 404-vs-403 decision matrix.
- **`security.md`** — OWASP Top 10 2025 controls with _graduated enforcement_ (critical categories
  block, moderate ones warn, advisory ones guide).
- **`frontend.md`** — React patterns: feature-based structure, TanStack Query for all server state,
  controlled forms, accessibility.
- **`testing.md`** — integration-first, colocated tests, database-reset patterns, coverage
  thresholds.
- **`git.md`** — conventional commits, branch naming, PR discipline.

Because these are always in context, the AI doesn't need to be reminded that tenant IDs come from
`req.tenantId` and never from the request body. It already knows — every time.

### 2. Commands — scaffolded workflows (15)

Slash commands turn multi-step chores into one invocation, so the boring parts are done the same way
every time:

| Command                       | What it does                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| `/add-endpoint`               | Scaffolds a route: handler + Zod schema + OpenAPI entry + test stub |
| `/add-rbac-endpoint`          | Same, pre-wired with `authenticate` + `requireRole()` guards        |
| `/add-migration`              | Guided Prisma schema change + migration naming + seed update        |
| `/add-component`, `/add-page` | React component / routed page with props, tests, a11y               |
| `/review`, `/review-dx`       | Pre-PR checklists: correctness, security, OpenAPI sync, DX          |
| `/security-audit`             | Deep OWASP Top 10 pass with threat modeling                         |
| `/sync-openapi`               | Verify spec accuracy and regenerate types                           |
| `/test-endpoint`, `/tdd`      | Integration-test scaffolding and red-green-refactor flow            |
| `/fix-issue`                  | Structured bug work: reproduce → isolate → fix → test               |
| `/clarify`, `/grill`, `/pr`   | Requirement clarification, assumption-stress-testing, PR authoring  |

### 3. Skills — domain context on demand (7)

Skills are deep-knowledge files auto-loaded when a task touches their domain, so expertise shows up
exactly when it's relevant and stays out of the way otherwise: **openapi**, **prisma**, **rbac**,
**react**, **security** (including a full `owasp-top10.md` reference), **tailwind**, and **tdd**.
Working on a migration pulls in the Prisma skill; guarding a route pulls in the RBAC skill.

### 4. Agents — specialized reviewers with isolated context (13)

Subagents handle work that benefits from a fresh, focused context and a single area of expertise.
The roster grew well past the original three as the project's needs sharpened:

- **Security & correctness:** `code-reviewer`, `security-auditor`, `rbac-specialist`
- **Backend design:** `api-designer`, `db-architect`, `openapi-specialist`, `error-handler`,
  `test-architect`
- **Frontend:** `ui-reviewer`, `react-query-specialist`, `form-engineer`, `tailwind-designer`
- **Cross-cutting:** `quality-and-style-reviewer`

Each agent keeps a persistent memory file under [`.claude/agents/memory/`](.claude/agents/memory/),
so recurring preferences and patterns carry across sessions instead of being rediscovered each time.

### 5. Hooks — automated, non-negotiable gates (5)

Hooks are shell scripts the harness runs on events — the AI cannot talk its way past them:

- **`validate-types.sh`** — `tsc --noEmit` before TypeScript edits land.
- **`lint-staged.sh`** — ESLint + Prettier on staged files pre-commit.
- **`validate-openapi.sh`** — keeps the OpenAPI spec valid and types regenerated.
- **`security-check.sh`** — OWASP Top 10 validation that _blocks_ critical findings and warns on
  moderate ones.
- **`post-tool-use-test.sh`** — runs tests after edits for a fast feedback loop.

This is the defense-in-depth principle applied to the workflow itself: rules set expectations, and
hooks make the critical ones mechanically enforced.

---

## What This Looks Like in Practice

**Adding an endpoint.** `/add-endpoint` scaffolds the route, Zod schema, OpenAPI entry, and test
stub in one shot. The RBAC and security skills load automatically; the always-active rules ensure
`req.tenantId` isolation and the standard error shape. `/review` then runs the pre-PR checklist, and
`/security-audit` can go deeper on anything sensitive. `validate-types.sh` and `security-check.sh`
gate the result before it can be committed.

**Changing the schema.** `/add-migration` walks the Prisma change, names the migration conventionally,
and updates the seed — with the Prisma skill and `db-architect` agent on hand for indexing and
tenant-isolation decisions.

**Fixing a bug.** `/fix-issue` enforces a reproduce → isolate → fix → test sequence, so a regression
test exists before the fix is considered done.

Every one of these ends the same way: conventional commit, feature branch, pull request, CI green.
No direct commits to `main`, ever.

---

## Why It Matters

The payoff is **consistency at AI speed.** Twenty-two API endpoints share one error shape, one
pagination style, and one tenant-isolation pattern because those were encoded once and enforced
everywhere. Security isn't a final audit bolted on at the end — it rides along on every change via
always-active rules and blocking hooks. The codebase looks like it had a staff engineer reviewing
every PR, because, in effect, it did.

It's also honest about its own growth: the original plan called for 3 agents, 4 commands, and 3
skills. The system in this repo today runs **13 agents, 15 commands, 7 skills, 6 rules, and 5
hooks** — each one added when a real, recurring need appeared, not for show.

That's the thesis of this project in one line: **AI makes a disciplined developer faster; it does
not make discipline optional.** The `.claude/` directory is where that discipline lives.

For the full inventory and directory layout, see [`.claude/README.md`](.claude/README.md). For
project conventions and architecture, see [`CLAUDE.md`](CLAUDE.md).
