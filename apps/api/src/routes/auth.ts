import type { Request, Response } from 'express'
import { Router } from 'express'

import {
  type ChangePasswordInput,
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '@plinth/validation'

import { asyncHandler } from '../lib/async-handler.js'
import { logUserLogin, logUserLogout, logUserRegistration } from '../lib/business-logger.js'
import { AppError } from '../lib/errors.js'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js'
import { hashPassword, normalizeAuthTiming, verifyPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { rateLimitConfig } from '../lib/security.js'
import { logAuthFailure, logSecurityEvent, logSensitiveOperation } from '../lib/security-logger.js'
import { generateUniqueSlug } from '../lib/slug.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

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
        await normalizeAuthTiming(startTime)
        logSecurityEvent('REGISTRATION_FAILED', req, { email: body.email })
        throw new AppError('Unable to complete registration', 400, 'REGISTRATION_FAILED')
      }

      // Hash password
      const passwordHash = await hashPassword(body.password)

      // Generate unique slug for personal organization
      const orgSlug = await generateUniqueSlug(body.name)

      // Create user and personal organization in a transaction
      const user = await prisma.user.create({
        data: {
          email: body.email,
          password: passwordHash,
          name: body.name,
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      })

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

      res.status(201).json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
