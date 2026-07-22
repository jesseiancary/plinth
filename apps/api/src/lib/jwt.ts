import { createRequire } from 'node:module'

import type * as JWT from 'jsonwebtoken'

import { env } from './env.js'

const require = createRequire(import.meta.url)
const jwt = require('jsonwebtoken') as typeof JWT

export interface AccessTokenPayload {
  userId: string
  email: string
  tokenVersion: number
}

export interface RefreshTokenPayload {
  userId: string
  tokenVersion: number
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as JWT.SignOptions)
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as JWT.SignOptions)
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
}
