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
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ClsService } from 'nestjs-cls';

async function bootstrap() {
  console.log('🚀 Starting application bootstrap...');

  console.log('📦 Creating NestJS application...');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: false,
      // Fastify-specific optimizations
      trustProxy: true,
      ignoreTrailingSlash: true,
      ignoreDuplicateSlashes: true,
      // Connection settings
      connectionTimeout: 30000,
      keepAliveTimeout: 5000,
      maxRequestsPerSocket: 0,
      // Body parsing limits
      bodyLimit: 10485760, // 10MB
    }),
    {
      logger: false,
      bufferLogs: true,
      // Enable CORS preflight caching
      cors: true,
    },
  );
  console.log('✅ NestJS application created successfully');

  console.log('🔧 Getting configuration service...');
  const configService = app.get(ConfigurationService);
  console.log('✅ Configuration service obtained');

  console.log('📝 Setting up logger...');
  const logger = await app.resolve(LoggerService);
  logger.setContext('Bootstrap');

  // Use custom logger
  app.useLogger(logger);
  console.log('✅ Logger configured');

  console.log('🌐 Setting global prefix...');
  // Global prefix
  app.setGlobalPrefix('api');
  console.log('✅ Global prefix set');

  console.log('🔢 Enabling API versioning...');
  // API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  console.log('✅ API versioning enabled');

  console.log('🛡️ Setting up security middleware...');
  // Security middleware with configuration-driven headers
  const securityConfig = configService.security;
  console.log('🔧 Registering helmet security middleware...');
  const helmet = await import('@fastify/helmet');
  await app.register(helmet.default as any, {
    // Content Security Policy
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
    // Cross-Origin Embedder Policy
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
    // Cross-Origin Opener Policy
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    // Cross-Origin Resource Policy
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // DNS Prefetch Control
    dnsPrefetchControl: { allow: false },
    // Frame Options
    frameguard: { action: securityConfig.frameOptions },
    // Hide Powered-By header
    hidePoweredBy: true,
    // HTTP Strict Transport Security
    hsts: securityConfig.hsts.enabled
      ? {
          maxAge: securityConfig.hsts.maxAge,
          includeSubDomains: securityConfig.hsts.includeSubDomains,
          preload: securityConfig.hsts.preload,
        }
      : false,
    // IE No Open
    ieNoOpen: true,
    // No Sniff
    noSniff: securityConfig.contentTypeOptions,
    // Origin Agent Cluster
    originAgentCluster: true,
    // Permitted Cross-Domain Policies
    permittedCrossDomainPolicies: false,
    // Referrer Policy
    referrerPolicy: { policy: securityConfig.referrerPolicy as any },
    // X-XSS-Protection
    xssFilter: true,
  });
  console.log('✅ Helmet security middleware registered');

  console.log('🗜️ Registering compression middleware...');
  // Compression
  const compression = await import('@fastify/compress');
  await app.register(compression.default as any, {
    encodings: ['gzip', 'deflate'],
    threshold: 1024, // Only compress responses larger than 1KB
  });
  console.log('✅ Compression middleware registered');

  console.log('🌐 Registering CORS plugin...');
  // CORS using custom Fastify plugin with route-specific support
  await app.register(fastifyCorsPlugin as any, {
    configService,
  });
  console.log('✅ CORS plugin registered');

  console.log('🔧 Setting up global pipes...');
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
  console.log('✅ Global pipes configured');

  console.log('🔄 Setting up global interceptors...');
  // Global interceptors
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new TransformInterceptor(app.get(ClsService)),
  );
  console.log('✅ Global interceptors configured');

  console.log('🛡️ Setting up global filters...');
  // Global filters
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  console.log('✅ Global filters configured');

  console.log('📚 Setting up Swagger documentation...');
  // Swagger documentation
  if (configService.swagger.enabled) {
    const swaggerConfig = configService.swagger;

    // Create a comprehensive Swagger configuration
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
      .addServer(`http://localhost:${configService.app.port}`, 'Local development')
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      deepScanRoutes: true,
      operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
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
      `📚 Swagger documentation will be available at: http://localhost:${configService.app.port}/${swaggerConfig.path}`,
    );
  }

  // Graceful shutdown with Fastify-specific cleanup
  const gracefulShutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down gracefully`);
    try {
      // Close MikroORM connection
      try {
        // Try to get MikroORM with the correct context name
        const orm = app.get('default_MikroORM', { strict: false });
        if (orm && typeof orm.close === 'function') {
          await orm.close();
          logger.log('MikroORM connection closed');
        } else {
          logger.log('MikroORM not found or already closed');
        }
      } catch (ormError) {
        // Only log as debug since this is expected during development/testing
        logger.debug('MikroORM connection cleanup skipped:', ormError);
      }

      // Close Fastify server gracefully
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
  console.log('✅ Graceful shutdown handlers registered');

  console.log('🔧 Getting application configuration...');
  const appConfig = configService.app;
  const swaggerConfig = configService.swagger;
  console.log(`📋 App config: ${appConfig.host}:${appConfig.port} (${appConfig.environment})`);

  console.log('🚀 Starting server...');
  // Start the server with Fastify-specific options
  await app.listen({
    port: appConfig.port,
    host: appConfig.host,
    // Fastify listen options
    backlog: 511,
    exclusive: false,
    readableAll: false,
    writableAll: false,
    ipv6Only: false,
  });

  const url = await app.getUrl();
  logger.log(`🚀 Application is running on: ${url}`);
  logger.log(`🏃 Environment: ${appConfig.environment}`);
  logger.log(`📊 Process ID: ${process.pid}`);

  if (swaggerConfig.enabled) {
    logger.log(`📚 Swagger documentation available at: ${url}/${swaggerConfig.path}`);
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
