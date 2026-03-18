// Initialize Sentry before any other imports
import './sentry/sentry.config';

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

async function bootstrap() {
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

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
    logger: false,
    bufferLogs: true,
    cors: true,
  });

  const configService = app.get(ConfigurationService);
  const logger = await app.resolve(LoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Security middleware
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
    threshold: 1024,
  });

  // CORS
  await app.register(fastifyCorsPlugin as any, { configService });

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

  // Global interceptors and filters
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Swagger documentation
  if (configService.swagger.enabled) {
    const swaggerConfig = configService.swagger;

    const config = new DocumentBuilder()
      .setTitle(swaggerConfig.title)
      .setDescription(swaggerConfig.description)
      .setVersion(swaggerConfig.version)
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'Authorization')
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
      .addTag('Application', 'Application information endpoints')
      .addTag('Health', 'Health check endpoints')
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

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down gracefully`);
    try {
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
  await app.listen({
    port: appConfig.port,
    host: appConfig.host,
  });

  const url = await app.getUrl();
  logger.log(`Application is running on: ${url}`);
  logger.log(`Environment: ${appConfig.environment}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
