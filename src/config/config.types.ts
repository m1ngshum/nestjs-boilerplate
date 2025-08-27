/**
 * Configuration type definitions and utilities
 */

export type Environment = 'development' | 'production' | 'test';

export type DatabaseType = 'postgres';

export type CacheType = 'redis' | 'memory';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export type LogFormat = 'json' | 'simple';

/**
 * Feature flags for optional functionality
 */
export interface FeatureFlags {
  sentry: boolean;
  redis: boolean;
  googleAuth: boolean;
  swagger: boolean;
  health: boolean;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Database connection options
 */
export interface DatabaseConnectionOptions {
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  url: string;
  ssl?: boolean;
  synchronize?: boolean;
  logging?: boolean;
}

/**
 * Redis connection options
 */
export interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  db: number;
}

/**
 * JWT configuration options
 */
export interface JwtOptions {
  secret: string;
  signOptions: {
    expiresIn: string;
  };
}

/**
 * Google OAuth configuration
 */
export interface GoogleOAuthOptions {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

/**
 * Sentry configuration options
 */
export interface SentryOptions {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
}

/**
 * CORS configuration options
 */
export interface CorsOptions {
  origin: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

/**
 * Throttle configuration options
 */
export interface ThrottleOptions {
  ttl: number;
  limit: number;
}

/**
 * Configuration constants
 */
export const CONFIG_CONSTANTS = {
  DEFAULT_PORT: 3000,
  DEFAULT_HOST: '0.0.0.0',
  DEFAULT_DATABASE_PORT: 5432,
  DEFAULT_REDIS_PORT: 6379,
  DEFAULT_JWT_EXPIRES_IN: '7d',
  DEFAULT_JWT_REFRESH_EXPIRES_IN: '30d',
  DEFAULT_CACHE_TTL: 300, // 5 minutes
  DEFAULT_THROTTLE_TTL: 60, // 1 minute
  DEFAULT_THROTTLE_LIMIT: 10,
  DEFAULT_LOG_LEVEL: 'info' as LogLevel,
  DEFAULT_LOG_FORMAT: 'json' as LogFormat,
  DEFAULT_SENTRY_TRACES_SAMPLE_RATE: 0.1,
  DEFAULT_SENTRY_PROFILES_SAMPLE_RATE: 0.1,
} as const;

/**
 * Required environment variables
 */
export const REQUIRED_ENV_VARS = ['JWT_SECRET', 'DATABASE_URL'] as const;

/**
 * Optional environment variables with defaults
 */
export const OPTIONAL_ENV_VARS = {
  NODE_ENV: 'development',
  APP_NAME: 'nestjs-boilerplate',
  APP_PORT: '3000',
  APP_HOST: '0.0.0.0',
  DATABASE_TYPE: 'postgres',
  DATABASE_HOST: 'localhost',
  DATABASE_PORT: '5432',
  DATABASE_USERNAME: 'postgres',
  DATABASE_PASSWORD: 'password',
  DATABASE_NAME: 'nestjs_boilerplate',
  JWT_EXPIRES_IN: '7d',
  JWT_REFRESH_EXPIRES_IN: '30d',
  CACHE_TTL: '300',
  THROTTLE_TTL: '60',
  THROTTLE_LIMIT: '10',
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',
  SWAGGER_ENABLED: 'true',
  HEALTH_CHECK_ENABLED: 'true',
  CORS_CREDENTIALS: 'true',
} as const;
