import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry before importing any other modules
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN,
  
  // Performance monitoring
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  
  // Profiling
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
  integrations: [
    // Add profiling integration
    nodeProfilingIntegration(),
  ],
  
  // Additional options
  beforeSend(event) {
    // Filter out health check errors and other noise
    if (event.request?.url?.includes('/health')) {
      return null;
    }
    
    // Don't send events in test environment
    if (process.env.NODE_ENV === 'test') {
      return null;
    }
    
    return event;
  },
  
  // Release tracking
  release: process.env.SENTRY_RELEASE || process.env.npm_package_version,
  
  // Server name
  serverName: process.env.SENTRY_SERVER_NAME || process.env.HOSTNAME,
});