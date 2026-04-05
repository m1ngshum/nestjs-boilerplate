import { Injectable } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: 'up' | 'down' | 'disabled';
    redis: 'up' | 'down' | 'disabled';
    cache: 'up' | 'down';
  };
}

@Injectable()
export class HealthService {
  constructor(private configService: ConfigurationService) {}

  /**
   * Get comprehensive health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const healthConfig = this.configService.health;
    const appConfig = this.configService.app;

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: appConfig.environment,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: healthConfig.databaseEnabled ? 'up' : 'disabled',
        redis: healthConfig.redisEnabled ? 'up' : 'disabled',
        cache: 'up',
      },
    };
  }

  /**
   * Check if application is ready to serve requests
   */
  async isReady(): Promise<boolean> {
    // Add readiness checks here (e.g., database connectivity, external service availability)
    return true;
  }

  /**
   * Check if application is alive
   */
  async isAlive(): Promise<boolean> {
    try {
      // Basic liveness check
      return process.uptime() > 0;
    } catch (_error) {
      return false;
    }
  }
}
