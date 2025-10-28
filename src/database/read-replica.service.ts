import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * Service for read replica health checks and monitoring
 *
 * Note: You don't need this service for using read replicas.
 * MikroORM automatically routes queries to read replicas outside of transactions.
 * This service is only for monitoring replica health.
 */
@Injectable()
export class ReadReplicaService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Check if read replicas are configured
   */
  hasReadReplicas(): boolean {
    return this.databaseService.hasReadReplicas();
  }

  /**
   * Get count of configured read replicas
   */
  getReplicaCount(): number {
    return this.databaseService.getReadReplicaCount();
  }

  /**
   * Get read replica health status
   * Useful for health check endpoints or monitoring dashboards
   */
  async getReplicaHealth(): Promise<{
    available: boolean;
    count: number;
    status: 'healthy' | 'unhealthy' | 'not_configured';
  }> {
    const hasReplicas = this.hasReadReplicas();
    const count = this.getReplicaCount();

    if (!hasReplicas) {
      return {
        available: false,
        count: 0,
        status: 'not_configured',
      };
    }

    try {
      // Test connectivity to replicas
      const connection = this.databaseService.getReadConnection();
      await connection.execute('SELECT 1');

      return {
        available: true,
        count,
        status: 'healthy',
      };
    } catch (error) {
      return {
        available: false,
        count,
        status: 'unhealthy',
      };
    }
  }
}
