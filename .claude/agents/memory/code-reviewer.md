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
- 2026-11-17: `apps/api/src/lib/invitation-emails.ts` interpolates the fully user-controlled
  `organization.name` directly into an email `Subject` header with no app-level sanitization.
  Looks like header-injection (CRLF in org name -> extra headers / Bcc), but confirmed non-
  exploitable by reading `nodemailer@10.5.0`'s `mime-node/index.js`: `buildHeaders()` always
  routes header values through `encodeHeaderValue` + `mimeFuncs.foldLines`, which strips/encodes
  raw CR/LF before the header hits the wire. Don't flag bare "unsanitized string in email
  Subject" as injection in this codebase unless the transport bypasses nodemailer's MimeNode
  (e.g. a raw SMTP write) — it doesn't here.

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
  (apps/api/src/routes/auth.ts), so the real-send branch no longer blocks the response. Confirmed
  in PR3 (`forgot-password`, 2026-11-17): it correctly reuses `dispatchAuthEmail` and awaits it
  before `normalizeAuthTiming`, so this is resolved — note is kept only as the canonical example
  if another enumeration-safe + email-send endpoint is added.
- 2026-11-15: When a PR adds a new public (CSRF-exempt) auth endpoint and appends its path to the
  exemption list in `apps/api/src/middleware/csrf.ts`, check `apps/api/src/middleware/csrf.test.ts`
  for a matching `it('should allow <endpoint> without CSRF token ...')` test — that file has an
  established per-endpoint-exemption test pattern (including trailing-slash variants) that is easy
  to forget to extend for newly-added exempt paths. `/auth/verify-email` has one; `/auth/resend-
verification` was later removed entirely (don't expect it). **Confirmed miss in PR3** (2026-11-17):
  `forgot-password`/`reset-password` were added to the exemption list in `csrf.ts` but no matching
  tests were added to `csrf.test.ts` — the exemption works (verified by reading the normalizedPath
  check), but is untested. Keep flagging this gap every time a new exempt path is added until the
  team closes it.
- 2026-11-17: Single-use token consumption (`verify-email`'s pending-registration materialization,
  `apps/api/src/lib/pending-registration.ts`) is made race-safe via a `$transaction` that relies on
  a DB-level unique constraint (`users.email`) and catches the violation to collapse to the
  already-consumed outcome. `reset-password` (PR3, `apps/api/src/routes/auth.ts`) does NOT follow
  this: it's a plain `findFirst` → check → `update` with no atomicity, so two concurrent requests
  bearing the same valid token can both pass validation and both write (last write wins), breaking
  the single-use guarantee under a race. Flag this pattern (plain read-check-write on a
  single-use/token-consumption field) as Medium whenever it reappears — the fix is `updateMany`
  scoped to `{ id, <tokenHashField> }` and checking `count === 1`/`0`, mirroring the atomicity the
  codebase already uses elsewhere for the same problem class.
- 2026-11-17: Every other persisted single-use secret-hash column in `schema.prisma`
  (`PendingRegistration.verificationTokenHash`, `Invitation.tokenHash`, `ApiKey.keyHash`) is
  `@unique`. PR3's `User.passwordResetTokenHash` is only `@@index`-ed, not `@unique`, despite its
  own comment claiming to be "consistent with Invitation.tokenHash." Nullable columns allow
  multiple `NULL`s under a unique constraint in Postgres, so there's no cost to adding it. Flag as
  Low/Medium (defense-in-depth + consistency) whenever a new hashed-token column skips `@unique`.
- 2026-11-17: `dispatchAuthEmail` (private to `routes/auth.ts`) was extracted verbatim to
  `apps/api/src/lib/dispatch-email.ts` (`dispatchEmail`) in the invitations-email PR, and
  `auth-emails.ts`'s private `buildUrl` was likewise extracted to `lib/email-links.ts`. Both
  extractions preserve prior behavior byte-for-byte (confirmed by diff) and `org-invitations.ts`
  now reuses the same `dispatchEmail`/`buildUrl` for `sendInvitationEmail`. Treat these as the
  canonical shared helpers going forward — a new route adding its own copy of either is drift to
  flag, not a fresh implementation to review from scratch.
- 2026-11-17: `org-invitations.ts`'s invitation-create handler inserts two non-transactional
  steps — a `prisma.user.findUnique` (inviter display name) and the email dispatch — _between_
  `prisma.invitation.create()` and the `res.json()` response. If the inviter lookup throws, the
  client gets a 500 with no token, but the `PENDING` invitation already persisted, which then
  blocks retries for 72h via the existing `INVITATION_ALREADY_EXISTS` check. Watch for this
  general shape — extra reads/side-effects inserted after a resource `.create()` but before its
  response, with no transaction/rollback — whenever a PR adds post-create enrichment (e.g. for
  notification emails) to an existing create endpoint. Low/Moderate: fix is reordering the
  enrichment read before the create, or wrapping both in a transaction.
- 2026-11-20 (PR5, `feat/verification-reset-pages`): `apps/web/src/features/organizations/pages/AcceptInvitePage.tsx`
  has had a private `Shell({title, subtitle, children})` component (centered public-auth card,
  comment: "mirrors the public auth pages") since the invite-accept flow landed. PR5 added
  `apps/web/src/features/auth/components/AuthShell.tsx` with byte-for-byte identical markup instead
  of extracting/reusing `AcceptInvitePage`'s `Shell` — now two copies exist that will silently drift
  if either is redesigned. Flag future PRs that touch either file without consolidating onto one
  shared component (`AuthShell` is the better home since it's already imported by 3 pages).
- 2026-11-20 (PR5): frontend `RateLimitError` branches (the `error instanceof RateLimitError ? <RateLimitMessage/> : ...`
  pattern used in `LoginPage`, `AcceptInvitePage`, and now `VerifyEmailPage`/`ForgotPasswordPage`/
  `ResetPasswordPage`) have never had a single test covering the 429 path anywhere in `apps/web` —
  confirmed `LoginPage` has no test file at all and `AcceptInvitePage.test.tsx` doesn't exercise it
  either. This is a systemic, pre-existing coverage gap rather than something introduced by any one
  PR; keep noting it (Advisory, not a regression) until a PR actually closes it, but don't block on
  it alone.
- 2026-11-20 (PR5): `VerifyEmailPage.tsx` distinguishes its two 200-OK outcomes (fresh verify vs.
  already-verified double-submit) by substring-matching the human-readable `message` string from
  `apps/api/src/routes/auth.ts` (`ALREADY_VERIFIED_MESSAGE`) rather than a machine-readable field —
  fragile coupling (copy changes silently mis-title the card; impact is cosmetic only since the real
  message text still renders correctly). Worth suggesting a structured discriminator if that backend
  response shape is ever revisited, but not a blocking issue on its own.
- 2026-11-20 (PR5): codebase has an established a11y convention — `role="alert"` on error banners
  and `role="status"` on success banners — used in `AcceptInvitePage`, `SettingsPage`, `MembersPage`,
  and the invite/transfer-ownership modals. `LoginPage`'s original inline error `<div>` never adopted
  it, and PR5's new `VerifyEmailPage`/`ForgotPasswordPage`/`ResetPasswordPage`/updated `RegisterPage`
  copied the unmarked `LoginPage` pattern instead of the more accessible one. Flag new public-facing
  pages that add error/success divs without `role="alert"`/`role="status"`, pointing at the modals or
  `AcceptInvitePage`/`SettingsPage` as the canonical example to follow.
