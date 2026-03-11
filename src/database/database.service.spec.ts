import { Test, TestingModule } from '@nestjs/testing';
import { MikroORM } from '@mikro-orm/postgresql';
import { DatabaseService } from './database.service';
import { ConfigurationService } from '../config/configuration.service';

describe('DatabaseService', () => {
  let service: DatabaseService;
  let orm: MikroORM;
  let configService: ConfigurationService;

  const mockORM = {
    em: {
      getConnection: jest.fn().mockReturnValue({
        execute: jest.fn(),
        pool: {
          size: 10,
          activeCount: 2,
          idleCount: 8,
          waitingCount: 0,
          totalCount: 10,
        },
      }),
      begin: jest.fn(),
      transactional: jest.fn(),
      clear: jest.fn(),
      flush: jest.fn(),
    },
    getMigrator: jest.fn().mockReturnValue({
      up: jest.fn(),
      down: jest.fn(),
      getPendingMigrations: jest.fn().mockResolvedValue([]),
      getExecutedMigrations: jest.fn().mockResolvedValue([]),
    }),
    getSchemaGenerator: jest.fn().mockReturnValue({
      createSchema: jest.fn(),
      updateSchema: jest.fn(),
      dropSchema: jest.fn(),
      refreshDatabase: jest.fn(),
    }),
    close: jest.fn(),
  };

  const mockConfigService = {
    isProduction: jest.fn().mockReturnValue(false),
    database: {
      database: 'test_db',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: MikroORM,
          useValue: mockORM,
        },
        {
          provide: ConfigurationService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    orm = module.get<MikroORM>(MikroORM);
    configService = module.get<ConfigurationService>(ConfigurationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getEntityManager', () => {
    it('should return entity manager', () => {
      const em = service.getEntityManager();
      expect(em).toBe(mockORM.em);
    });
  });

  describe('getORM', () => {
    it('should return ORM instance', () => {
      const ormInstance = service.getORM();
      expect(ormInstance).toBe(mockORM);
    });
  });

  describe('isConnected', () => {
    it('should return true when connection is successful', async () => {
      mockORM.em.getConnection().execute.mockResolvedValue([]);

      const result = await service.isConnected();

      expect(result).toBe(true);
      expect(mockORM.em.getConnection().execute).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return false when connection fails', async () => {
      mockORM.em.getConnection().execute.mockRejectedValue(new Error('Connection failed'));

      const result = await service.isConnected();

      expect(result).toBe(false);
    });
  });

  describe('getDatabaseInfo', () => {
    it('should return database info when connected', async () => {
      mockORM.em
        .getConnection()
        .execute.mockResolvedValueOnce([]) // for isConnected
        .mockResolvedValueOnce([{ version: 'PostgreSQL 13.0' }]); // for version query

      const result = await service.getDatabaseInfo();

      expect(result).toEqual({
        connected: true,
        database: 'test_db',
        version: 'PostgreSQL 13.0',
        poolSize: 10,
      });
    });

    it('should return basic info when connection fails', async () => {
      mockORM.em.getConnection().execute.mockRejectedValue(new Error('Connection failed'));

      const result = await service.getDatabaseInfo();

      expect(result).toEqual({
        connected: false,
        database: 'test_db',
      });
    });
  });

  describe('runMigrations', () => {
    it('should run migrations', async () => {
      await service.runMigrations();

      expect(mockORM.getMigrator().up).toHaveBeenCalled();
    });
  });

  describe('rollbackMigrations', () => {
    it('should rollback migrations with default count', async () => {
      await service.rollbackMigrations();

      expect(mockORM.getMigrator().down).toHaveBeenCalledWith(1);
    });

    it('should rollback migrations with custom count', async () => {
      await service.rollbackMigrations(3);

      expect(mockORM.getMigrator().down).toHaveBeenCalledWith(3);
    });
  });

  describe('getMigrationStatus', () => {
    it('should return migration status', async () => {
      const pendingMigrations = [{ name: 'Migration001' }];
      const executedMigrations = [{ name: 'Migration000' }];

      mockORM.getMigrator().getPendingMigrations.mockResolvedValue(pendingMigrations);
      mockORM.getMigrator().getExecutedMigrations.mockResolvedValue(executedMigrations);

      const result = await service.getMigrationStatus();

      expect(result).toEqual({
        pending: ['Migration001'],
        executed: ['Migration000'],
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is connected', async () => {
      mockORM.em.getConnection().execute.mockResolvedValue([]);

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.message).toBe('Database is connected and healthy');
      expect(result.details).toBeDefined();
    });

    it('should return unhealthy status when database is not connected', async () => {
      mockORM.em.getConnection().execute.mockRejectedValue(new Error('Connection failed'));

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Database connection failed');
    });

    it('should handle health check errors', async () => {
      // Mock getDatabaseInfo to throw an error
      jest.spyOn(service, 'getDatabaseInfo').mockRejectedValue(new Error('Health check failed'));

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toContain('Database health check failed');
    });
  });

  describe('transaction', () => {
    it('should execute callback in transaction', async () => {
      const callback = jest.fn().mockResolvedValue('result');
      mockORM.em.transactional.mockImplementation((cb) => cb(mockORM.em));

      const result = await service.transaction(callback);

      expect(mockORM.em.transactional).toHaveBeenCalledWith(callback);
      expect(callback).toHaveBeenCalledWith(mockORM.em);
      expect(result).toBe('result');
    });
  });

  describe('getStatistics', () => {
    it('should return connection pool statistics', async () => {
      const result = await service.getStatistics();

      expect(result).toEqual({
        totalConnections: 10,
        activeConnections: 2,
        idleConnections: 8,
        waitingConnections: 0,
      });
    });

    it('should return empty object when pool info is not available', async () => {
      mockORM.em.getConnection.mockReturnValue({
        execute: jest.fn(),
        // No pool property
      });

      const result = await service.getStatistics();

      expect(result).toEqual({});
    });
  });

  describe('onModuleInit', () => {
    it('should run migrations in production', async () => {
      mockConfigService.isProduction.mockReturnValue(true);
      jest.spyOn(service, 'runMigrations').mockResolvedValue();

      await service.onModuleInit();

      expect(service.runMigrations).toHaveBeenCalled();
    });

    it('should not run migrations in development', async () => {
      mockConfigService.isProduction.mockReturnValue(false);
      jest.spyOn(service, 'runMigrations').mockResolvedValue();

      await service.onModuleInit();

      expect(service.runMigrations).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should close ORM connection', async () => {
      await service.onModuleDestroy();

      expect(mockORM.close).toHaveBeenCalled();
    });
  });
});
