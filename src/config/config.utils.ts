import { randomBytes } from 'crypto';
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

  const isProduction = process.env.NODE_ENV === 'production';

  // Check for missing secrets
  if (!process.env.DATABASE_PASSWORD) {
    errors.push('DATABASE_PASSWORD must be set via environment variable.');
  }

  if (isProduction) {
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
 * Generate a cryptographically secure random string for secrets
 */
export function generateSecureSecret(length: number = 32): string {
  return randomBytes(length).toString('base64url').slice(0, length);
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

/**
 * Normalize private key for ECS deployment
 * Handles common header/footer issues when storing private keys in environment variables
 * or AWS Secrets Manager where newlines and special characters can cause problems
 */
export function normalizePrivateKey(key: string): string {
  if (!key) {
    throw new Error('Private key is required');
  }

  // If it already has proper PEM headers, return as-is
  if (key.includes('-----BEGIN') && key.includes('-----END')) {
    return key;
  }

  // Check if it's base64 encoded by trying to decode and checking if result is valid
  let decodedKey: string;
  try {
    const isBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(key) && key.length % 4 === 0 && key.length > 0;
    if (isBase64) {
      const decoded = Buffer.from(key, 'base64').toString('utf-8');
      if (
        decoded.includes('PRIVATE KEY') ||
        decoded.includes('EC PRIVATE KEY') ||
        decoded.includes('RSA PRIVATE KEY')
      ) {
        decodedKey = decoded;
      } else {
        decodedKey = key;
      }
    } else {
      decodedKey = key;
    }
  } catch {
    decodedKey = key;
  }

  // Check if decoded content already has headers
  if (decodedKey.includes('-----BEGIN') && decodedKey.includes('-----END')) {
    return decodedKey;
  }

  // Wrap raw key content with proper PEM headers
  // For ECDSA keys (ES256, ES384, ES512), prefer PKCS8 format
  // For RSA keys, use RSA PRIVATE KEY format
  let keyType: string;

  // Check if it's already in PKCS8 format (most common for ECDSA)
  if (decodedKey.includes('PRIVATE KEY')) {
    keyType = 'PRIVATE KEY'; // PKCS8 format (works for both ECDSA and RSA)
  } else if (decodedKey.includes('EC PRIVATE KEY') || decodedKey.includes('ECDSA')) {
    keyType = 'EC PRIVATE KEY'; // Traditional ECDSA format
  } else {
    // For raw key content without headers, default to PKCS8 format
    // This is safer for ECDSA keys and works with most JWT libraries
    keyType = 'PRIVATE KEY';
  }

  return `-----BEGIN ${keyType}-----\n${decodedKey}\n-----END ${keyType}-----`;
}
