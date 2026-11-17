import type { Request, Response } from 'express'
import { Router } from 'express'

import {
  type ChangePasswordInput,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
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
import { rateLimitConfig } from '../lib/security.js'
import { logAuthFailure, logSecurityEvent, logSensitiveOperation } from '../lib/security-logger.js'
import { generateUniqueSlug } from '../lib/slug.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

/**
 * Verification tokens live for 24 hours (matches the copy in the VerifyEmail template).
 */
const VERIFICATION_TOKEN_TTL_MS = TIME.ONE_DAY_MS

const isTestEnv = env.NODE_ENV === 'test'

/**
 * Dispatch a transactional auth email without letting it affect the HTTP response.
 *
 * Failures are swallowed (the email layer logs `EMAIL_SEND_FAILED` for both template-render
 * and SMTP-delivery failures) so a transient outage can't fail the request — verification can
 * always be re-triggered via `POST /auth/resend-verification`.
 *
 * In production the send is **fire-and-forget**: awaiting a slow SMTP round-trip would both
 * delay the caller and, on the enumeration-safe endpoints (`resend-verification` and the
 * duplicate-registration branch), create a timing oracle — `normalizeAuthTiming` only raises
 * latency to a floor, it cannot cap it, so an awaited send would make the "account exists and
 * is unverified" branch measurably slower than the no-op branches. In the test environment we
 * await instead, so the in-memory outbox is populated deterministically for assertions.
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
 * POST /api/v1/auth/register
 * Create a new user and personal organization
 */
router.post(
  '/register',
  rateLimitConfig.authRegister,
  asyncHandler(async (req: Request, res: Response) => {
    // Record start time for timing attack prevention
    const startTime = Date.now()

    try {
      const body = registerSchema.parse(req.body)

      // Check if user already exists
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

      // Hash password
      const passwordHash = await hashPassword(body.password)

      // Generate unique slug for personal organization
      const orgSlug = await generateUniqueSlug(body.name)

      // Prepare a single-use email verification token (only the hash is persisted)
      const verificationToken = generateVerificationToken()

      // Create user (unverified) and personal organization in a transaction
      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: passwordHash,
          name: body.name,
          verificationTokenHash: sha256(verificationToken),
          verificationExpiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
          memberships: {
            create: {
              role: 'OWNER',
              organization: {
                create: {
                  name: `${body.name}'s Organization`,
                  slug: orgSlug,
                },
              },
            },
          },
        },
        include: {
          memberships: {
            include: {
              organization: true,
            },
          },
        },
      })

      await dispatchAuthEmail(() =>
        sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken }),
      )

      const personalOrg = user.memberships[0]?.organization
      if (personalOrg) {
        logUserRegistration({
          userId: user.id,
          email: user.email,
          organizationId: personalOrg.id,
          organizationSlug: personalOrg.slug,
          personalOrg: true,
        })
      }

      // No tokens/session are issued here — login is gated on email verification.
      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
        },
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
 * Confirm ownership of an email address using a single-use token from the verification link.
 * Public (no session) and CSRF-exempt — the token itself is the credential.
 */
router.post(
  '/verify-email',
  rateLimitConfig.authVerifyEmail,
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const body = verifyEmailSchema.parse(req.body)

      const user = await prisma.user.findUnique({
        where: { verificationTokenHash: sha256(body.token) },
      })

      // Generic error for a missing/already-consumed token (single-use: fields are cleared
      // on success, so a replayed token no longer matches).
      if (!user) {
        throw new AppError(
          'Invalid or expired verification token',
          400,
          'INVALID_VERIFICATION_TOKEN',
        )
      }

      if (!user.verificationExpiresAt || user.verificationExpiresAt < new Date()) {
        throw new AppError(
          'This verification link has expired. Please request a new one.',
          400,
          'VERIFICATION_TOKEN_EXPIRED',
        )
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          verificationTokenHash: null,
          verificationExpiresAt: null,
        },
      })

      logSecurityEvent('EMAIL_VERIFIED', req, { email: user.email })

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
 * POST /api/v1/auth/resend-verification
 * Re-send the verification email. Always returns a generic 200 (with normalized timing)
 * regardless of whether the email exists or is already verified — enumeration-safe.
 * Public (no session) and CSRF-exempt.
 */
router.post(
  '/resend-verification',
  rateLimitConfig.authResendVerification,
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now()

    try {
      const body = resendVerificationSchema.parse(req.body)

      const user = await prisma.user.findUnique({ where: { email: body.email } })

      // Only do real work for an existing, still-unverified account. For unknown or
      // already-verified addresses we silently fall through to the same generic response.
      if (user && !user.emailVerified) {
        const verificationToken = generateVerificationToken()
        await prisma.user.update({
          where: { id: user.id },
          data: {
            verificationTokenHash: sha256(verificationToken),
            verificationExpiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
          },
        })
        await dispatchAuthEmail(() =>
          sendVerificationEmail({ to: user.email, name: user.name, token: verificationToken }),
        )
        logSecurityEvent('VERIFICATION_RESENT', req, { email: user.email })
      }

      await normalizeAuthTiming(startTime)

      res.json({
        message: 'If an account exists and is unverified, a verification email has been sent.',
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
