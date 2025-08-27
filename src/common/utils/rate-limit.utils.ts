import { FastifyInstance } from 'fastify';
import { ConfigurationService } from '../../config/configuration.service';

export interface RouteRateLimitConfig {
  path: string;
  method?: string;
  limit: number;
  ttl: number; // in milliseconds
  blockDuration?: number; // in milliseconds
}

export function applyRouteSpecificRateLimits(
  app: FastifyInstance,
  configService: ConfigurationService
) {
  const throttleConfig = configService.throttle;
  
  // Apply custom rate limits for specific routes
  if (throttleConfig.custom && Array.isArray(throttleConfig.custom)) {
    throttleConfig.custom.forEach((config) => {
      const rateLimitOptions = {
        max: config.limit,
        timeWindow: config.ttl * 1000, // Convert seconds to milliseconds
      };

      // Register route-specific rate limit
      app.register(async function (fastify) {
        await fastify.register(require('@fastify/rate-limit'), rateLimitOptions);
        
        // Apply to specific path pattern
        fastify.addHook('preHandler', async (request, reply) => {
          // This hook will only apply to routes registered in this context
          if (request.url.match(new RegExp(config.path))) {
            // Rate limiting is automatically applied by the plugin
            return;
          }
        });
      }, { prefix: '' });
    });
  }
}

export function createRouteRateLimitDecorator(
  limit: number,
  timeWindow: number | string
) {
  return {
    config: {
      rateLimit: {
        max: limit,
        timeWindow: timeWindow,
      },
    },
  };
}

// Common rate limit configurations
export const RATE_LIMIT_PRESETS = {
  // Very strict for sensitive operations
  STRICT: { max: 5, timeWindow: '5 minutes' },
  
  // Moderate for API endpoints
  MODERATE: { max: 100, timeWindow: '1 minute' },
  
  // Lenient for public endpoints
  LENIENT: { max: 1000, timeWindow: '1 minute' },
  
  // For authentication endpoints
  AUTH: { max: 10, timeWindow: '15 minutes' },
  
  // For file uploads
  UPLOAD: { max: 5, timeWindow: '1 minute' },
  
  // For search/query endpoints
  SEARCH: { max: 50, timeWindow: '1 minute' },
} as const;