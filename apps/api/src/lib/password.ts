import bcrypt from 'bcrypt'

import { env } from './env.js'

const SALT_ROUNDS = parseInt(env.BCRYPT_WORK_FACTOR || '10', 10)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
