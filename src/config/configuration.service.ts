import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppConfiguration,
  AppConfig,
  AuthConfig,
  DatabaseConfig,
  CacheConfig,
  ValkeyConfig,
  SentryConfig,
  CorsConfig,
  AdvancedCorsConfig,
  SecurityConfig,
  ThrottleConfig,
  SwaggerConfig,
  HealthConfig,
  LogConfig,
} from './configuration';

@Injectable()
export class ConfigurationService {
  constructor(private readonly configService: ConfigService<AppConfiguration>) {}

  get app(): AppConfig {
    return this.configService.get<AppConfig>('config.app', { infer: true })!;
  }

  get auth(): AuthConfig | undefined {
    return this.configService.get<AuthConfig>('config.auth', { infer: true });
  }

  isAuthEnabled(): boolean {
    const auth = this.auth;
    return !!(auth?.jwtSecret && auth?.jwtRefreshSecret);
  }

  get database(): DatabaseConfig {
    return this.configService.get<DatabaseConfig>('config.database', { infer: true })!;
  }

  get cache(): CacheConfig {
    return this.configService.get<CacheConfig>('config.cache', { infer: true })!;
  }

  get valkey(): ValkeyConfig {
    return this.configService.get<ValkeyConfig>('config.valkey', { infer: true })!;
  }

  get sentry(): SentryConfig {
    return this.configService.get<SentryConfig>('config.sentry', { infer: true })!;
  }

  get cors(): CorsConfig & AdvancedCorsConfig {
    return this.configService.get<CorsConfig & AdvancedCorsConfig>('config.cors', { infer: true })!;
  }

  get throttle(): ThrottleConfig {
    return this.configService.get<ThrottleConfig>('config.throttle', { infer: true })!;
  }

  get swagger(): SwaggerConfig {
    return this.configService.get<SwaggerConfig>('config.swagger', { infer: true })!;
  }

  get health(): HealthConfig {
    return this.configService.get<HealthConfig>('config.health', { infer: true })!;
  }

  get log(): LogConfig {
    return this.configService.get<LogConfig>('config.log', { infer: true })!;
  }

  get security(): SecurityConfig {
    return this.configService.get<SecurityConfig>('config.security', { infer: true })!;
  }

  /**
   * Get a specific configuration value by path
   */
  get<T = any>(path: string, defaultValue?: T): T {
    const result = this.configService.get<T>(path as any, defaultValue as any);
    return result as T;
  }

  /**
   * Check if the application is running in development mode
   */
  isDevelopment(): boolean {
    return this.app.isDevelopment;
  }

  /**
   * Check if the application is running in production mode
   */
  isProduction(): boolean {
    return this.app.isProduction;
  }

  /**
   * Check if the application is running in test mode
   */
  isTest(): boolean {
    return this.app.isTest;
  }

  /**
   * Get the full database connection URL
   */
  getDatabaseUrl(): string {
    const db = this.database;
    return `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(feature: 'sentry' | 'redis' | 'swagger' | 'health'): boolean {
    switch (feature) {
      case 'sentry':
        return this.sentry.enabled;
      case 'redis':
        return this.cache.type === 'redis';
      case 'swagger':
        return this.swagger.enabled;
      case 'health':
        return this.health.enabled;
      default:
        return false;
    }
  }

  /**
   * Get Redis connection options
   */
  getRedisOptions() {
    if (this.cache.type !== 'redis') {
      return null;
    }

    return {
      host: this.cache.host,
      port: this.cache.port,
      password: this.cache.password,
      db: this.cache.db,
    };
  }

  /**
   * Get Sentry configuration
   */
  getSentryConfig() {
    if (!this.sentry.enabled) {
      return null;
    }

    return {
      dsn: this.sentry.dsn,
      environment: this.sentry.environment,
      tracesSampleRate: this.sentry.tracesSampleRate,
      profilesSampleRate: this.sentry.profilesSampleRate,
    };
  }
}
