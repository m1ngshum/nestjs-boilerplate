// Initialize Sentry before any other imports
import './sentry/sentry.config';
import * as Sentry from '@sentry/nestjs';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCorsPlugin from './common/plugins/fastify-cors.plugin';
import { AppModule } from './app.module';
import { ConfigurationService } from './config/configuration.service';
import { LoggerService } from './logger/logger.service';
import { LoggingInterceptor } from './logger/interceptors/logging.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateRequiredEnvVars } from './config/config.utils';

async function bootstrap() {
  // Validate required environment variables
  const validationResult = validateRequiredEnvVars();
  if (!validationResult.isValid) {
    console.error('Configuration validation failed:');
    validationResult.errors.forEach((error) => console.error(`  - ${error}`));
    if (validationResult.warnings.length > 0) {
      console.warn('Configuration warnings:');
      validationResult.warnings.forEach((warning) => console.warn(`  - ${warning}`));
    }

    // Capture validation error in Sentry before exiting
    const validationError = new Error(
      `Environment validation failed: ${validationResult.errors.join(', ')}`,
    );
    validationError.name = 'EnvironmentValidationError';

    Sentry.withScope((scope) => {
      scope.setTag('error_type', 'environment_validation');
      scope.setLevel('error');
      scope.setContext('validation_errors', {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        environment: process.env.NODE_ENV,
      });

      Sentry.captureException(validationError);
    });

    // Flush Sentry events before exiting
    await Sentry.flush(2000);

    process.exit(1);
  }
  if (validationResult.warnings.length > 0) {
    console.warn('Configuration warnings:');
    validationResult.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  const fastifyAdapter = new FastifyAdapter({
    logger: false,
    trustProxy: true,
    ignoreTrailingSlash: true,
    ignoreDuplicateSlashes: true,
    connectionTimeout: 30000,
    keepAliveTimeout: 5000,
    maxRequestsPerSocket: 0,
    bodyLimit: 10485760, // 10MB
  });

  let app: NestFastifyApplication;
  try {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
      logger: false,
      bufferLogs: true,
    });
  } catch (error) {
    console.error(
      'Failed to create NestJS application:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }

  const configService = app.get(ConfigurationService);

  const logger = await app.resolve(LoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Security middleware with configuration-driven headers
  const securityConfig = configService.security;
  const helmet = await import('@fastify/helmet');
  await app.register(helmet.default as any, {
    contentSecurityPolicy: securityConfig.csp.enabled
      ? {
          directives: {
            defaultSrc: securityConfig.csp.directives.defaultSrc,
            styleSrc: securityConfig.csp.directives.styleSrc,
            scriptSrc: securityConfig.csp.directives.scriptSrc,
            imgSrc: securityConfig.csp.directives.imgSrc,
            fontSrc: securityConfig.csp.directives.fontSrc,
            connectSrc: securityConfig.csp.directives.connectSrc,
            objectSrc: [`'none'`],
            mediaSrc: [`'self'`],
            frameSrc: [`'none'`],
            ...(configService.app.isProduction && { upgradeInsecureRequests: [] }),
          },
          reportOnly: securityConfig.csp.reportOnly,
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: securityConfig.frameOptions },
    hidePoweredBy: true,
    hsts: securityConfig.hsts.enabled
      ? {
          maxAge: securityConfig.hsts.maxAge,
          includeSubDomains: securityConfig.hsts.includeSubDomains,
          preload: securityConfig.hsts.preload,
        }
      : false,
    ieNoOpen: true,
    noSniff: securityConfig.contentTypeOptions,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: securityConfig.referrerPolicy as any },
    xssFilter: true,
  });

  // Compression
  const compression = await import('@fastify/compress');
  await app.register(compression.default as any, {
    encodings: ['gzip', 'deflate'],
    threshold: 1024, // Only compress responses larger than 1KB
  });

  // CORS using custom Fastify plugin with route-specific support
  await app.register(fastifyCorsPlugin as any, {
    configService,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor(logger));

  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Swagger documentation
  if (configService.swagger.enabled) {
    const swaggerConfig = configService.swagger;

    const config = new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version)
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'Authorization',
      )
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-refresh-token' }, 'x-refresh-token')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
      .addTag('Application', 'Application information endpoints')
      .addTag('Health', 'Health check endpoints')
      .addTag('Auth', 'Authentication endpoints')
      .addServer(`${configService.app.url}`, `${configService.app.environment} server`)
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
      operationIdFactory: (_controllerKey: string, methodKey: string) => methodKey,
    });

    SwaggerModule.setup(swaggerConfig.path, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
        showRequestHeaders: true,
      },
    });

    logger.log(
      `Swagger documentation available at: ${configService.app.url}/${swaggerConfig.path}`,
    );
  }

  // Graceful shutdown with Fastify-specific cleanup
  const gracefulShutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down gracefully`);
    try {
      try {
        const orm = app.get('default_MikroORM', { strict: false });
        if (orm && typeof orm.close === 'function') {
          await orm.close();
          logger.log('MikroORM connection closed');
        }
      } catch (ormError) {
        logger.debug('MikroORM connection cleanup skipped:', ormError);
      }

      await app.close();
      logger.log('Application closed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  const appConfig = configService.app;

  // Start the server
  await app.listen({
    port: appConfig.port,
    host: appConfig.host,
    backlog: 511,
    exclusive: false,
    readableAll: false,
    writableAll: false,
    ipv6Only: false,
  });

  const url = await app.getUrl();
  logger.log(`Application is running on: ${url}`);
  logger.log(`Environment: ${appConfig.environment}`);
  logger.log(`Process ID: ${process.pid}`);

  if (configService.swagger.enabled) {
    logger.log(`Swagger documentation available at: ${url}/${configService.swagger.path}`);
  }
}

const BOOTSTRAP_TIMEOUT = parseInt(process.env.BOOTSTRAP_TIMEOUT_MS || '60000', 10);

const bootstrapWithTimeout = async () => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Bootstrap timeout after ${BOOTSTRAP_TIMEOUT}ms`));
    }, BOOTSTRAP_TIMEOUT);
  });

  try {
    await Promise.race([bootstrap(), timeoutPromise]);
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
};

bootstrapWithTimeout();
