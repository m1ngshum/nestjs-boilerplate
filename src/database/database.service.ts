import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MikroORM, EntityManager, Connection } from '@mikro-orm/postgresql';
import { InjectMikroORM } from '@mikro-orm/nestjs';
import { ConfigurationService } from '../config/configuration.service';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  constructor(
    @InjectMikroORM('default') private readonly orm: MikroORM,
    private readonly configService: ConfigurationService,
  ) {}

  async onModuleInit() {
    // Run migrations in production
    if (this.configService.isProduction()) {
      await this.runMigrations();
    }
  }

  async onModuleDestroy() {
    await this.orm.close();
  }

  /**
   * Get EntityManager instance
   */
  getEntityManager(): EntityManager {
    return this.orm.em;
  }

  /**
   * Get ORM instance
   */
  getORM(): MikroORM {
    return this.orm;
  }

  /**
   * Get database connection
   */
  getConnection(): Connection {
    return this.orm.em.getConnection();
  }

  /**
   * Check database connection
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.orm.em.getConnection().execute('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get database info
   */
  async getDatabaseInfo(): Promise<{
    connected: boolean;
    database: string;
    version?: string;
    poolSize?: number;
  }> {
    try {
      const connection = this.getConnection();
      const config = this.configService.database;

      const connected = await this.isConnected();

      let version: string | undefined;
      let poolSize: number | undefined;

      if (connected) {
        try {
          const result = await connection.execute('SELECT version()');
          version = result[0]?.version;
        } catch (error) {
          // Version query might not work for all databases
        }

        try {
          poolSize = (connection as any).pool?.size;
        } catch (error) {
          // Pool info might not be available
        }
      }

      return {
        connected,
        database: config.database,
        version,
        poolSize,
      };
    } catch (error) {
      return {
        connected: false,
        database: this.configService.database.database,
      };
    }
  }

  /**
   * Run pending migrations
   */
  async runMigrations(): Promise<void> {
    const migrator = this.orm.getMigrator();
    await migrator.up();
  }

  /**
   * Rollback migrations
   */
  async rollbackMigrations(count: number = 1): Promise<void> {
    const migrator = this.orm.getMigrator();
    await migrator.down(count.toString());
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    pending: string[];
    executed: string[];
  }> {
    const migrator = this.orm.getMigrator();
    const pending = await migrator.getPendingMigrations();
    const executed = await migrator.getExecutedMigrations();

    return {
      pending: pending.map((m) => m.name),
      executed: executed.map((m) => m.name),
    };
  }

  /**
   * Create database schema
   */
  async createSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.createSchema();
  }

  /**
   * Update database schema
   */
  async updateSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.updateSchema();
  }

  /**
   * Drop database schema
   */
  async dropSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.dropSchema();
  }

  /**
   * Refresh database schema (drop and create)
   */
  async refreshSchema(): Promise<void> {
    const generator = this.orm.getSchemaGenerator();
    await generator.refreshDatabase();
  }

  /**
   * Execute raw SQL query
   */
  async executeRaw(sql: string, params?: any[]): Promise<any> {
    return this.orm.em.getConnection().execute(sql, params);
  }

  /**
   * Begin transaction
   */
  async beginTransaction(): Promise<EntityManager> {
    return this.orm.em.fork();
  }

  /**
   * Execute within transaction
   */
  async transaction<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.orm.em.transactional(callback);
  }

  /**
   * Clear entity manager cache
   */
  clearCache(): void {
    this.orm.em.clear();
  }

  /**
   * Flush changes to database
   */
  async flush(): Promise<void> {
    await this.orm.em.flush();
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalConnections?: number;
    activeConnections?: number;
    idleConnections?: number;
    waitingConnections?: number;
  }> {
    try {
      const connection = this.getConnection();
      const pool = (connection as any).pool;

      if (pool) {
        return {
          totalConnections: pool.totalCount,
          activeConnections: pool.activeCount,
          idleConnections: pool.idleCount,
          waitingConnections: pool.waitingCount,
        };
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Health check for database
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    details?: any;
  }> {
    try {
      const info = await this.getDatabaseInfo();

      if (!info.connected) {
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
          details: info,
        };
      }

      const stats = await this.getStatistics();

      return {
        status: 'healthy',
        message: 'Database is connected and healthy',
        details: {
          ...info,
          ...stats,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${(error as Error).message}`,
      };
    }
  }
}
