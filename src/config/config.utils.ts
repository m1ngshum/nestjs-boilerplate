import { ConfigValidationResult, REQUIRED_ENV_VARS } from './config.types';

/**
 * Validate that all required environment variables are present
 */
export function validateRequiredEnvVars(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.DATABASE_PASSWORD === 'password') {
      warnings.push(
        'DATABASE_PASSWORD is using the default value. Please change it for production.',
      );
    }

    if (process.env.DATABASE_SYNCHRONIZE === 'true') {
      warnings.push('DATABASE_SYNCHRONIZE should be false in production.');
    }

    if (!process.env.SENTRY_DSN) {
      warnings.push('SENTRY_DSN is not set. Consider adding error tracking for production.');
    }

    if (process.env.SWAGGER_ENABLED !== 'false') {
      warnings.push('SWAGGER_ENABLED should be false in production for security.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Mask sensitive configuration values for logging
 */
export function maskSensitiveConfig(config: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'secret', 'key', 'token', 'dsn', 'clientSecret'];

  function maskObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => maskObject(item));
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
        result[key] = typeof value === 'string' && value.length > 0 ? '***MASKED***' : value;
      } else {
        result[key] = maskObject(value);
      }
    }

    return result;
  }

  return maskObject({ ...config });
}
