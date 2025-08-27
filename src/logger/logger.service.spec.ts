import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationService } from '../config/configuration.service';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from './logger.service';
import * as winston from 'winston';

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    on: jest.fn(),
    end: jest.fn(),
  }),
  format: {
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    printf: jest.fn(),
    combine: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

describe('LoggerService', () => {
  let service: LoggerService;
  let configService: ConfigurationService;
  let clsService: ClsService;
  let mockWinstonLogger: any;

  const mockConfigService = {
    log: {
      level: 'info',
      format: 'json',
    },
    app: {
      name: 'test-app',
      environment: 'test',
      isProduction: false,
    },
    isDevelopment: jest.fn().mockReturnValue(true),
  };

  const mockClsService = {
    getId: jest.fn(),
  };

  beforeEach(async () => {
    mockWinstonLogger = {
      log: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
      on: jest.fn(),
      end: jest.fn(),
    };

    (winston.createLogger as jest.Mock).mockReturnValue(mockWinstonLogger);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: ConfigurationService,
          useValue: mockConfigService,
        },
        {
          provide: ClsService,
          useValue: mockClsService,
        },
      ],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
    configService = module.get<ConfigurationService>(ConfigurationService);
    clsService = module.get<ClsService>(ClsService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setContext', () => {
    it('should set context', () => {
      service.setContext('TestContext');
      expect(service['context']).toBe('TestContext');
    });
  });

  describe('log', () => {
    it('should log info message with context', () => {
      mockClsService.getId.mockReturnValue('correlation-123');

      service.log('Test message', 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Test message', {
        correlationId: 'correlation-123',
        context: 'TestContext',
      });
    });

    it('should log info message with metadata', () => {
      const meta = { userId: '123', action: 'test' };

      service.log('Test message', meta, 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Test message', {
        userId: '123',
        action: 'test',
        context: 'TestContext',
      });
    });

    it('should handle CLS errors gracefully', () => {
      mockClsService.getId.mockImplementation(() => {
        throw new Error('CLS not available');
      });

      service.log('Test message');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Test message', {});
    });
  });

  describe('error', () => {
    it('should log error with Error object', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      service.error('Error occurred', error, 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('error', 'Error occurred', {
        error: {
          name: 'Error',
          message: 'Test error',
          stack: 'Error stack trace',
        },
        context: 'TestContext',
      });
    });

    it('should log error with trace string', () => {
      service.error('Error occurred', 'Stack trace', 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('error', 'Error occurred', {
        trace: 'Stack trace',
        context: 'TestContext',
      });
    });

    it('should log error with metadata object', () => {
      const meta = { userId: '123', operation: 'test' };

      service.error('Error occurred', meta, 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('error', 'Error occurred', {
        userId: '123',
        operation: 'test',
        context: 'TestContext',
      });
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      service.warn('Warning message', 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Warning message', {
        context: 'TestContext',
      });
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      service.debug('Debug message', 'TestContext');

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('debug', 'Debug message', {
        context: 'TestContext',
      });
    });
  });

  describe('logRequest', () => {
    it('should log HTTP request', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1',
        user: { id: 'user-123' },
      };

      const res = {
        statusCode: 200,
      };

      service.logRequest(req, res, 150);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'GET /api/test 200 - 150ms', {
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        responseTime: 150,
        userAgent: 'test-agent',
        ip: '127.0.0.1',
        userId: 'user-123',
      });
    });

    it('should log error status as warning', () => {
      const req = {
        method: 'POST',
        url: '/api/test',
        headers: {},
      };

      const res = {
        statusCode: 400,
      };

      service.logRequest(req, res, 100);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith(
        'warn',
        'POST /api/test 400 - 100ms',
        expect.any(Object),
      );
    });
  });

  describe('logQuery', () => {
    it('should log database query in development', () => {
      mockConfigService.isDevelopment.mockReturnValue(true);

      service.logQuery('SELECT * FROM users', ['param1'], 50);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('debug', 'Database Query', {
        query: 'SELECT * FROM users',
        params: ['param1'],
        duration: '50ms',
      });
    });

    it('should not log query in production', () => {
      mockConfigService.isDevelopment.mockReturnValue(false);

      service.logQuery('SELECT * FROM users');

      expect(mockWinstonLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('logPerformance', () => {
    it('should log performance metrics', () => {
      service.logPerformance('Database Query', 1500, { table: 'users' });

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Performance: Database Query', {
        operation: 'Database Query',
        duration: '1500ms',
        table: 'users',
      });
    });
  });

  describe('logSecurity', () => {
    it('should log security events', () => {
      const meta = { userId: '123', ip: '127.0.0.1' };

      service.logSecurity('Failed login attempt', meta);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('warn', 'Security: Failed login attempt', {
        event: 'Failed login attempt',
        userId: '123',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
      });
    });
  });

  describe('logBusiness', () => {
    it('should log business events', () => {
      const meta = { userId: '123', amount: 100 };

      service.logBusiness('Order created', meta);

      expect(mockWinstonLogger.log).toHaveBeenCalledWith('info', 'Business: Order created', {
        event: 'Order created',
        userId: '123',
        amount: 100,
        timestamp: expect.any(String),
      });
    });
  });

  describe('child', () => {
    it('should create child logger with additional context', () => {
      const additionalContext = { userId: '123', sessionId: 'session-456' };

      const childLogger = service.child(additionalContext);

      expect(childLogger).toBeInstanceOf(LoggerService);
      expect(childLogger['context']).toBe(service['context']);
    });
  });

  describe('flush', () => {
    it('should flush winston logger', async () => {
      const flushPromise = service.flush();

      // Simulate winston finish event
      const finishCallback = mockWinstonLogger.on.mock.calls.find(
        (call) => call[0] === 'finish',
      )[1];
      finishCallback();

      await expect(flushPromise).resolves.toBeUndefined();
      expect(mockWinstonLogger.end).toHaveBeenCalled();
    });
  });
});
