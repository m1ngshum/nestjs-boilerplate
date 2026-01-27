import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry before importing any other modules
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
  enabled: !!process.env.SENTRY_DSN,

  // Performance monitoring - trace all requests
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),

  // Profiling
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),

  integrations: [
    // Add profiling integration
    nodeProfilingIntegration(),
  ],

  // Distributed tracing - propagate trace context to downstream services
  tracePropagationTargets: [
    // Match all URLs by default, or configure specific targets
    /.*/,
    // Example: specific services
    // /^https:\/\/api\.example\.com/,
    // 'localhost',
  ],

  // Additional options
  beforeSend(event, _hint) {
    // Filter out health check errors and other noise
    if (event.request?.url?.includes('/healthz') || event.request?.url?.includes('/health')) {
      return null;
    }

    // Don't send events in test environment
    if (process.env.NODE_ENV === 'test') {
      return null;
    }

    // Add trace IDs to fingerprint for better grouping
    if (event.tags?.trace_id) {
      event.fingerprint = event.fingerprint || [];
      // Don't add trace_id to fingerprint - it would make each request unique
      // Instead, add route pattern for better grouping
      const httpRoute = event.tags?.['http.route'];
      if (httpRoute && typeof httpRoute === 'string') {
        event.fingerprint.push(httpRoute);
      }
    }

    return event;
  },

  beforeSendTransaction(transaction) {
    // Filter out health check transactions
    if (
      transaction.transaction?.includes('/healthz') ||
      transaction.transaction?.includes('/health')
    ) {
      return null;
    }

    return transaction;
  },

  // Release tracking
  release: process.env.SENTRY_RELEASE || process.env.npm_package_version,

  // Server name
  serverName: process.env.SENTRY_SERVER_NAME || process.env.HOSTNAME,

  // Debug mode (only in development)
  debug: process.env.NODE_ENV === 'development' && process.env.SENTRY_DEBUG === 'true',

  // Attach stack traces to messages
  attachStacktrace: true,

  // Maximum breadcrumbs to keep
  maxBreadcrumbs: 100,

  // Normalize depth for context
  normalizeDepth: 5,
});