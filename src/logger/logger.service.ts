import {
  Injectable,
  LoggerService as NestLoggerService,
  Scope,
  HttpStatus,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import pino from 'pino';
import { ClsService } from 'nestjs-cls';

export interface LogContext {
  // Distributed tracing
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  requestId?: string;
  correlationId?: string;
  // Request info
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

/** Map Winston levels to Pino levels */
const LEVEL_MAP: Record<string, string> = {
  verbose: 'trace',
};

const VALID_PINO_LEVELS = new Set(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private readonly pinoLogger: pino.Logger;
  private context?: string;

  constructor(
    private readonly configService: ConfigurationService,
    private readonly cls: ClsService,
    @Optional() @Inject('PINO_INSTANCE') existingPino?: pino.Logger,
  ) {
    this.pinoLogger = existingPino ?? this.createPinoLogger();
  }

  /**
   * Set the context for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Create Pino logger instance
   */
  private createPinoLogger(): pino.Logger {
    const logConfig = this.configService.log;
    const appConfig = this.configService.app;

    const pinoLevel = LEVEL_MAP[logConfig.level] ?? logConfig.level;
    const useJsonFormat = logConfig.format === 'json' || appConfig.isProduction;

    const baseOptions: pino.LoggerOptions = {
      level: pinoLevel,
      base: {
        service: appConfig.name,
        environment: appConfig.environment,
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          '*.password',
          '*.token',
          '*.secret',
          '*.apiKey',
          '*.secretKey',
        ],
        censor: '[REDACTED]',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (appConfig.isProduction) {
      return pino(
        baseOptions,
        pino.transport({
          targets: [
            { target: 'pino/file', options: { destination: 1 } }, // stdout
            {
              target: 'pino-roll',
              options: { file: './logs/combined.log', size: '5m', limit: { count: 5 } },
            },
            {
              target: 'pino-roll',
              level: 'error',
              options: { file: './logs/error.log', size: '5m', limit: { count: 5 } },
            },
          ],
        }),
      );
    }

    if (!useJsonFormat) {
      return pino(
        baseOptions,
        pino.transport({
          target: 'pino-pretty',
          options: { colorize: true, translateTime: true, ignore: 'pid,hostname' },
        }),
      );
    }

    return pino(baseOptions);
  }

  /**
   * Get enhanced context with trace IDs and other metadata
   */
  private getEnhancedContext(): LogContext {
    const context: LogContext = {};

    // Get trace context from CLS
    try {
      const traceId = this.cls.get('traceId');
      const spanId = this.cls.get('spanId');
      const parentSpanId = this.cls.get('parentSpanId');
      const requestId = this.cls.get('requestId') || this.cls.getId();

      if (traceId) {
        context.traceId = traceId;
      }
      if (spanId) {
        context.spanId = spanId;
      }
      if (parentSpanId) {
        context.parentSpanId = parentSpanId;
      }
      if (requestId) {
        context.requestId = requestId;
        context.correlationId = requestId; // Keep correlationId for backward compatibility
      }
    } catch {
      // CLS might not be available in all contexts
    }

    // Add context name if set
    if (this.context) {
      context.context = this.context;
    }

    return context;
  }

  /**
   * Enhanced logging method — Pino uses (object, message) argument order
   */
  private logWithContext(level: string, message: string, meta: any = {}, context?: string): void {
    const pinoLevel = LEVEL_MAP[level] ?? level;
    const enhancedContext = this.getEnhancedContext();

    const mergedMeta = {
      ...enhancedContext,
      ...meta,
      ...(context && { context }),
    };

    if (!VALID_PINO_LEVELS.has(pinoLevel)) {
      this.pinoLogger.warn(
        { requestedLevel: pinoLevel },
        `Unknown log level "${pinoLevel}", falling back to info`,
      );
      this.pinoLogger.info(mergedMeta, message);
      return;
    }

    this.pinoLogger[pinoLevel as pino.Level](mergedMeta, message);
  }

  /**
   * Log a message
   */
  log(message: string, context?: string): void;
  log(message: string, meta?: any, context?: string): void;
  log(message: string, metaOrContext?: any, context?: string): void {
    if (typeof metaOrContext === 'string' && !context) {
      this.logWithContext('info', message, {}, metaOrContext);
    } else {
      this.logWithContext('info', message, metaOrContext, context);
    }
  }

  /**
   * Log an error message
   */
  error(message: string, trace?: string, context?: string): void;
  error(message: string, error?: Error, context?: string): void;
  error(message: string, meta?: any, context?: string): void;
  error(message: string, traceOrError?: string | Error | any, context?: string): void {
    let meta: any = {};

    if (traceOrError instanceof Error) {
      meta = {
        error: {
          name: traceOrError.name,
          message: traceOrError.message,
          stack: traceOrError.stack,
        },
      };
    } else if (typeof traceOrError === 'string') {
      meta = { trace: traceOrError };
    } else if (traceOrError && typeof traceOrError === 'object') {
      meta = traceOrError;
    }

    this.logWithContext('error', message, meta, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: string): void;
  warn(message: string, meta?: any, context?: string): void;
  warn(message: string, metaOrContext?: any, context?: string): void {
    if (typeof metaOrContext === 'string' && !context) {
      this.logWithContext('warn', message, {}, metaOrContext);
    } else {
      this.logWithContext('warn', message, metaOrContext, context);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: string): void;
  debug(message: string, meta?: any, context?: string): void;
  debug(message: string, metaOrContext?: any, context?: string): void {
    if (typeof metaOrContext === 'string' && !context) {
      this.logWithContext('debug', message, {}, metaOrContext);
    } else {
      this.logWithContext('debug', message, metaOrContext, context);
    }
  }

  /**
   * Log a verbose message (maps to Pino's trace level)
   */
  verbose(message: string, context?: string): void;
  verbose(message: string, meta?: any, context?: string): void;
  verbose(message: string, metaOrContext?: any, context?: string): void {
    if (typeof metaOrContext === 'string' && !context) {
      this.logWithContext('verbose', message, {}, metaOrContext);
    } else {
      this.logWithContext('verbose', message, metaOrContext, context);
    }
  }

  /**
   * Log HTTP request
   */
  logRequest(req: any, res: any, responseTime: number): void {
    const context: LogContext = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress,
    };

    const level = res.statusCode >= HttpStatus.BAD_REQUEST ? 'warn' : 'info';
    const message = `${req.method} ${req.url} ${res.statusCode} - ${responseTime}ms`;

    this.logWithContext(level, message, context);
  }

  /**
   * Log database query
   */
  logQuery(query: string, params?: any[], duration?: number): void {
    if (this.configService.isDevelopment()) {
      this.logWithContext('debug', 'Database Query', {
        query,
        params,
        duration: duration ? `${duration}ms` : undefined,
      });
    }
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation: string, duration: number, meta?: any): void {
    this.logWithContext('info', `Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...meta,
    });
  }

  /**
   * Log security events
   */
  logSecurity(event: string, meta?: any): void {
    this.logWithContext('warn', `Security: ${event}`, {
      event,
      ...meta,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log business events
   */
  logBusiness(event: string, meta?: any): void {
    this.logWithContext('info', `Business: ${event}`, {
      event,
      ...meta,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create child logger with additional context
   */
  child(additionalContext: Record<string, any>): LoggerService {
    const childPino = this.pinoLogger.child(additionalContext);
    const childLogger = new LoggerService(this.configService, this.cls, childPino);
    childLogger.context = this.context;
    return childLogger;
  }

  /**
   * Flush logs (wraps Pino's callback-based flush for async/await)
   */
  async flush(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.pinoLogger.flush((err) => (err ? reject(err) : resolve()));
    });
  }
}
