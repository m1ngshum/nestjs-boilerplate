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

  const corsDomains = getAllowedDomains(configService);

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
    credentials: configService.cors.credentials ?? true,
    methods: configService.cors.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: configService.cors.allowedHeaders || [
      'Content-Type',
      'Authorization',
      'Accept',
    ],
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

  // Add onRequest hook for CORS to intercept OPTIONS before routing
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split('?')[0];
    let corsOptions: CorsOptions = defaultCorsOptions;

    // Find matching route-specific CORS configuration
    for (const route of processedRoutes) {
      if (route.matcher(pathname)) {
        corsOptions = {
          ...defaultCorsOptions,
          ...route.options,
          methods:
            route.options.methods && route.options.methods.length > 0
              ? route.options.methods
              : defaultCorsOptions.methods,
        };
        break;
      }
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      const origin = request.headers.origin as string;
      let originAllowed = false;

      if (corsOptions.origin && origin) {
        if (typeof corsOptions.origin === 'boolean') {
          originAllowed = corsOptions.origin;
          if (originAllowed) {
            reply.header('Access-Control-Allow-Origin', origin);
          }
        } else if (typeof corsOptions.origin === 'string') {
          originAllowed = corsOptions.origin === origin;
          if (originAllowed) {
            reply.header('Access-Control-Allow-Origin', corsOptions.origin);
          }
        } else if (Array.isArray(corsOptions.origin)) {
          originAllowed = corsOptions.origin.includes(origin);
          if (originAllowed) {
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
              resolve();
            });
          });
        }
      } else if (!origin) {
        originAllowed = true;
      }

      if (typeof corsOptions.origin !== 'function') {
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
      }
      return;
    }

    // Handle actual requests
    const origin = request.headers.origin as string;

    if (corsOptions.origin && origin) {
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

    if (corsOptions.exposedHeaders) {
      reply.header('Access-Control-Expose-Headers', corsOptions.exposedHeaders.join(', '));
    }
  });
}

function getAllowedDomains(configService: ConfigurationService): (string | RegExp)[] {
  const corsConfig = configService.cors;
  let domains: (string | RegExp)[] = [...(corsConfig.domains || [])];
  if (configService.app.isProduction) {
    domains = [...domains, ...(corsConfig.production || [])];
  } else {
    domains = [...domains, ...(corsConfig.production || []), ...(corsConfig.testing || [])];
  }
  return domains;
}

export default fp(fastifyCorsPlugin, {
  name: 'fastify-cors-plugin',
});