import { Module, NestModule, MiddlewareConsumer, OnModuleInit } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ClsModule, ClsMiddleware } from 'nestjs-cls';
import { MikroORM } from '@mikro-orm/postgresql';
import { InjectMikroORM } from '@mikro-orm/nestjs';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerStorageService } from './common/services/throttler-storage.service';
import { IpMiddleware } from './common/middlewares/ip.middleware';
import { ThrottlerBehindProxyGuard } from './common/guards/throttler-behind-proxy.guard';
import { APP_GUARD } from '@nestjs/core';
import { ConfigurationService } from './config/configuration.service';
import { CacheService } from './cache/cache.service';
import { ConfigurationModule } from './config/configuration.module';
import { LoggerModule } from './logger/logger.module';
import { LoggerService } from './logger/logger.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { CacheModule } from './cache/cache.module';
import { HealthModule } from './health/health.module';
import { SentryModule } from './sentry/sentry.module';
import { TracingModule } from './common/tracing/tracing.module';

@Module({
  imports: [
    // Core configuration
    ConfigurationModule,

    // Request context
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: any) => req.headers['x-correlation-id'] || undefined,
      },
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [CacheModule],
      inject: [CacheService],
      useFactory: (cacheService: CacheService) => {
        if (!cacheService.store) {
          throw new Error('Cache service not found');
        }

        const store = new ThrottlerStorageService(cacheService.store);
        const throttleDisabled = process.env.THROTTLE_DISABLED === 'true';

        if (throttleDisabled) {
          return {
            storage: store,
            throttlers: [
              {
                name: 'default',
                ttl: Number.MAX_SAFE_INTEGER,
                limit: Number.MAX_SAFE_INTEGER,
                skipIf: () => true,
              },
            ],
          };
        }

        return {
          storage: store,
          throttlers: [
            {
              name: 'default',
              ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
              limit: parseInt(process.env.THROTTLE_LIMIT || '10', 10),
              skipIf: (req) => {
                const path = req.switchToHttp().getRequest().url;
                return path.includes('health') || path.includes('ping');
              },
            },
          ],
        };
      },
    }),

    // Core modules
    LoggerModule,
    DatabaseModule,
    CommonModule,
    CacheModule,
    HealthModule,
    SentryModule,
    TracingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    IpMiddleware,
    {
      provide: APP_GUARD,
      useClass: ThrottlerBehindProxyGuard,
    },
  ],
})
export class AppModule implements NestModule, OnModuleInit {
  constructor(
    @InjectMikroORM('default') private readonly orm: MikroORM,
    private readonly configService: ConfigurationService,
    private readonly logger: LoggerService,
  ) {}

  async onModuleInit() {
    if (this.configService.database.autoMigrate) {
      const migrator = this.orm.getMigrator();
      try {
        await migrator.up();
        this.logger.log('Database migrations completed successfully');
      } catch (error) {
        this.logger.error('Database migration failed', error);
        // Only exit in production, allow development to continue
        if (this.configService.isProduction()) {
          process.exit(1);
        } else {
          this.logger.warn('Continuing without migrations in development mode');
        }
      }
    }
  }

  configure(consumer: MiddlewareConsumer) {
    // Apply ClsMiddleware globally
    consumer.apply(ClsMiddleware).forRoutes('*');

    // Apply IpMiddleware globally
    consumer.apply(IpMiddleware).forRoutes('*');
  }
}
