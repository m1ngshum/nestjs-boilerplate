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

        return {
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
          // Add read replica support if configured
          ...(process.env.DATABASE_READ_REPLICA_HOST && {
            replicas: [
              {
                name: 'read-replica',
                host: process.env.DATABASE_READ_REPLICA_HOST,
                port: parseInt(
                  process.env.DATABASE_READ_REPLICA_PORT || dbConfig.port.toString(),
                  10,
                ),
                user: process.env.DATABASE_READ_REPLICA_USERNAME || dbConfig.username,
                password: process.env.DATABASE_READ_REPLICA_PASSWORD || dbConfig.password,
                dbName: process.env.DATABASE_READ_REPLICA_NAME || dbConfig.database,
              },
            ],
          }),
          extensions: [Migrator],
          registerRequestContext: false,
        };
      },
    }),

    // Register entities for repository injection
    MikroOrmModule.forFeature([]),
  ],
  providers: [DatabaseService, PaginationService, DatabaseHealthIndicator],
  exports: [DatabaseService, PaginationService, DatabaseHealthIndicator, MikroOrmModule],
})
export class DatabaseModule {}
