/**
 * Boot-time environment validation.
 *
 * Runs inside ConfigModule.forRoot({ validate }). In production we fail fast and
 * loud when a critical secret is missing — far better than booting with an
 * `undefined` JWT secret and silently signing unverifiable tokens. In
 * development we only warn, so local setup stays frictionless.
 */

/** Vars without which the API cannot function correctly in production. */
const REQUIRED_IN_PRODUCTION = ['DATABASE_URL', 'JWT_SECRET'] as const;

/**
 * Optional vars — recognised but never required. Listed here so the full set of
 * env vars the API reads stays documented in one place.
 *   - SENTRY_DSN: error reporting endpoint; unset = reporting disabled (safe no-op).
 */
const OPTIONAL = ['SENTRY_DSN'] as const;
void OPTIONAL;

/** Default secrets that must never survive into a production deploy. */
const FORBIDDEN_PROD_DEFAULTS: Record<string, string> = {
  JWT_SECRET: 'change_me_in_production_use_long_random_string',
};

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProd = config.NODE_ENV === 'production';
  const problems: string[] = [];

  if (isProd) {
    for (const key of REQUIRED_IN_PRODUCTION) {
      if (!config[key]) problems.push(`Missing required env var: ${key}`);
    }
    for (const [key, badValue] of Object.entries(FORBIDDEN_PROD_DEFAULTS)) {
      if (config[key] === badValue) {
        problems.push(`${key} still holds its development placeholder — set a real value`);
      }
    }
    // OTP bypass is a demo convenience; it must never ship enabled to production.
    if (config.OTP_BYPASS_MODE === 'true') {
      problems.push('OTP_BYPASS_MODE=true is not allowed in production — disable it');
    }
  }

  if (problems.length) {
    throw new Error(
      `Environment validation failed:\n  - ${problems.join('\n  - ')}\n` +
        `See backend/api/.env.example for the full list.`,
    );
  }

  return config;
}
