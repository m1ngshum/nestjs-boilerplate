import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { HttpStatus } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.service';
import { match, MatchFunction } from 'path-to-regexp';

interface CorsOptions {
  origin?:
    | string
    | string[]
    | boolean
    | ((origin: string, callback: (err: Error | null, allow?: boolean) => void) => void);
  credentials?: boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  maxAge?: number;
}

interface RouteConfig {
  path: string | RegExp;
  options?: CorsOptions;
}

interface ProcessedRoute {
  matcher: MatchFunction<object>;
  options: CorsOptions;
}

interface FastifyCorsPluginOptions {
  configService: ConfigurationService;
}

async function fastifyCorsPlugin(fastify: FastifyInstance, options: FastifyCorsPluginOptions) {
  const { configService } = options;

  // Get route-specific CORS configurations
  const routeConfigs = configService.cors.routes || [];

  // Get environment-based domain configurations
  const currentEnv = configService.app.environment;
  const corsDomains = getAllowedDomains(configService, currentEnv);

  // Process allowed domains
  const allowedOrigins = new Set<string>();
  const allowedOriginsRegex: RegExp[] = [];
  const allowedOriginSuffixes: string[] = [];

  corsDomains.forEach((domain) => {
    if (domain instanceof RegExp) {
      allowedOriginsRegex.push(domain);
    } else if (typeof domain === 'string') {
      allowedOrigins.add(domain);
      allowedOriginSuffixes.push(`.${domain}`);
    }
  });

  // Default CORS options
  const defaultCorsOptions: CorsOptions = {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) {
        return callback(null, false);
      }

      if (allowedOriginsRegex.some((re) => re.test(origin))) {
        return callback(null, true);
      }

      let originHost: string;
      try {
        originHost = new URL(origin).host;
      } catch (e) {
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      }

      if (allowedOrigins.has(originHost)) {
        return callback(null, true);
      }

      if (allowedOriginSuffixes.some((suffix) => originHost.endsWith(suffix))) {
        return callback(null, true);
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  };

  // Process route-specific configurations
  const processedRoutes: ProcessedRoute[] = [];

  routeConfigs.forEach((route) => {
    try {
      let matcher: MatchFunction<object>;

      if (typeof route.path === 'string') {
        matcher = match(route.path, { decode: decodeURIComponent });
      } else {
        matcher = (pathname: string): any => {
          const result = (route.path as RegExp).exec(pathname);
          if (result) {
            return { path: pathname, index: result.index, params: {} };
          }
          return false;
        };
      }

      const finalOptions: CorsOptions = { ...defaultCorsOptions, ...route.options };

      if (route.options?.origin === '*') {
        finalOptions.origin = true;
      }

      processedRoutes.push({ matcher, options: finalOptions });
    } catch (e) {
      console.error(`Failed to process CORS route ${route.path}:`, e);
    }
  });

  // Add preHandler hook for CORS
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split('?')[0];
    let corsOptions: CorsOptions = defaultCorsOptions;

    // Find matching route-specific CORS configuration
    for (const route of processedRoutes) {
      if (route.matcher(pathname)) {
        corsOptions = { ...defaultCorsOptions, ...route.options };
        break;
      }
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const origin = request.headers.origin as string;

      if (corsOptions.origin) {
        if (typeof corsOptions.origin === 'boolean') {
          if (corsOptions.origin) {
            reply.header('Access-Control-Allow-Origin', origin || '*');
          }
        } else if (typeof corsOptions.origin === 'string') {
          reply.header('Access-Control-Allow-Origin', corsOptions.origin);
        } else if (Array.isArray(corsOptions.origin)) {
          if (origin && corsOptions.origin.includes(origin)) {
            reply.header('Access-Control-Allow-Origin', origin);
          }
        } else if (typeof corsOptions.origin === 'function') {
          return new Promise((resolve) => {
            (corsOptions.origin as Function)(origin, (err: Error | null, allow?: boolean) => {
              if (err) {
                reply.code(HttpStatus.FORBIDDEN).send({ error: err.message });
                return resolve();
              }
              if (allow) {
                reply.header('Access-Control-Allow-Origin', origin);
              }
              resolve();
            });
          });
        }
      }

      if (corsOptions.credentials) {
        reply.header('Access-Control-Allow-Credentials', 'true');
      }

      if (corsOptions.methods) {
        reply.header('Access-Control-Allow-Methods', corsOptions.methods.join(', '));
      }

      if (corsOptions.allowedHeaders) {
        reply.header('Access-Control-Allow-Headers', corsOptions.allowedHeaders.join(', '));
      }

      if (corsOptions.maxAge) {
        reply.header('Access-Control-Max-Age', corsOptions.maxAge.toString());
      }

      reply.code(204).send();
      return;
    }

    // Handle actual requests
    const origin = request.headers.origin as string;

    if (corsOptions.origin && origin) {
      if (typeof corsOptions.origin === 'boolean') {
        if (corsOptions.origin) {
          reply.header('Access-Control-Allow-Origin', origin);
        }
      } else if (typeof corsOptions.origin === 'string') {
        reply.header('Access-Control-Allow-Origin', corsOptions.origin);
      } else if (Array.isArray(corsOptions.origin)) {
        if (corsOptions.origin.includes(origin)) {
          reply.header('Access-Control-Allow-Origin', origin);
        }
      } else if (typeof corsOptions.origin === 'function') {
        return new Promise((resolve) => {
          (corsOptions.origin as Function)(origin, (err: Error | null, allow?: boolean) => {
            if (err) {
              reply.code(HttpStatus.FORBIDDEN).send({ error: err.message });
              return resolve();
            }
            if (allow) {
              reply.header('Access-Control-Allow-Origin', origin);
            }
            resolve();
          });
        });
      }
    }

    if (corsOptions.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    if (corsOptions.exposedHeaders) {
      reply.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
    }
  });
}

function getAllowedDomains(configService: ConfigurationService, env: string): (string | RegExp)[] {
  return configService.cors.domains || [];
}

export default fp(fastifyCorsPlugin, {
  name: 'fastify-cors-plugin',
});
