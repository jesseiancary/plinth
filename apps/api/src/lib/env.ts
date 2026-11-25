import { z } from 'zod'

// Dev/Mailpit placeholder "From" address. Reused as the EMAIL_FROM default and as the
// value production is required to override (see the superRefine below).
const DEV_EMAIL_FROM = 'Plinth <noreply@plinth.local>'

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
    // Outbound email transport. Dev/test use SMTP (Mailpit); production uses the SES HTTPS
    // API — Railway's Hobby plan blocks outbound SMTP.
    EMAIL_TRANSPORT: z.enum(['smtp', 'ses']).default('smtp'),
    // SMTP transport settings (used when EMAIL_TRANSPORT=smtp, e.g. local Mailpit).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().regex(/^\d+$/, 'SMTP_PORT must be a positive integer').optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    // SES HTTPS API settings (required when EMAIL_TRANSPORT=ses).
    AWS_REGION: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    // "From" address for outbound email. Defaults to a local placeholder for dev/Mailpit;
    // production MUST override with a verified sender (enforced below).
    EMAIL_FROM: z.string().default(DEV_EMAIL_FROM),
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

    // The SES HTTPS API needs its region + credentials; require all three together so a
    // half-configured transport fails fast rather than at the first send attempt.
    if (value.EMAIL_TRANSPORT === 'ses') {
      const sesKeys = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const
      sesKeys.forEach((key) => {
        if (!value[key]) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} is required when EMAIL_TRANSPORT=ses`,
          })
        }
      })
    }

    // Fail fast on a dev-placeholder email config reaching production, where it would
    // send unverified-sender mail with links pointing at localhost.
    if (value.NODE_ENV === 'production') {
      // Require an explicit transport in production. The schema default ('smtp') is the path
      // Railway's Hobby plan blocks, so silently defaulting would defer the failure to the
      // first send; force an explicit smtp/ses choice. (Checks the raw env because the Zod
      // default has already filled `value.EMAIL_TRANSPORT` by the time this runs.)
      if (process.env['EMAIL_TRANSPORT'] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_TRANSPORT'],
          message: 'EMAIL_TRANSPORT must be set explicitly in production (smtp or ses)',
        })
      }
      if (value.EMAIL_TRANSPORT === 'smtp' && !value.SMTP_HOST) {
        ctx.addIssue({
          code: 'custom',
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required in production when EMAIL_TRANSPORT=smtp',
        })
      }
      if (value.EMAIL_FROM === DEV_EMAIL_FROM) {
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_FROM'],
          message: 'EMAIL_FROM must be set to a real sender in production',
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
