import { Injectable, Inject, Optional } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { ConfigurationService } from '../../config/configuration.service';
import { Cluster, Redis } from 'iovalkey';
import { CACHE_INSTANCE } from '../../cache/valkey/valkey';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private configService: ConfigurationService,
    @Optional() @Inject(CACHE_INSTANCE) private valkey?: Redis | Cluster,
  ) {}

  private getStatus(key: string, isHealthy: boolean, data?: any): HealthIndicatorResult {
    return {
      [key]: {
        status: isHealthy ? 'up' : 'down',
        ...data,
      },
    };
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const cacheConfig = this.configService.cache;
    
    if (cacheConfig.type !== 'redis' || !this.valkey) {
      return this.getStatus(key, true, { message: 'Redis cache is disabled' });
    }

    try {
      // Try to ping Valkey
      const response = await this.valkey.ping();
      const isHealthy = response === 'PONG';

      if (isHealthy) {
        return this.getStatus(key, true, {
          message: 'Valkey connection successful',
          response,
          type: 'valkey',
        });
      } else {
        return this.getStatus(key, false, {
          message: 'Valkey connection failed',
          error: `Valkey ping returned: ${response}`,
          type: 'valkey',
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      return this.getStatus(key, false, {
        message: 'Valkey connection failed',
        error: errorMessage,
        type: 'valkey',
      });
    }
  }
}