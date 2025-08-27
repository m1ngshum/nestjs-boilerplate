import { Injectable, LoggerService as NestLoggerService, Scope, HttpStatus } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import * as winston from 'winston';
import { ClsService } from 'nestjs-cls';

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  [key: string]: any;
}

@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService implements NestLoggerService {
  private readonly winston: winston.Logger;
  private context?: string;

  constructor(
    private readonly configService: ConfigurationService,
    private readonly cls: ClsService,
  ) {
    this.winston = this.createWinstonLogger();
  }

  /**
   * Set the context for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Create Winston logger instance
   */
  private createWinstonLogger(): winston.Logger {
    const logConfig = this.configService.log;
    const appConfig = this.configService.app;

    const formats: winston.Logform.Format[] = [
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
    ];

    // Add JSON formatting for production, pretty print for development
    if (logConfig.format === 'json' || appConfig.isProduction) {
      formats.push(
        winston.format.json(),
      );
    } else {
      formats.push(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
          const ctx = context ? `[${context}] ` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${ctx}${message}${metaStr}`;
        }),
      );
    }

    return winston.createLogger({
      level: logConfig.level,
      format: winston.format.combine(...formats),
      defaultMeta: {
        service: appConfig.name,
        environment: appConfig.environment,
      },
      transports: [
        new winston.transports.Console({
          handleExceptions: true,
          handleRejections: true,
        }),
        // Add file transport for production
        ...(appConfig.isProduction ? [
          new winston.transports.File({
            filename: './logs/error.log',
            level: 'error',
            handleExceptions: true,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: './logs/combined.log',
            handleExceptions: true,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
        ] : []),
      ],
      exitOnError: false,
    });
  }

  /**
   * Get enhanced context with correlation ID and other metadata
   */
  private getEnhancedContext(): LogContext {
    const context: LogContext = {};

    // Get correlation ID from CLS
    try {
      const correlationId = this.cls.getId();
      if (correlationId) {
        context.correlationId = correlationId;
      }
    } catch (error) {
      // CLS might not be available in all contexts
    }

    // Add context name if set
    if (this.context) {
      context.context = this.context;
    }

    return context;
  }

  /**
   * Enhanced logging method
   */
  private logWithContext(
    level: string,
    message: string,
    meta: any = {},
    context?: string,
  ): void {
    const enhancedContext = this.getEnhancedContext();
    
    this.winston.log(level, message, {
      ...enhancedContext,
      ...meta,
      ...(context && { context }),
    });
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
   * Log a verbose message
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
    const childLogger = new LoggerService(this.configService, this.cls);
    childLogger.context = this.context;
    
    // Override the getEnhancedContext method to include additional context
    const originalGetEnhancedContext = childLogger.getEnhancedContext.bind(childLogger);
    childLogger.getEnhancedContext = () => ({
      ...originalGetEnhancedContext(),
      ...additionalContext,
    });

    return childLogger;
  }

  /**
   * Flush logs (useful for testing)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.winston.on('finish', resolve);
      this.winston.end();
    });
  }
}