import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckResult,
  HealthIndicatorFunction,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ConfigurationService } from '../config/configuration.service';
import { DatabaseHealthIndicator } from '../database/database-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

@ApiTags('Health')
@Controller({ path: 'healthz', version: '1' })
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private configService: ConfigurationService,
    private databaseHealthIndicator: DatabaseHealthIndicator,
    private redisHealthIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get overall health status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Health check successful' })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'Health check failed' })
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    const healthConfig = this.configService.health;
    const checks: HealthIndicatorFunction[] = [];

    // Always check basic application health
    checks.push(() =>
      Promise.resolve({
        app: { status: 'up' },
      }),
    );

    // Database health check
    if (healthConfig.databaseEnabled) {
      checks.push(() => this.databaseHealthIndicator.isHealthy('database'));
    }

    // Redis health check
    if (healthConfig.redisEnabled) {
      checks.push(() => this.redisHealthIndicator.isHealthy('redis'));
    }

    return this.health.check(checks);
  }

  @Get('database')
  @ApiOperation({ summary: 'Get database health status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Database is healthy' })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'Database is unhealthy' })
  @HealthCheck()
  checkDatabase(): Promise<HealthCheckResult> {
    return this.health.check([() => this.databaseHealthIndicator.isHealthy('database')]);
  }

  @Get('redis')
  @ApiOperation({ summary: 'Get Redis health status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Redis is healthy' })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'Redis is unhealthy' })
  @HealthCheck()
  checkRedis(): Promise<HealthCheckResult> {
    return this.health.check([() => this.redisHealthIndicator.isHealthy('redis')]);
  }

  @Get('ping')
  @ApiOperation({ summary: 'Simple ping endpoint' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pong response' })
  ping(): { message: string; timestamp: string } {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}
