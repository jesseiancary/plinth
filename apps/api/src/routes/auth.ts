import type { Request, Response } from 'express'
import { Router } from 'express'

import {
  type ChangePasswordInput,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  verifyEmailSchema,
} from '@plinth/validation'

import { asyncHandler } from '../lib/async-handler.js'
import { sendAccountExistsEmail, sendVerificationEmail } from '../lib/auth-emails.js'
import { logUserLogin, logUserLogout, logUserRegistration } from '../lib/business-logger.js'
import { TIME } from '../lib/constants.js'
import { generateVerificationToken, sha256 } from '../lib/crypto.js'
import { prisma } from '../lib/db.js'
import { env } from '../lib/env.js'
import { AppError } from '../lib/errors.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { hashPassword, normalizeAuthTiming, verifyPassword } from '../lib/password.js'
import {
  materializePendingRegistration,
  sweepExpiredPendingRegistrations,
} from '../lib/pending-registration.js'
import { rateLimitConfig } from '../lib/security.js'
import { logAuthFailure, logSecurityEvent, logSensitiveOperation } from '../lib/security-logger.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

/**
 * Verification tokens live for 24 hours (matches the copy in the VerifyEmail template).
 */
const VERIFICATION_TOKEN_TTL_MS = TIME.ONE_DAY_MS

/**
 * Returned when verification collapses to an already-materialized account (double-submit or a
 * concurrent verify of another pending row for the same email). Deliberately distinct from the
 * happy-path copy: the clicked link's credentials were not applied, so it must not imply the
 * just-submitted password is now active.
 */
const ALREADY_VERIFIED_MESSAGE = 'This email is already verified. You can log in.'

const isTestEnv = env.NODE_ENV === 'test'

/**
 * Dispatch a transactional auth email without letting it affect the HTTP response.
 *
 * Failures are swallowed (the email layer logs `EMAIL_SEND_FAILED` for both template-render
 * and SMTP-delivery failures) so a transient outage can't fail the request — a user who never
 * receives the link can simply register again to get a fresh one.
 *
 * In production the send is **fire-and-forget**: awaiting a slow SMTP round-trip would both
 * delay the caller and, on the enumeration-safe duplicate-registration branch, create a timing
 * oracle — `normalizeAuthTiming` only raises latency to a floor, it cannot cap it, so an awaited
 * send would make the "account exists" branch measurably slower than the no-op branches. In the
 * test environment we await instead, so the in-memory outbox is populated deterministically for
 * assertions.
 */
const dispatchAuthEmail = async (send: () => Promise<void>): Promise<void> => {
  const safeSend = async (): Promise<void> => {
    try {
      await send()
    } catch {
      // Intentionally ignored — failure already logged by the email layer.
    }
  }

  if (isTestEnv) {
    await safeSend()
    return
  }

  // Fire-and-forget: safeSend never rejects, so no unhandled rejection.
  void safeSend()
}

/**
 * Reclaim expired pending registrations without blocking the response. The sweep is pure
 * opportunistic housekeeping (the materialization path already ignores expired tokens), so it
 * has no business adding DB-write latency to the register hot path. Fire-and-forget in
 * production; awaited in tests for deterministic state.
 */
const dispatchPendingSweep = async (): Promise<void> => {
  const safeSweep = async (): Promise<void> => {
    try {
      await sweepExpiredPendingRegistrations()
    } catch {
      // Intentionally ignored — cleanup is best-effort and will be retried on the next write.
    }
  }

  if (isTestEnv) {
    await safeSweep()
    return
  }

  void safeSweep()
}

/**
 * POST /api/v1/auth/register
 * Record a pending registration and email a verification link.
 *
 * No `User` is created here: the account (plus personal organization and OWNER membership) is
 * materialized only when the emailed link is clicked (see `verify-email`). Each registration
 * records its *own* pending row (own password hash + single-use token) and never touches
 * another submission's row — so clicking a link can only ever activate the credentials that
 * link was issued for. Because registration is insert-only, a user's own verification link
 * cannot be invalidated or overwritten by a third party who re-registers the same address: the
 * owner clicking their *own* link always materializes the password *they* submitted.
 *
 * This does not make takeover categorically impossible — an attacker's link for the same
 * address also lands in the victim's inbox, so a victim who clicks a link for a registration
 * they did not initiate would materialize the attacker's password. That residual is addressed
 * by the verification email copy (it must state what clicking does), not by this handler.
 */
router.post(
  '/register',
  rateLimitConfig.authRegister,
  asyncHandler(async (req: Request, res: Response) => {
    // Record start time for timing attack prevention
    const startTime = Date.now()

    try {
      const body = registerSchema.parse(req.body)

      // Only a *verified* account is claimed and protected. If one exists we never mutate it;
      // we notify the real holder out-of-band and return the generic failure. An unverified
      // email has no `User` yet — only coexisting pending rows, which we never touch here.
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email },
      })

      if (existingUser) {
        // Enumeration-safe: the response is generic, but we notify the real account holder
        // out-of-band so they're aware of the attempt without the request confirming the
        // address exists.
        await dispatchAuthEmail(() =>
          sendAccountExistsEmail({ to: existingUser.email, name: existingUser.name }),
        )
        await normalizeAuthTiming(startTime)
        logSecurityEvent('REGISTRATION_FAILED', req, { email: body.email })
        throw new AppError('Unable to complete registration', 400, 'REGISTRATION_FAILED')
      }

      // Hash the submitted password (stored only on the pending row until materialization).
      const passwordHash = await hashPassword(body.password)

      // Prepare a single-use email verification token (only the hash is persisted).
      const verificationToken = generateVerificationToken()

      // Insert a *new* pending row for this submission without disturbing any existing rows for
      // the same email. Coexisting rows never interfere: each carries its own token + password
      // hash, and each materializes only its own credentials. This is what prevents a third
      // party who re-registers the address from invalidating or hijacking the real inbox owner's
      // in-flight verification link (their link stays valid and still materializes *their*
      // password). Opportunistically reclaim globally-expired rows at the same time.
      await prisma.pendingRegistration.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          verificationTokenHash: sha256(verificationToken),
          expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
        },
      })
      await dispatchPendingSweep()

      await dispatchAuthEmail(() =>
        sendVerificationEmail({ to: body.email, name: body.name, token: verificationToken }),
      )

      logSecurityEvent('REGISTRATION_PENDING', req, { email: body.email })

      // No `User`, tokens, or session are issued here — the account is created on verification.
      res.status(201).json({
        message: 'Account created. Check your email to verify your address before logging in.',
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      if (error instanceof Error && error.name === 'ZodError') {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
          errors: error,
        })
      }
      throw error
    }
  }),
)

/**
 * POST /api/v1/auth/login
 * Authenticate user and return tokens
 */
router.post(
  '/login',
  rateLimitConfig.authLogin,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const body = loginSchema.parse(req.body)

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email: body.email },
      })

      if (!user) {
        logAuthFailure({
          event: 'FAILED_LOGIN',
          reason: 'Invalid credentials',
          email: body.email,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
        })
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }

      // Verify password
      const isPasswordValid = await verifyPassword(body.password, user.password)

      if (!isPasswordValid) {
        logAuthFailure({
          event: 'FAILED_LOGIN',
          reason: 'Invalid password',
          email: body.email,
          userId: user.id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          endpoint: req.originalUrl,
        })
        throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      }

      // Gate login on email verification. Checked only after the password is confirmed valid
      // so verification status is never revealed to someone who doesn't know the password.
      if (!user.emailVerified) {
        logSecurityEvent('LOGIN_BLOCKED_UNVERIFIED', req, { email: user.email })
        throw new AppError(
          'Please verify your email address before logging in.',
          403,
          'EMAIL_NOT_VERIFIED',
        )
      }

      // Generate tokens
      const accessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        tokenVersion: user.tokenVersion,
      })

      const refreshToken = signRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion,
      })

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: TIME.ONE_WEEK_MS,
      })

      logUserLogin({
        userId: user.id,
        email: user.email,
        ip: req.ip,
      })

      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      if (error instanceof Error && error.name === 'ZodError') {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
          errors: error,
        })
      }
      throw error
    }
  }),
)

/**
 * POST /api/v1/auth/verify-email
 * Confirm ownership of an email address using a single-use token from the verification link,
 * and materialize the account (User + personal Organization + OWNER Membership) from the
 * pending registration the token was issued for.
 *
 * Public (no session) and CSRF-exempt — the token itself is the credential. Single-use is
 * enforced by deleting the pending row on consumption (plus the `@unique` token hash).
 */
router.post(
  '/verify-email',
  rateLimitConfig.authVerifyEmail,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const body = verifyEmailSchema.parse(req.body)

      const pending = await prisma.pendingRegistration.findUnique({
        where: { verificationTokenHash: sha256(body.token) },
      })

      // Generic error for a missing/already-consumed token (single-use: the pending row is
      // deleted on success, so a replayed token no longer matches).
      if (!pending) {
        throw new AppError(
          'Invalid or expired verification token',
          400,
          'INVALID_VERIFICATION_TOKEN',
        )
      }

      if (pending.expiresAt < new Date()) {
        // Drop the dead row so it can't linger; the token is already spent either way.
        await prisma.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {
          // Row may have been swept concurrently — nothing to clean up.
        })
        throw new AppError(
          'This verification link has expired. Please request a new one.',
          400,
          'VERIFICATION_TOKEN_EXPIRED',
        )
      }

      // Double-submit / race: the account may already have been materialized (by verification of
      // another pending row for this email, or a concurrent verify of this same token). Collapse
      // safely — consume remaining pending rows and treat as already-verified rather than
      // colliding on the unique email.
      const existingUser = await prisma.user.findUnique({
        where: { email: pending.email },
        select: { id: true },
      })
      if (existingUser) {
        await prisma.pendingRegistration.deleteMany({ where: { email: pending.email } })
        logSecurityEvent('EMAIL_VERIFIED', req, { email: pending.email })
        // Distinct from the happy path: the account already exists, so *this* link's credentials
        // were not applied. Don't imply "you can now log in [with what you just submitted]".
        res.json({ message: ALREADY_VERIFIED_MESSAGE })
        return
      }

      // Materialize the account from *this* pending row (its own password hash). The helper
      // generates the personal-org slug (retrying on collision) and consumes the pending row.
      const materialized = await materializePendingRegistration(pending)

      logSecurityEvent('EMAIL_VERIFIED', req, { email: pending.email })

      // A `null` result means a concurrent request won the race and created the `User` first:
      // this link's credentials were not applied, so respond with the already-verified message
      // (idempotent, single-use) rather than the happy-path success copy.
      if (!materialized) {
        res.json({ message: ALREADY_VERIFIED_MESSAGE })
        return
      }

      logUserRegistration({
        userId: materialized.user.id,
        email: materialized.user.email,
        organizationId: materialized.organization.id,
        organizationSlug: materialized.organization.slug,
        personalOrg: true,
      })

      res.json({ message: 'Email verified successfully. You can now log in.' })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      if (error instanceof Error && error.name === 'ZodError') {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
          errors: error,
        })
      }
      throw error
    }
  }),
)

/**
 * POST /api/v1/auth/refresh
 * Rotate refresh token and return new access token
 */
router.post(
  '/refresh',
  rateLimitConfig.authRefresh,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string }

      if (!refreshToken) {
        throw new AppError('Refresh token not found', 401, 'REFRESH_TOKEN_MISSING')
      }

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken)

      // Get user and verify token version
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      })

      if (!user || user.tokenVersion !== payload.tokenVersion) {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')
      }

      // Generate new tokens
      const newAccessToken = signAccessToken({
        userId: user.id,
        email: user.email,
        tokenVersion: user.tokenVersion,
      })

      const newRefreshToken = signRefreshToken({
        userId: user.id,
        tokenVersion: user.tokenVersion,
      })

      // Set new refresh token as httpOnly cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: TIME.ONE_WEEK_MS,
      })

      res.json({
        accessToken: newAccessToken,
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN')
      }
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED')
      }
      throw error
    }
  }),
)

/**
 * POST /api/v1/auth/logout
 * Invalidate refresh token by incrementing token version
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.cookies as { refreshToken?: string }

      if (!refreshToken) {
        // Already logged out
        res.clearCookie('refreshToken')
        res.status(204).send()
        return
      }

      // Verify and extract user ID
      const payload = verifyRefreshToken(refreshToken)

      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true },
      })

      // Increment token version to invalidate all existing refresh tokens
      await prisma.user.update({
        where: { id: payload.userId },
        data: {
          tokenVersion: {
            increment: 1,
          },
        },
      })

      if (user) {
        logUserLogout({
          userId: user.id,
          email: user.email,
        })
      }

      // Clear cookie
      res.clearCookie('refreshToken')
      res.status(204).send()
    } catch {
      // Even if token is invalid, clear the cookie
      res.clearCookie('refreshToken')
      res.status(204).send()
    }
  }),
)

/**
 * GET /api/v1/auth/me
 * Get current user and their memberships
 */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id
    if (!userId) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND')
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    })

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND')
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        organization: membership.organization,
        createdAt: membership.createdAt,
      })),
    })
  }),
)

/**
 * PATCH /api/v1/auth/password
 * Change user password and invalidate all sessions
 */
router.patch(
  '/password',
  requireAuth,
  rateLimitConfig.authPassword,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Record start time for timing attack prevention
    const startTime = Date.now()

    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND')
      }

      const body: ChangePasswordInput = changePasswordSchema.parse(req.body)

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND')
      }

      const isCurrentPasswordValid = await verifyPassword(body.currentPassword, user.password)
      if (!isCurrentPasswordValid) {
        await normalizeAuthTiming(startTime)
        throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD')
      }

      const isSamePassword = await verifyPassword(body.newPassword, user.password)
      if (isSamePassword) {
        await normalizeAuthTiming(startTime)
        throw new AppError(
          'New password must be different from current password',
          400,
          'SAME_PASSWORD',
        )
      }

      const newPasswordHash = await hashPassword(body.newPassword)

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            password: newPasswordHash,
            tokenVersion: {
              increment: 1,
            },
          },
        })
      })

      logSensitiveOperation({
        event: 'PASSWORD_CHANGED',
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      })

      // Clear refresh token cookie
      res.clearCookie('refreshToken')

      res.status(204).send()
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      if (error instanceof Error && error.name === 'ZodError') {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
          errors: error,
        })
      }
      throw error
    }
  }),
)

export { router as authRouter }
