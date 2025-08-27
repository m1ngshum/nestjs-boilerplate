import { validateConfiguration } from './configuration.validation';

describe('Configuration Validation', () => {
  const validConfig = {
    NODE_ENV: 'development',
    APP_NAME: 'test-app',
    APP_PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/testdb',
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: '5432',
    DATABASE_USERNAME: 'user',
    DATABASE_PASSWORD: 'pass',
    DATABASE_NAME: 'testdb',
    JWT_SECRET: 'test-secret',
  };

  it('should validate correct configuration', () => {
    expect(() => validateConfiguration(validConfig)).not.toThrow();
  });

  it('should throw error for missing JWT_SECRET', () => {
    const invalidConfig = { ...validConfig };
    (invalidConfig as any).JWT_SECRET = undefined;

    expect(() => validateConfiguration(invalidConfig)).toThrow(/JWT_SECRET/);
  });

  it('should throw error for missing DATABASE_PASSWORD', () => {
    const invalidConfig = { ...validConfig };
    (invalidConfig as any).DATABASE_PASSWORD = undefined;

    expect(() => validateConfiguration(invalidConfig)).toThrow(/DATABASE_PASSWORD/);
  });

  it('should throw error for invalid NODE_ENV', () => {
    const invalidConfig = {
      ...validConfig,
      NODE_ENV: 'invalid',
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/NODE_ENV/);
  });

  it('should throw error for invalid APP_PORT', () => {
    const invalidConfig = {
      ...validConfig,
      APP_PORT: '99999',
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/APP_PORT/);
  });

  it('should throw error for invalid DATABASE_PORT', () => {
    const invalidConfig = {
      ...validConfig,
      DATABASE_PORT: 'invalid',
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/DATABASE_PORT/);
  });

  it('should validate optional SENTRY_DSN URL', () => {
    const configWithSentry = {
      ...validConfig,
      SENTRY_DSN: 'https://test@sentry.io/123',
    };

    expect(() => validateConfiguration(configWithSentry)).not.toThrow();
  });

  it('should throw error for invalid SENTRY_DSN URL', () => {
    const invalidConfig = {
      ...validConfig,
      SENTRY_DSN: 'invalid-url',
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/SENTRY_DSN/);
  });

  it('should validate optional Redis configuration', () => {
    const configWithRedis = {
      ...validConfig,
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      REDIS_DB: '0',
    };

    expect(() => validateConfiguration(configWithRedis)).not.toThrow();
  });

  it('should throw error for invalid REDIS_PORT', () => {
    const invalidConfig = {
      ...validConfig,
      REDIS_HOST: 'localhost',
      REDIS_PORT: '99999',
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/REDIS_PORT/);
  });

  it('should throw error for invalid REDIS_DB', () => {
    const invalidConfig = {
      ...validConfig,
      REDIS_HOST: 'localhost',
      REDIS_DB: '16', // Redis DB should be 0-15
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/REDIS_DB/);
  });

  it('should validate boolean environment variables', () => {
    const configWithBooleans = {
      ...validConfig,
      DATABASE_SYNCHRONIZE: 'true',
      DATABASE_LOGGING: 'false',
      SWAGGER_ENABLED: 'true',
      CORS_CREDENTIALS: 'false',
    };

    expect(() => validateConfiguration(configWithBooleans)).not.toThrow();
  });

  it('should validate log level', () => {
    const configWithLogLevel = {
      ...validConfig,
      LOG_LEVEL: 'debug',
      LOG_FORMAT: 'json',
    };

    expect(() => validateConfiguration(configWithLogLevel)).not.toThrow();
  });

  it('should throw error for invalid log level', () => {
    const invalidConfig = {
      ...validConfig,
      LOG_LEVEL: 'invalid',
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/LOG_LEVEL/);
  });

  it('should validate throttle configuration', () => {
    const configWithThrottle = {
      ...validConfig,
      THROTTLE_TTL: '60',
      THROTTLE_LIMIT: '10',
    };

    expect(() => validateConfiguration(configWithThrottle)).not.toThrow();
  });

  it('should throw error for invalid throttle values', () => {
    const invalidConfig = {
      ...validConfig,
      THROTTLE_TTL: '0', // Should be at least 1
    };

    expect(() => validateConfiguration(invalidConfig)).toThrow(/THROTTLE_TTL/);
  });
});