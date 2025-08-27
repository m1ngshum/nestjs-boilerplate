import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis, { Cluster } from 'iovalkey';
import { ThrottlerStorageRedis } from '../interfaces/throttler-storage.interface';

@Injectable()
export class ThrottlerStorageService
  implements ThrottlerStorageRedis, OnModuleDestroy
{
  scriptSrc: string;
  redis: Redis | Cluster;
  disconnectRequired?: boolean;
  private readonly isClusterMode: boolean;

  constructor(redisOrOptions: Redis | Cluster) {
    this.redis = redisOrOptions;
    this.isClusterMode = 'isCluster' in this.redis && this.redis.isCluster;
    this.scriptSrc = this.getScriptSrc();
  }

  getScriptSrc(): string {
    return `
      local hitKey = KEYS[1]
      local blockKey = KEYS[2]
      local throttlerName = ARGV[1]
      local ttl = tonumber(ARGV[2])
      local limit = tonumber(ARGV[3])
      local blockDuration = tonumber(ARGV[4])

      if not ttl or not limit or not blockDuration then
        return redis.error_reply("Invalid numeric arguments")
      end

      -- Ensure positive values
      if ttl < 0 or limit < 0 or blockDuration < 0 then
        return redis.error_reply("Arguments must be positive numbers")
      end

      ${
        this.isClusterMode
          ? `
      if redis.call('CLUSTER', 'KEYSLOT', hitKey) ~= redis.call('CLUSTER', 'KEYSLOT', blockKey) then
        return redis.error_reply("Keys must be in same slot")
      end
      `
          : ''
      }

      local totalHits = redis.call('INCR', hitKey)
      if not totalHits then return {0, 0, 0, 0} end

      local timeToExpire = redis.call('PTTL', hitKey)
      if timeToExpire < 0 then
        redis.call('PEXPIRE', hitKey, ttl)
        timeToExpire = ttl
      end

      local isBlocked = redis.call('GET', blockKey)
      local timeToBlockExpire = 0

      if isBlocked then
        timeToBlockExpire = redis.call('PTTL', blockKey)
      elseif totalHits > limit then
        redis.call('SET', blockKey, 1, 'PX', blockDuration)
        isBlocked = '1'
        timeToBlockExpire = blockDuration
      end

      if isBlocked and timeToBlockExpire <= 0 then
        redis.call('DEL', blockKey)
        redis.call('SET', hitKey, 1, 'PX', ttl)
        totalHits = 1
        timeToExpire = ttl
        isBlocked = false
      end

      return { 
        tonumber(totalHits) or 0,
        tonumber(timeToExpire) or 0,
        isBlocked and 1 or 0,
        tonumber(timeToBlockExpire) or 0
      }
    `
      .replace(/^\s+/gm, '')
      .trim();
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // Validate inputs
    if (!Number.isInteger(ttl) || ttl <= 0) {
      throw new TypeError('TTL must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new TypeError('Limit must be a positive integer');
    }
    if (!Number.isInteger(blockDuration) || blockDuration <= 0) {
      throw new TypeError('Block duration must be a positive integer');
    }

    const hashKey = `{${key}:${throttlerName}}`;
    const hitKey = `${this.redis.options.keyPrefix}${hashKey}:hits`;
    const blockKey = `${this.redis.options.keyPrefix}${hashKey}:blocked`;

    try {
      const results: number[] = (await this.redis.call(
        'EVAL',
        this.scriptSrc,
        2,
        hitKey,
        blockKey,
        throttlerName,
        ttl.toString(),
        limit.toString(),
        blockDuration.toString(),
      )) as number[];

      if (!Array.isArray(results)) {
        throw new TypeError(
          `Expected result to be array of values, got ${results}`,
        );
      }

      const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] =
        results.map((val) => (typeof val === 'number' ? Math.floor(val) : 0));

      return {
        totalHits,
        timeToExpire: Math.ceil(timeToExpire / 1000),
        isBlocked: isBlocked === 1,
        timeToBlockExpire: Math.ceil(timeToBlockExpire / 1000),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.message?.includes('CROSSSLOT')) {
        throw new Error('Redis cluster error: Keys must hash to the same slot');
      }

      throw error;
    }
  }

  onModuleDestroy() {
    if (this.disconnectRequired) {
      this.redis?.disconnect(false);
    }
  }
}