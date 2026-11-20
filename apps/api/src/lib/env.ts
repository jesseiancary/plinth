import { z } from 'zod'

// Dev/Mailpit placeholder "From" address. Reused as the SMTP_FROM default and as the
// value production is required to override (see the superRefine below).
const DEV_SMTP_FROM = 'Plinth <noreply@plinth.local>'

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().default('3000'),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRY: z.string().default('15m'),
    JWT_REFRESH_EXPIRY: z.string().default('7d'),
    API_URL: z.string().url(),
    // Frontend base URL used to build links inside transactional emails (e.g. verify/reset).
    // Defaults to the local Caddy dev URL; production MUST override (enforced below).
    WEB_URL: z.string().url().default('https://localhost'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().regex(/^\d+$/, 'SMTP_PORT must be a positive integer').optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // "From" address for outbound email. Defaults to a local placeholder for dev/Mailpit;
    // production MUST override with a verified sender (enforced below).
    SMTP_FROM: z.string().default(DEV_SMTP_FROM),
    BCRYPT_WORK_FACTOR: z.string().default('10'),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug', 'silent']).optional(),
    HEALTH_CHECK_TOKEN: z.string().min(16).optional(),
  })
  .superRefine((value, ctx) => {
    // SMTP credentials must be set together — a half-set pair otherwise silently
    // disables both authentication and STARTTLS enforcement. Mailpit (both empty)
    // and fully-configured providers both pass.
    if (Boolean(value.SMTP_USER) !== Boolean(value.SMTP_PASS)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_USER'],
        message: 'SMTP_USER and SMTP_PASS must be set together',
      })
    }

    // Fail fast on a dev-placeholder email config reaching production, where it would
    // send unverified-sender mail with links pointing at localhost.
    if (value.NODE_ENV === 'production') {
      if (!value.SMTP_HOST) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required in production',
        })
      }
      if (value.SMTP_FROM === DEV_SMTP_FROM) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_FROM'],
          message: 'SMTP_FROM must be set to a real sender in production',
        })
      }
      if (new URL(value.WEB_URL).hostname === 'localhost') {
        ctx.addIssue({
          code: 'custom',
          path: ['WEB_URL'],
          message: 'WEB_URL must not point at localhost in production',
        })
      }
    }
  })

export const env = envSchema.parse(process.env)

export type Env = z.infer<typeof envSchema>

/**
 * True when running under the test runner. Single source of truth for the many places that gate
 * behavior on the test environment (in-memory email outbox, synchronous email/sweep dispatch,
 * logger transports, rate-limit relaxation).
 */
export const isTestEnv = env.NODE_ENV === 'test'

/**
 * Determines whether CSRF protection should be skipped
 * Returns true in test environment to simplify integration tests
 * Exported as function to allow mocking in CSRF-specific tests
 */
export const shouldSkipCsrf = () => isTestEnv
