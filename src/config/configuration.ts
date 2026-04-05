import { registerAs } from '@nestjs/config';

export interface ReadReplicaConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  weight?: number;
}

export interface DatabaseConfig {
  type: 'postgres';
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
  ssl: boolean;
  autoMigrate: boolean;
  readReplicas?: ReadReplicaConfig[];
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshSecret: string;
  jwtRefreshExpiresIn: string;
  enableGoogleAuth: boolean;
  googleClientId?: string;
  googleClientSecret?: string;
}

export interface CacheConfig {
  type: 'redis' | 'memory';
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  ttl: number;
}

export interface ValkeyConfig {
  cluster: {
    host: string;
    port: number;
  };
}

export interface SentryConfig {
  dsn?: string;
  environment: string;
  enabled: boolean;
  tracesSampleRate: number;
  profilesSampleRate: number;
}

export interface AppConfig {
  name: string;
  port: number;
  host: string;
  url: string;
  environment: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
}

export interface CorsConfig {
  origin: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
}

export interface AdvancedCorsConfig {
  domains?: (string | RegExp)[];
  production: (string | RegExp)[];
  testing: (string | RegExp)[];
  routes: Array<{
    path: string | RegExp;
    options?: {
      origin?: string | string[] | boolean;
      credentials?: boolean;
      methods?: string[];
      allowedHeaders?: string[];
      exposedHeaders?: string[];
      maxAge?: number;
    };
  }>;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
  enabled: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  blockDuration: number;
  custom: Array<{
    path: string;
    limit: number;
    ttl: number;
    blockDuration?: number;
  }>;
}

export interface SwaggerConfig {
  enabled: boolean;
  title: string;
  description: string;
  version: string;
  path: string;
}

export interface HealthConfig {
  enabled: boolean;
  databaseEnabled: boolean;
  redisEnabled: boolean;
}

export interface LogConfig {
  level: string;
  format: 'json' | 'simple';
}

export interface SecurityConfig {
  hsts: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  csp: {
    enabled: boolean;
    reportOnly: boolean;
    directives: {
      defaultSrc: string[];
      scriptSrc: string[];
      styleSrc: string[];
      imgSrc: string[];
      fontSrc: string[];
      connectSrc: string[];
    };
  };
  frameOptions: 'deny' | 'sameorigin';
  contentTypeOptions: boolean;
  referrerPolicy: string;
}

export interface AppConfiguration {
  app: AppConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  cache: CacheConfig;
  valkey: ValkeyConfig;
  sentry: SentryConfig;
  cors: CorsConfig & AdvancedCorsConfig;
  throttle: ThrottleConfig;
  swagger: SwaggerConfig;
  health: HealthConfig;
  log: LogConfig;
  security: SecurityConfig;
}

export default registerAs('config', (): AppConfiguration => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    app: {
      name: process.env.APP_NAME || 'nestjs-boilerplate',
      port: parseInt(process.env.APP_PORT || '3000', 10),
      host: process.env.APP_HOST || '0.0.0.0',
      url: process.env.APP_URL || 'http://localhost:3000',
      environment: nodeEnv,
      isDevelopment: nodeEnv === 'development',
      isProduction: nodeEnv === 'production',
      isTest: nodeEnv === 'test',
    },

    database: {
      type: 'postgres' as const,
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: (() => {
        const pw = process.env.DATABASE_PASSWORD;
        if (!pw) {
          throw new Error('DATABASE_PASSWORD must be set via environment variable');
        }
        return pw;
      })(),
      database: process.env.DATABASE_NAME || 'nestjs_boilerplate',
      synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
      logging: process.env.DATABASE_LOGGING === 'true' || nodeEnv === 'development',
      ssl: process.env.DATABASE_SSL === 'true',
      autoMigrate: process.env.DATABASE_AUTO_MIGRATE === 'true',
      readReplicas: (() => {
        const replicasEnv = process.env.DATABASE_READ_REPLICAS;
        if (!replicasEnv) {
          if (process.env.DATABASE_READ_REPLICA_HOST) {
            return [
              {
                host: process.env.DATABASE_READ_REPLICA_HOST,
                port: parseInt(process.env.DATABASE_READ_REPLICA_PORT || '5432', 10),
                username: process.env.DATABASE_READ_REPLICA_USERNAME,
                password: process.env.DATABASE_READ_REPLICA_PASSWORD,
                database: process.env.DATABASE_READ_REPLICA_NAME,
                weight: process.env.DATABASE_READ_REPLICA_WEIGHT
                  ? parseInt(process.env.DATABASE_READ_REPLICA_WEIGHT, 10)
                  : 1,
              },
            ];
          }
          return undefined;
        }

        try {
          return JSON.parse(replicasEnv);
        } catch {
          return undefined;
        }
      })(),
    },

    auth: {
      jwtSecret: (() => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET must be set via environment variable');
        }
        return secret;
      })(),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
      jwtRefreshSecret: (() => {
        const secret = process.env.JWT_REFRESH_SECRET;
        if (!secret) {
          throw new Error('JWT_REFRESH_SECRET must be set via environment variable');
        }
        return secret;
      })(),
      jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      enableGoogleAuth: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      googleClientId: process.env.GOOGLE_CLIENT_ID,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },

    cache: {
      type: (process.env.VALKEY_CLUSTER_HOST || process.env.REDIS_HOST ? 'redis' : 'memory') as
        | 'redis'
        | 'memory',
      host: process.env.VALKEY_CLUSTER_HOST || process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.VALKEY_CLUSTER_PORT || process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes default
    },

    valkey: {
      cluster: {
        host: process.env.VALKEY_CLUSTER_HOST || 'localhost',
        port: parseInt(process.env.VALKEY_CLUSTER_PORT || '6379', 10),
      },
    },

    sentry: {
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || nodeEnv,
      enabled: !!process.env.SENTRY_DSN,
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    },

    cors: {
      origin: process.env.CORS_ORIGIN?.split(',').map((s) => s.trim()) || ['http://localhost:3000'],
      credentials: process.env.CORS_CREDENTIALS === 'true',
      methods: process.env.CORS_METHODS?.split(',').map((s) => s.trim()) || [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'OPTIONS',
      ],
      allowedHeaders: process.env.CORS_ALLOWED_HEADERS?.split(',').map((s) => s.trim()) || [
        'Content-Type',
        'Authorization',
        'Accept',
      ],

      // Advanced CORS configuration for route-specific handling
      domains: process.env.CORS_DOMAINS?.split(',').map((s) => s.trim()) || [],
      production: process.env.CORS_PRODUCTION_DOMAINS?.split(',').map((s) => s.trim()) || [],
      testing: [
        `localhost:${process.env.APP_PORT || 3000}`,
        'localhost:3000',
        'localhost:3001',
        /localhost:\d+/,
        'http://localhost:3000',
        'http://localhost:3001',
        ...(process.env.CORS_TESTING_DOMAINS?.split(',') || []),
      ],
      routes: [
        // Example route-specific CORS configuration
        {
          path: '/v1/public',
          options: { origin: '*' },
        },
        // Add more route-specific configurations from environment
        ...JSON.parse(process.env.CORS_ROUTES_JSON || '[]'),
      ],
    },

    throttle: {
      ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000, // Convert to milliseconds
      limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
      enabled: process.env.THROTTLE_ENABLED !== 'false',
      skipSuccessfulRequests: process.env.THROTTLE_SKIP_SUCCESSFUL === 'true',
      skipFailedRequests: process.env.THROTTLE_SKIP_FAILED === 'true',
      blockDuration: parseInt(process.env.THROTTLE_BLOCK_DURATION || '300', 10), // 5 minutes
      custom: JSON.parse(process.env.THROTTLE_CUSTOM_PATHS || '[]'),
    },

    swagger: {
      enabled: process.env.SWAGGER_ENABLED !== 'false',
      title: process.env.SWAGGER_TITLE || 'NestJS Boilerplate API',
      description: process.env.SWAGGER_DESCRIPTION || 'A comprehensive NestJS boilerplate API',
      version: process.env.SWAGGER_VERSION || '1.0.0',
      path: process.env.SWAGGER_PATH || 'docs',
    },

    health: {
      enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
      databaseEnabled: process.env.HEALTH_CHECK_DATABASE_ENABLED !== 'false',
      redisEnabled: process.env.HEALTH_CHECK_REDIS_ENABLED !== 'false' && !!process.env.REDIS_HOST,
    },

    log: {
      level: process.env.LOG_LEVEL || 'info',
      format: (process.env.LOG_FORMAT as 'json' | 'simple') || 'json',
    },

    security: {
      hsts: {
        enabled: process.env.SECURITY_HSTS_ENABLED !== 'false',
        maxAge: parseInt(process.env.SECURITY_HSTS_MAX_AGE || '31536000', 10), // 1 year
        includeSubDomains: process.env.SECURITY_HSTS_INCLUDE_SUBDOMAINS !== 'false',
        preload: process.env.SECURITY_HSTS_PRELOAD !== 'false',
      },
      csp: {
        enabled: process.env.SECURITY_CSP_ENABLED !== 'false',
        reportOnly: process.env.SECURITY_CSP_REPORT_ONLY === 'true',
        directives: {
          defaultSrc: process.env.SECURITY_CSP_DEFAULT_SRC?.split(',').map((s) => s.trim()) || [
            `'self'`,
          ],
          scriptSrc: process.env.SECURITY_CSP_SCRIPT_SRC?.split(',').map((s) => s.trim()) || [
            `'self'`,
          ],
          styleSrc: process.env.SECURITY_CSP_STYLE_SRC?.split(',').map((s) => s.trim()) || [
            `'self'`,
          ],
          imgSrc: process.env.SECURITY_CSP_IMG_SRC?.split(',').map((s) => s.trim()) || [
            `'self'`,
            'data:',
            'https:',
          ],
          fontSrc: process.env.SECURITY_CSP_FONT_SRC?.split(',').map((s) => s.trim()) || [
            `'self'`,
            'https:',
            'data:',
          ],
          connectSrc: process.env.SECURITY_CSP_CONNECT_SRC?.split(',').map((s) => s.trim()) || [
            `'self'`,
          ],
        },
      },
      frameOptions: (process.env.SECURITY_FRAME_OPTIONS as 'deny' | 'sameorigin') || 'deny',
      contentTypeOptions: process.env.SECURITY_CONTENT_TYPE_OPTIONS !== 'false',
      referrerPolicy: process.env.SECURITY_REFERRER_POLICY || 'no-referrer',
    },
  };
});
