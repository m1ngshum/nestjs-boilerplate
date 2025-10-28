import { registerAs } from '@nestjs/config';
import { ProjectConfiguration } from './project-configuration';

// Re-export types for backward compatibility
export type {
  BaseAppConfig as AppConfig,
  BaseDatabaseConfig as DatabaseConfig,
  BaseAuthConfig as AuthConfig,
  BaseCacheConfig as CacheConfig,
  BaseValkeyConfig as ValkeyConfig,
  BaseSentryConfig as SentryConfig,
  BaseCorsConfig as CorsConfig,
  BaseAdvancedCorsConfig as AdvancedCorsConfig,
  BaseThrottleConfig as ThrottleConfig,
  BaseSwaggerConfig as SwaggerConfig,
  BaseHealthConfig as HealthConfig,
  BaseLogConfig as LogConfig,
  BaseSecurityConfig as SecurityConfig,
} from './base-configuration';

export type {
  ProjectCorsConfig,
  ProjectAuthConfig,
  ProjectFeaturesConfig,
  ProjectConfiguration,
} from './project-configuration';

// Main configuration interface that includes both base and project-specific configs
export interface AppConfiguration extends ProjectConfiguration {}

export default registerAs('config', (): AppConfiguration => {
  // Import project configuration at runtime to avoid circular dependencies
  const { createProjectConfiguration } = require('./project-configuration');
  const { createBaseConfiguration } = require('./base-configuration');

  const baseConfig = createBaseConfiguration();
  return createProjectConfiguration(baseConfig);
});
