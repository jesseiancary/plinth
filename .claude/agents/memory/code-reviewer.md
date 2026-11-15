# Code Reviewer — Memory

Durable, codebase-specific learnings not already covered by `.claude/rules/security.md`,
`.claude/rules/code-style.md`, or the OWASP checklist. Updated by the code-reviewer agent. Keep
entries terse and dated.

Typical entries: false-positive security patterns specific to this codebase's helpers/middleware,
recurring correctness bugs worth watching for, review feedback the user has confirmed or corrected.

## Confirmed preferences

<!-- Decisions the user has explicitly ratified for this domain. One line each. -->
<!-- Format: - YYYY-MM-DD: <preference> — <why, if given> -->

## False positives / non-issues

<!-- Things that look like security/correctness issues but are intentional in this codebase. -->
<!-- Format: - YYYY-MM-DD: <pattern> — <why it's fine here> -->

## Recurring patterns / open questions

<!-- Patterns seen repeatedly, or decisions deferred, worth remembering. -->
<!-- Format: - YYYY-MM-DD: <pattern> — <context> -->

- 2026-11-15: `apps/api/src/lib/business-logger.ts` is the established convention for INFO-level
  business/lifecycle events (`logUserRegistration`, `logMembershipChanged`, `logApiKeyEvent`, etc.)
  — each adds its event name to the `BusinessEventType` union and logs `{ event, ...fields,
timestamp: new Date().toISOString() }`. Ad-hoc `logger.info('X happened', {...})` calls outside
  this module (e.g. a new `sendEmail` wrapper logging `'Email sent'` without an `event` field) are
  a convention drift worth flagging even though `.claude/rules` only says "use structured
  logging" generically — check new lib/ modules against `business-logger.ts`'s shape specifically.
- 2026-11-15: When a PR adds nodemailer/SMTP, check `requireTLS` is set (or at least discussed)
  wherever `SMTP_USER`/`SMTP_PASS` auth is used over a non-`secure` (non-465) port — opportunistic
  STARTTLS without `requireTLS: true` is vulnerable to STARTTLS-stripping MITM on port 587/1025.
  This project cares about A04 crypto failures explicitly, so flag it as Medium, not Advisory.
- 2026-11-15: When a PR turns on `.tsx` support for `apps/api` (tsconfig `jsx`, eslint `--ext
.ts,.tsx`), double-check `apps/api/vitest.config.ts`'s `test.include` and `coverage.exclude`
  globs — they were `**/*.test.ts`-only and not updated alongside, which would silently skip any
  future colocated `*.test.tsx` file for a React Email template/component.
