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

- 2026-11-10: Running `pnpm --filter api test` (or `make test-api`) directly against the
  long-running `docker compose` **dev** container fails many unrelated tests with
  `CSRF_TOKEN_MISSING` (403) because that container's `NODE_ENV=development`, not `test`, so
  `shouldSkipCsrf()` doesn't skip. This reproduces on unmodified routes too — it's a dev-container
  env artifact, not a regression from whatever diff is under review. Use `make test-docker-api`
  (isolated compose file, correct `NODE_ENV=test`) for a trustworthy run, or disregard
  CSRF_TOKEN_MISSING failures seen via the dev container.

## Recurring patterns / open questions

<!-- Patterns seen repeatedly, or decisions deferred, worth remembering. -->
<!-- Format: - YYYY-MM-DD: <pattern> — <context> -->

- 2026-11-10: Dual-auth idiom established in `apps/api/src/middleware/auth.ts`:
  `authenticateApiKeyOptional` (non-throwing populator of `req.apiKey`, mirrors `authenticateJWT`)
  — `requireRoleOrScope(allowedRoles, scope)` (API-key branch does org-slug lookup → 404 if
  missing/cross-org before any scope check, else falls back to shared `resolveMembershipRole`
  used by plain `requireRole`). Routes that must stay JWT-only simply keep using `requireRole`
  even when `authenticateApiKeyOptional` is mounted via `router.use` — this is safe because
  `requireRole`/`resolveMembershipRole` only ever inspect `req.user`, never `req.apiKey`. Treat
  this as the canonical pattern, not a one-off to re-flag.
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
- 2026-11-15: `normalizeAuthTiming(startTime)` is a floor-only delay (tops elapsed time up to
  ~200ms); it guarantees a _minimum_ response time, never a ceiling. An "enumeration-safe"
  endpoint is therefore only constant-time if its slow branch does no _awaited_ work that can
  itself exceed the floor (e.g. `await`ing a real SMTP send). The fix pattern adopted here is to
  dispatch the send fire-and-forget: `dispatchAuthEmail` → `void safeSend()` in non-test env
  (apps/api/src/routes/auth.ts), so the real-send branch no longer blocks the response.
  `POST /auth/resend-verification` and the duplicate-registration branch already follow this, so
  do NOT re-flag them. When PR3's `forgot-password` lands (see `docs/PHASE_8_PLAN.md`), confirm it
  reuses `dispatchAuthEmail` and awaits no email send before `normalizeAuthTiming` — an
  `await sendEmail(...)` ahead of the timing normalizer would be a High (A07) timing oracle.
- 2026-11-15: When a PR adds a new public (CSRF-exempt) auth endpoint and appends its path to the
  exemption list in `apps/api/src/middleware/csrf.ts`, check `apps/api/src/middleware/csrf.test.ts`
  for a matching `it('should allow <endpoint> without CSRF token ...')` test — that file has an
  established per-endpoint-exemption test pattern (including trailing-slash variants) that is easy
  to forget to extend for newly-added exempt paths. (`/auth/verify-email` and
  `/auth/resend-verification` did get matching exemption tests in `csrf.test.ts` — keep that up
  for future exempt paths such as PR3's `forgot-password`/`reset-password`.)
