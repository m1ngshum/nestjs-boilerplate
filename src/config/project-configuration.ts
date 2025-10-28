import { registerAs } from '@nestjs/config';
import { BaseConfiguration, BaseAdvancedCorsConfig } from './base-configuration';

// Project-specific extensions to base configuration
export interface ProjectCorsConfig extends BaseAdvancedCorsConfig {
  // Project-specific CORS extensions
  domains?: (string | RegExp)[];
  customRoutes?: Array<{
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

// Example: Project-specific authentication config
export interface ProjectAuthConfig {
  // Add project-specific auth features
  enableWebAuthn?: boolean;
  enableMagicLink?: boolean;
  sessionTimeout?: number;
  // Add more project-specific auth features as needed
}

// Example: Project-specific feature flags
export interface ProjectFeaturesConfig {
  enableAnalytics?: boolean;
  enableNotifications?: boolean;
  enableRealtime?: boolean;
  experimentalFeatures?: string[];
}

// Project-specific configuration that extends base
export interface ProjectConfiguration extends BaseConfiguration {
  cors: BaseConfiguration['cors'] & ProjectCorsConfig;
  // Add project-specific config sections
  projectAuth?: ProjectAuthConfig;
  features?: ProjectFeaturesConfig;
  // Add more project-specific sections as needed
}

// Project-specific configuration factory
export const createProjectConfiguration = (baseConfig: BaseConfiguration): ProjectConfiguration => {
  return {
    ...baseConfig,

    // Override/extend CORS with project-specific features
    cors: {
      ...baseConfig.cors,

      // Project-specific domains
      domains: process.env.CORS_DOMAINS?.split(',') || [],

      // Project-specific custom routes
      customRoutes: JSON.parse(process.env.CORS_CUSTOM_ROUTES_JSON || '[]'),
    },

    // Project-specific auth extensions
    projectAuth: {
      enableWebAuthn: process.env.AUTH_ENABLE_WEBAUTHN === 'true',
      enableMagicLink: process.env.AUTH_ENABLE_MAGIC_LINK === 'true',
      sessionTimeout: parseInt(process.env.AUTH_SESSION_TIMEOUT || '86400', 10), // 24 hours
    },

    // Project-specific feature flags
    features: {
      enableAnalytics: process.env.FEATURES_ANALYTICS === 'true',
      enableNotifications: process.env.FEATURES_NOTIFICATIONS === 'true',
      enableRealtime: process.env.FEATURES_REALTIME === 'true',
      experimentalFeatures: process.env.EXPERIMENTAL_FEATURES?.split(',') || [],
    },
  };
};

export default registerAs('projectConfig', () => {
  // Import base configuration at runtime to avoid circular dependencies
  const { createBaseConfiguration } = require('./base-configuration');
  const baseConfig = createBaseConfiguration();
  return createProjectConfiguration(baseConfig);
});
