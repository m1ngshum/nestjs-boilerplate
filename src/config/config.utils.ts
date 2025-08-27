import { ConfigValidationResult, REQUIRED_ENV_VARS } from './config.types';

/**
 * Validate that all required environment variables are present
 */
export function validateRequiredEnvVars(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const envVar of REQUIRED_ENV_VARS) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // Check for common issues
  if (process.env.JWT_SECRET === 'your-super-secret-jwt-key') {
    warnings.push('JWT_SECRET is using the default value. Please change it for production.');
  }

  if (process.env.DATABASE_PASSWORD === 'password') {
    warnings.push('DATABASE_PASSWORD is using the default value. Please change it for production.');
  }

  if (process.env.NODE_ENV === 'production') {
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
 * Parse boolean environment variable
 */
export function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Parse integer environment variable
 */
export function parseInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse float environment variable
 */
export function parseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse array environment variable (comma-separated)
 */
export function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (value === undefined) return defaultValue;
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return defaultValue;
  }
  return value;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get database URL with fallback construction
 */
export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Construct from individual components
  const type = process.env.DATABASE_TYPE || 'postgres';
  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '5432';
  const username = process.env.DATABASE_USERNAME || 'postgres';
  const password = process.env.DATABASE_PASSWORD || 'password';
  const database = process.env.DATABASE_NAME || 'nestjs_boilerplate';

  return `${type}://${username}:${password}@${host}:${port}/${database}`;
}

/**
 * Mask sensitive configuration values for logging
 */
export function maskSensitiveConfig(config: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ['password', 'secret', 'key', 'token', 'dsn', 'clientSecret'];

  const masked = { ...config };

  function maskObject(obj: any, path: string = ''): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => maskObject(item, `${path}[${index}]`));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const lowerKey = key.toLowerCase();

      if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
        result[key] = typeof value === 'string' && value.length > 0 ? '***MASKED***' : value;
      } else {
        result[key] = maskObject(value, currentPath);
      }
    }

    return result;
  }

  return maskObject(masked);
}

/**
 * Generate a secure random string for secrets
 */
export function generateSecureSecret(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate port number
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}
