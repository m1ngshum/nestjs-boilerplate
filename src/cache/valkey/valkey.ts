import { Provider } from '@nestjs/common';
import { ConfigurationService } from '../../config/configuration.service';
import { Cluster, Redis, RedisOptions } from 'iovalkey';
import { LoggerService } from '../../logger/logger.service';

export const CACHE_INSTANCE = 'CACHE_INSTANCE';

export const ValkeyProvider: Provider = {
  provide: CACHE_INSTANCE,
  inject: [ConfigurationService, LoggerService],
  useFactory: (configService: ConfigurationService, logger: LoggerService): Redis | Cluster => {
    const isDevelopment = configService.isDevelopment();
    const cacheConfig = configService.cache;

    let client: Cluster | Redis;

    const baseOptions: RedisOptions = {
      commandTimeout: 5000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Valkey retrying connection attempt ${times} after ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        // Don't reconnect on auth errors — it will just loop forever
        if (err.message.includes('ERR AUTH')) {
          logger.error('Valkey AUTH failed — check REDIS_PASSWORD configuration', {
            error: err.message,
          });
          return false;
        }
        if (!err.message.includes('MOVED')) {
          logger.warn('Valkey reconnect on error', { error: err.message });
        }
        return true;
      },
    };

    if (!isDevelopment && cacheConfig.type === 'redis') {
      // Use Valkey cluster in production
      client = new Cluster(
        [
          {
            host: cacheConfig.host,
            port: cacheConfig.port,
          },
        ],
        {
          scaleReads: 'slave',
          dnsLookup: (address, callback) => callback(null, address),
          redisOptions: {
            showFriendlyErrorStack: true,
            ...(cacheConfig.password ? { password: cacheConfig.password } : {}),
            ...baseOptions,
          },
        },
      ) as Cluster;

      client.on('ready', () => {
        if (client instanceof Cluster) {
          const slaves = client.nodes('slave');
          Promise.all(slaves.map((node) => node.readonly()))
            .then(() => logger.log('Valkey cluster slaves set to readonly'))
            .catch((e) => logger.error('Failed to set Valkey slaves to readonly', e));
        }
      });
    } else {
      // Use single Redis instance for development or when Redis is configured
      client = new Redis({
        port: cacheConfig.port || 6379,
        host: cacheConfig.host || 'localhost',
        ...(cacheConfig.password ? { password: cacheConfig.password } : {}),
        db: cacheConfig.db || 0,
        ...baseOptions,
      });
    }

    client.on('error', (err) => {
      logger.error('Valkey connection error', { error: err.message });
    });

    client.on('connect', () => {
      logger.log('Valkey connected successfully');
    });

    client.on('ready', () => {
      logger.log('Valkey ready for operations');
    });

    client.on('close', () => {
      logger.warn('Valkey connection closed');
    });

    return client;
  },
};
