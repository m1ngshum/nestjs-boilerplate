import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { DatabaseService } from './database.service';

@Injectable()
export class DatabaseHealthIndicator {
  constructor(private readonly databaseService: DatabaseService) {}

  private getStatus(key: string, isHealthy: boolean, data?: any): HealthIndicatorResult {
    return {
      [key]: {
        status: isHealthy ? 'up' : 'down',
        ...data,
      },
    };
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const healthCheck = await this.databaseService.healthCheck();
      
      if (healthCheck.status === 'healthy') {
        return this.getStatus(key, true, healthCheck.details);
      } else {
        return this.getStatus(key, false, {
          message: healthCheck.message,
          ...healthCheck.details,
        });
      }
    } catch (error) {
      return this.getStatus(key, false, {
        error: (error as Error).message,
      });
    }
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const isConnected = await this.databaseService.isConnected();
      
      if (isConnected) {
        return this.getStatus(key, true, { message: 'Database connection successful' });
      } else {
        return this.getStatus(key, false, { message: 'Database connection failed' });
      }
    } catch (error) {
      return this.getStatus(key, false, { error: (error as Error).message });
    }
  }

  async migrationCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const migrationStatus = await this.databaseService.getMigrationStatus();
      
      const hasPendingMigrations = migrationStatus.pending.length > 0;
      
      return this.getStatus(key, !hasPendingMigrations, {
        executed: migrationStatus.executed.length,
        pending: migrationStatus.pending.length,
        pendingMigrations: migrationStatus.pending,
      });
    } catch (error) {
      return this.getStatus(key, false, { error: (error as Error).message });
    }
  }

  async connectionPoolCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const stats = await this.databaseService.getStatistics();
      
      // Consider healthy if no connection info available (not critical)
      if (!stats.totalConnections) {
        return this.getStatus(key, true, { message: 'Connection pool info not available' });
      }

      // Consider unhealthy if all connections are active (potential bottleneck)
      const isHealthy = stats.activeConnections! < stats.totalConnections!;
      
      return this.getStatus(key, isHealthy, {
        totalConnections: stats.totalConnections,
        activeConnections: stats.activeConnections,
        idleConnections: stats.idleConnections,
        waitingConnections: stats.waitingConnections,
      });
    } catch (error) {
      return this.getStatus(key, false, { error: (error as Error).message });
    }
  }
}