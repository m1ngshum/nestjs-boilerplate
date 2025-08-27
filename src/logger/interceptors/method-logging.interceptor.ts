import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../logger.service';
import { LOG_METADATA_KEY, LogOptions } from '../decorators/log.decorator';

@Injectable()
export class MethodLoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerService,
    private readonly reflector: Reflector,
  ) {
    this.logger.setContext('MethodLoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const logOptions = this.reflector.get<LogOptions>(
      LOG_METADATA_KEY,
      context.getHandler(),
    );

    if (!logOptions) {
      return next.handle();
    }

    const startTime = Date.now();
    const className = context.getClass().name;
    const methodName = context.getHandler().name;
    const contextName = logOptions.context || className;

    // Get method arguments if logging is enabled
    const args = logOptions.logArgs ? context.getArgs() : undefined;

    // Create method-specific logger
    const methodLogger = this.logger.child({
      className,
      methodName,
      context: contextName,
    });

    // Log method entry
    const entryMessage = logOptions.message || `${methodName} called`;
    methodLogger[logOptions.level || 'info'](entryMessage, {
      ...(args && { arguments: this.sanitizeArgs(args) }),
    });

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        
        // Log method completion
        const completionMessage = `${methodName} completed`;
        methodLogger[logOptions.level || 'info'](completionMessage, {
          duration: `${duration}ms`,
          ...(logOptions.logResult && { result: this.sanitizeResult(result) }),
        });

        // Log performance if method is slow
        if (duration > 1000) {
          methodLogger.logPerformance(`Slow method: ${methodName}`, duration, {
            className,
            methodName,
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        
        if (logOptions.logErrors !== false) {
          methodLogger.error(`${methodName} failed`, {
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
            duration: `${duration}ms`,
          });
        }

        throw error;
      }),
    );
  }

  /**
   * Sanitize method arguments for logging
   */
  private sanitizeArgs(args: any[]): any[] {
    return args.map((arg, index) => {
      if (arg && typeof arg === 'object') {
        // Handle common NestJS objects
        if (arg.constructor?.name === 'FastifyRequest') {
          return '[FastifyRequest]';
        }
        if (arg.constructor?.name === 'FastifyReply') {
          return '[FastifyReply]';
        }
        
        // Sanitize regular objects
        return this.sanitizeObject(arg);
      }
      
      return arg;
    });
  }

  /**
   * Sanitize method result for logging
   */
  private sanitizeResult(result: any): any {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Limit result size for logging
    const stringified = JSON.stringify(result);
    if (stringified.length > 500) {
      return `[Result too large: ${stringified.length} characters]`;
    }

    return this.sanitizeObject(result);
  }

  /**
   * Sanitize object by removing sensitive fields
   */
  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'passwordHash',
      'refreshToken',
    ];

    const sanitized = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        (sanitized as any)[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        (sanitized as any)[key] = this.sanitizeObject(value);
      } else {
        (sanitized as any)[key] = value;
      }
    }

    return sanitized;
  }
}