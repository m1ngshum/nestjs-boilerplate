import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';
import configuration from './configuration';

describe('ConfigurationService', () => {
  let service: ConfigurationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [configuration],
          ignoreEnvFile: true,
        }),
      ],
      providers: [ConfigurationService],
    }).compile();

    service = module.get<ConfigurationService>(ConfigurationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('app configuration', () => {
    it('should return app configuration', () => {
      const appConfig = service.app;
      expect(appConfig).toBeDefined();
      expect(appConfig.name).toBeDefined();
      expect(appConfig.port).toBeDefined();
      expect(appConfig.environment).toBeDefined();
    });

    it('should detect development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(service.isDevelopment()).toBe(true);
      expect(service.isProduction()).toBe(false);
      expect(service.isTest()).toBe(false);
    });

    it('should detect production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(service.isDevelopment()).toBe(false);
      expect(service.isProduction()).toBe(true);
      expect(service.isTest()).toBe(false);
    });
  });

  describe('database configuration', () => {
    it('should return database configuration', () => {
      const dbConfig = service.database;
      expect(dbConfig).toBeDefined();
      expect(dbConfig.type).toBeDefined();
      expect(dbConfig.host).toBeDefined();
      expect(dbConfig.port).toBeDefined();
    });

    it('should return database URL', () => {
      const dbUrl = service.getDatabaseUrl();
      expect(dbUrl).toBeDefined();
      expect(typeof dbUrl).toBe('string');
    });
  });

  describe('cache configuration', () => {
    it('should return cache configuration', () => {
      const cacheConfig = service.cache;
      expect(cacheConfig).toBeDefined();
      expect(cacheConfig.type).toBeDefined();
      expect(cacheConfig.ttl).toBeDefined();
    });

    it('should return Redis options when Redis is configured', () => {
      process.env.REDIS_HOST = 'localhost';
      const redisOptions = service.getRedisOptions();
      expect(redisOptions).toBeDefined();
      expect(redisOptions?.host).toBe('localhost');
    });

    it('should return null Redis options when Redis is not configured', () => {
      delete process.env.REDIS_HOST;
      const redisOptions = service.getRedisOptions();
      expect(redisOptions).toBeNull();
    });
  });

  describe('feature flags', () => {
    it('should check if Sentry is enabled', () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      expect(service.isFeatureEnabled('sentry')).toBe(true);

      delete process.env.SENTRY_DSN;
      expect(service.isFeatureEnabled('sentry')).toBe(false);
    });

    it('should check if Redis is enabled', () => {
      process.env.REDIS_HOST = 'localhost';
      expect(service.isFeatureEnabled('redis')).toBe(true);

      delete process.env.REDIS_HOST;
      expect(service.isFeatureEnabled('redis')).toBe(false);
    });
  });

  describe('Sentry configuration', () => {
    it('should return Sentry config when enabled', () => {
      process.env.SENTRY_DSN = 'https://test@sentry.io/123';
      process.env.SENTRY_ENVIRONMENT = 'test';

      const sentryConfig = service.getSentryConfig();
      expect(sentryConfig).toBeDefined();
      expect(sentryConfig?.dsn).toBe('https://test@sentry.io/123');
      expect(sentryConfig?.environment).toBe('test');
    });

    it('should return null when Sentry is not configured', () => {
      delete process.env.SENTRY_DSN;

      const sentryConfig = service.getSentryConfig();
      expect(sentryConfig).toBeNull();
    });
  });
});
