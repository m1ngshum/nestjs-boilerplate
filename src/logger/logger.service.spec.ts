import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationService } from '../config/configuration.service';
import { ClsService } from 'nestjs-cls';
import { LoggerService } from './logger.service';

// Mock pino — must use `var` to avoid TDZ with jest.mock hoisting

var mockPinoLogger: Record<string, jest.Mock>;

jest.mock('pino', () => {
  mockPinoLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn(),
    flush: jest.fn(),
  };

  const factory = jest.fn().mockReturnValue(mockPinoLogger);
  (factory as any).stdTimeFunctions = { isoTime: jest.fn() };
  (factory as any).transport = jest.fn();
  return { __esModule: true, default: factory };
});

describe('LoggerService', () => {
  let service: LoggerService;

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
    get: jest.fn(),
  };

  beforeEach(async () => {
    // Reset the mock logger methods
    Object.values(mockPinoLogger).forEach((fn) => (fn as jest.Mock).mockReset());
    mockPinoLogger.child.mockReturnValue(mockPinoLogger);

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

    service = await module.resolve<LoggerService>(LoggerService);

    // Reset mocks after service construction so we only capture test calls
    jest.clearAllMocks();
    mockPinoLogger.child.mockReturnValue(mockPinoLogger);
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

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        {
          correlationId: 'correlation-123',
          requestId: 'correlation-123',
          context: 'TestContext',
        },
        'Test message',
      );
    });

    it('should log info message with metadata', () => {
      const meta = { userId: '123', action: 'test' };

      service.log('Test message', meta, 'TestContext');

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '123',
          action: 'test',
          context: 'TestContext',
        }),
        'Test message',
      );
    });

    it('should handle CLS errors gracefully', () => {
      mockClsService.getId.mockImplementation(() => {
        throw new Error('CLS not available');
      });
      mockClsService.get.mockImplementation(() => {
        throw new Error('CLS not available');
      });

      service.log('Test message');

      expect(mockPinoLogger.info).toHaveBeenCalledWith({}, 'Test message');
    });
  });

  describe('error', () => {
    it('should log error with Error object', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      service.error('Error occurred', error, 'TestContext');

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          error: {
            name: 'Error',
            message: 'Test error',
            stack: 'Error stack trace',
          },
          context: 'TestContext',
        },
        'Error occurred',
      );
    });

    it('should log error with trace string', () => {
      service.error('Error occurred', 'Stack trace', 'TestContext');

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          trace: 'Stack trace',
          context: 'TestContext',
        },
        'Error occurred',
      );
    });

    it('should log error with metadata object', () => {
      const meta = { userId: '123', operation: 'test' };

      service.error('Error occurred', meta, 'TestContext');

      expect(mockPinoLogger.error).toHaveBeenCalledWith(
        {
          userId: '123',
          operation: 'test',
          context: 'TestContext',
        },
        'Error occurred',
      );
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      service.warn('Warning message', 'TestContext');

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        {
          context: 'TestContext',
        },
        'Warning message',
      );
    });
  });

  describe('debug', () => {
    it('should log debug message', () => {
      service.debug('Debug message', 'TestContext');

      expect(mockPinoLogger.debug).toHaveBeenCalledWith(
        {
          context: 'TestContext',
        },
        'Debug message',
      );
    });
  });

  describe('verbose', () => {
    it('should map verbose to pino trace level', () => {
      service.verbose('Verbose message', 'TestContext');

      expect(mockPinoLogger.trace).toHaveBeenCalledWith(
        {
          context: 'TestContext',
        },
        'Verbose message',
      );
    });
  });

  describe('logRequest', () => {
    it('should log HTTP request', () => {
      const req = {
        method: 'GET',
        url: '/api/test',
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1',
      };

      const res = {
        statusCode: 200,
      };

      service.logRequest(req, res, 150);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/test',
          statusCode: 200,
          responseTime: 150,
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }),
        'GET /api/test 200 - 150ms',
      );
    });

    it('should log error status as warning', () => {
      const req = {
        method: 'POST',
        url: '/api/test',
        headers: {},
        connection: { remoteAddress: '127.0.0.1' },
      };

      const res = {
        statusCode: 400,
      };

      service.logRequest(req, res, 100);

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        'POST /api/test 400 - 100ms',
      );
    });
  });

  describe('logQuery', () => {
    it('should log database query in development', () => {
      mockConfigService.isDevelopment.mockReturnValue(true);

      service.logQuery('SELECT * FROM users', ['param1'], 50);

      expect(mockPinoLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'SELECT * FROM users',
          params: ['param1'],
          duration: '50ms',
        }),
        'Database Query',
      );
    });

    it('should not log query in production', () => {
      mockConfigService.isDevelopment.mockReturnValue(false);

      service.logQuery('SELECT * FROM users');

      expect(mockPinoLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('logPerformance', () => {
    it('should log performance metrics', () => {
      service.logPerformance('Database Query', 1500, { table: 'users' });

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'Database Query',
          duration: '1500ms',
          table: 'users',
        }),
        'Performance: Database Query',
      );
    });
  });

  describe('logSecurity', () => {
    it('should log security events', () => {
      const meta = { userId: '123', ip: '127.0.0.1' };

      service.logSecurity('Failed login attempt', meta);

      expect(mockPinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'Failed login attempt',
          userId: '123',
          ip: '127.0.0.1',
          timestamp: expect.any(String),
        }),
        'Security: Failed login attempt',
      );
    });
  });

  describe('logBusiness', () => {
    it('should log business events', () => {
      const meta = { userId: '123', amount: 100 };

      service.logBusiness('Order created', meta);

      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'Order created',
          userId: '123',
          amount: 100,
          timestamp: expect.any(String),
        }),
        'Business: Order created',
      );
    });
  });

  describe('child', () => {
    it('should create child logger with additional context', () => {
      const additionalContext = { userId: '123', sessionId: 'session-456' };

      const childLogger = service.child(additionalContext);

      expect(mockPinoLogger.child).toHaveBeenCalledWith(additionalContext);
      expect(childLogger).toBeInstanceOf(LoggerService);
    });

    it('should preserve parent context in child logger', () => {
      service.setContext('ParentContext');
      const childLogger = service.child({ userId: '123' });

      expect(childLogger['context']).toBe('ParentContext');
    });
  });

  describe('flush', () => {
    it('should flush pino logger', async () => {
      // Mock flush to invoke the callback immediately
      mockPinoLogger.flush.mockImplementation((cb: (err?: Error) => void) => cb());

      await service.flush();

      expect(mockPinoLogger.flush).toHaveBeenCalled();
    });
  });
});
