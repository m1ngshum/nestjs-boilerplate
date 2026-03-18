import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationService } from '../config/configuration.service';
import { LoadStrategy, Utils } from '@mikro-orm/postgresql';
import { Migrator } from '@mikro-orm/migrations';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { DatabaseService } from './database.service';
import { PaginationService } from './pagination.service';
import { DatabaseHealthIndicator } from './database-health.indicator';
import { LoggerService } from '../logger/logger.service';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      contextName: 'default',
      imports: [ConfigModule],
      inject: [ConfigurationService, LoggerService],
      useFactory: async (configService: ConfigurationService, loggerService: LoggerService) => {
        const dbConfig = configService.database;

        const config: any = {
          loadStrategy: LoadStrategy.JOINED,
          discovery: { warnWhenNoEntities: false },
          entities: ['dist/**/*.entity.js'],
          entitiesTs: ['src/**/*.entity.ts'],
          driver: PostgreSqlDriver,
          host: dbConfig.host,
          port: dbConfig.port,
          user: dbConfig.username,
          password: dbConfig.password,
          dbName: dbConfig.database,
          debug: configService.isDevelopment(),
          logger: (message) => loggerService.log(message),
          migrations: {
            path: Utils.detectTsNode() ? 'src/migrations' : 'dist/migrations',
            safe: true,
          },
          extensions: [Migrator],
          registerRequestContext: false,
          // Automatically route read operations to replicas (default: true)
          preferReadReplicas: true,
        };

        // Add read replica support if configured
        // MikroORM will automatically use these for SELECT/COUNT queries outside transactions
        if (dbConfig.readReplicas && dbConfig.readReplicas.length > 0) {
          config.replicas = dbConfig.readReplicas.map((replica, index) => ({
            name: replica.host,
            host: replica.host,
            port: replica.port,
            user: replica.username || dbConfig.username,
            password: replica.password || dbConfig.password,
            dbName: replica.database || dbConfig.database,
            ...(replica.weight && { weight: replica.weight }),
          }));
        }

        return config;
      },
    }),

    // Register entities for repository injection
    MikroOrmModule.forFeature([]),
  ],
  providers: [DatabaseService, PaginationService, DatabaseHealthIndicator],
  exports: [DatabaseService, PaginationService, DatabaseHealthIndicator, MikroOrmModule],
})
export class DatabaseModule {}
