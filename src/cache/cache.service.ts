import { Inject, Injectable } from '@nestjs/common';
import { Cluster, Redis } from 'iovalkey';
import { CACHE_INSTANCE } from './valkey/valkey';
import { LoggerService } from '../logger/logger.service';

type CacheOperation = {
  set: { value: unknown; ttl?: number };
  del: undefined;
  incr: { ttl?: number };
  zadd: { score: number; member: string };
  zremrangebyscore: { min: number | string; max: number | string };
};

@Injectable()
export class CacheService {
  private readonly BATCH_SIZE = 1000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY_MS = 1000;

  constructor(
    @Inject(CACHE_INSTANCE)
    private readonly valkey: Redis | Cluster,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(CacheService.name);
  }

  get store(): Redis | Cluster {
    return this.valkey;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.valkey.get(key);
      this.logger.debug(`Cache GET: ${key} - ${value ? 'HIT' : 'MISS'}`);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logger.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(
    key: string,
    value: unknown,
    options: { ttl?: number | string; unixTimestamp?: number } = {},
  ): Promise<boolean> {
    try {
      const { ttl, unixTimestamp } = options;
      const valueString = JSON.stringify(value);
      let result: string;

      if (unixTimestamp) {
        result = await this.valkey.set(key, valueString, 'EXAT', unixTimestamp);
      } else if (ttl) {
        result = await this.valkey.set(key, valueString, 'EX', ttl);
      } else {
        result = await this.valkey.set(key, valueString);
      }

      this.logger.debug(`Cache SET: ${key} (TTL: ${ttl || 'none'})`);
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string | string[]): Promise<boolean> {
    try {
      const keys = Array.isArray(key) ? key : [key];
      const result = await this.valkey.del(keys);
      this.logger.debug(`Cache DEL: ${keys.join(', ')}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`Cache DEL error for key(s) ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async reset(): Promise<void> {
    try {
      await this.valkey.flushall();
      this.logger.debug('Cache RESET: All keys cleared');
    } catch (error) {
      this.logger.error('Cache RESET error:', error);
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];

    const chunks = Array.from({ length: Math.ceil(keys.length / this.BATCH_SIZE) }, (_, i) =>
      keys.slice(i * this.BATCH_SIZE, (i + 1) * this.BATCH_SIZE),
    );

    try {
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const values = await this.valkey.mget(chunk);
          return values.map((value) => (value ? (JSON.parse(value) as T) : null));
        }),
      );
      return results.flat();
    } catch (error) {
      this.logger.error(`Cache MGET error for keys:`, error);
      return keys.map(() => null);
    }
  }

  /**
   * Increment a key
   */
  async incr(key: string, ttl?: number | string): Promise<number | null> {
    try {
      let result: number;

      if (ttl) {
        const multi = this.valkey.multi();
        multi.incr(key);
        multi.expire(key, ttl);

        const results = await multi.exec();
        if (!results?.every(([err]) => !err)) {
          return null;
        }

        result = results[0][1] as number;
      } else {
        result = await this.valkey.incr(key);
      }

      this.logger.debug(`Cache INCR: ${key} -> ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Cache INCR error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Get or set pattern - if key exists return it, otherwise set and return new value
   */
  async getOrSet<T>(key: string, factory: () => Promise<T> | T, ttl?: number): Promise<T> {
    try {
      let value = await this.get<T>(key);

      if (value === null) {
        value = await factory();
        await this.set(key, value, { ttl });
        this.logger.debug(`Cache MISS -> SET: ${key}`);
      }

      return value;
    } catch (error) {
      this.logger.error(`Cache getOrSet error for key ${key}:`, error);
      // Fallback to factory function if cache fails
      return await factory();
    }
  }

  /**
   * Wrap a function with caching
   */
  wrap<T>(key: string, fn: () => Promise<T> | T, ttl?: number): Promise<T> {
    return this.getOrSet(key, fn, ttl);
  }

  /**
   * Generate cache key with prefix
   */
  generateKey(prefix: string, ...parts: (string | number)[]): string {
    return [prefix, ...parts].join(':');
  }

  /**
   * Count items in sorted set
   */
  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    try {
      return await this.valkey.zcount(key, min, max);
    } catch (error) {
      this.logger.error(`Cache ZCOUNT error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Execute multiple operations in a pipeline
   */
  async multi<T>(
    operations: Record<
      string,
      {
        operation: keyof CacheOperation;
        params?: CacheOperation[keyof CacheOperation];
      }[]
    >,
  ): Promise<Record<string, (T | null | boolean | number)[]>> {
    const entries = Object.entries(operations);
    const results: Record<string, (T | null | boolean | number)[]> = {};

    for (const [key, keyOperations] of entries) {
      results[key] = [];
      const pipeline = this.valkey.pipeline();

      for (const { operation, params } of keyOperations) {
        switch (operation) {
          case 'set': {
            const { value, ttl } = (params as CacheOperation['set']) || {};
            ttl
              ? pipeline.set(key, JSON.stringify(value), 'EX', ttl)
              : pipeline.set(key, JSON.stringify(value));
            break;
          }
          case 'del': {
            pipeline.del(key);
            break;
          }
          case 'incr': {
            pipeline.incr(key);
            const { ttl } = params as CacheOperation['incr'];
            if (ttl) {
              pipeline.expire(key, ttl);
            }
            break;
          }
          case 'zadd': {
            const { score, member } = params as CacheOperation['zadd'];
            pipeline.zadd(key, score, member);
            break;
          }
          case 'zremrangebyscore': {
            const { min, max } = params as CacheOperation['zremrangebyscore'];
            pipeline.zremrangebyscore(key, min, max);
            break;
          }
        }
      }

      try {
        const operationResults = await pipeline.exec();
        if (!operationResults?.length) {
          continue;
        }

        let resultIndex = 0;
        for (const { operation, params } of keyOperations) {
          const [err, value] = operationResults[resultIndex];
          if (err) {
            this.logger.error(`Pipeline operation failed for key ${key}`, err);
            results[key].push(null);
            resultIndex++;
            continue;
          }

          let processedValue: T | null | boolean | number;
          switch (operation) {
            case 'set':
              processedValue = value === 'OK';
              break;
            case 'del':
              processedValue = typeof value === 'number' && value > 0;
              break;
            case 'incr':
              processedValue = typeof value === 'number' ? value : null;
              if ((params as CacheOperation['incr'])?.ttl) {
                resultIndex++;
              }
              break;
            case 'zadd':
              processedValue = typeof value === 'number' && value > 0;
              break;
            case 'zremrangebyscore':
              processedValue = typeof value === 'number' && value > 0;
              break;
            default:
              processedValue = null;
          }

          results[key].push(processedValue);
          resultIndex++;
        }
      } catch (error) {
        this.logger.error(`Failed to execute pipeline for key ${key}`, error);
        results[key] = keyOperations.map(() => null);
      }
    }

    return results;
  }
}
