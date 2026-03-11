import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { LoggerService } from '../logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const contextType = context.getType();

    if (contextType === 'http') {
      return this.handleHttpRequest(context, next, startTime);
    }

    // Handle other context types (GraphQL, RPC, etc.)
    return this.handleGenericRequest(context, next, startTime);
  }

  private handleHttpRequest(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, headers, body, query, params } = request;

    // Skip logging for health check endpoints
    if (this.shouldSkipLogging(url)) {
      return next.handle();
    }

    // Log incoming request
    this.logger.debug('Incoming Request', {
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      body: this.sanitizeBody(body),
      query,
      params,
      userAgent: headers['user-agent'],
      ip: request.ip || request.connection?.remoteAddress,
    });

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;

        // Log successful response
        this.logger.logRequest(request, response, duration);

        // Log response data in debug mode
        if (this.logger['configService']?.isDevelopment()) {
          this.logger.debug('Response Data', {
            statusCode: response.statusCode,
            data: this.sanitizeResponseData(data),
            duration: `${duration}ms`,
          });
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log error response
        this.logger.error('Request Error', {
          method,
          url,
          statusCode: error.status || HttpStatus.INTERNAL_SERVER_ERROR,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          duration: `${duration}ms`,
        });

        throw error;
      }),
    );
  }

  private handleGenericRequest(
    context: ExecutionContext,
    next: CallHandler,
    startTime: number,
  ): Observable<any> {
    const handler = context.getHandler();
    const className = context.getClass().name;
    const methodName = handler.name;

    this.logger.debug('Method Call', {
      className,
      methodName,
      contextType: context.getType(),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.debug('Method Completed', {
          className,
          methodName,
          duration: `${duration}ms`,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error('Method Error', {
          className,
          methodName,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          duration: `${duration}ms`,
        });

        throw error;
      }),
    );
  }

  /**
   * Check if logging should be skipped for the given URL
   */
  private shouldSkipLogging(url: string): boolean {
    const skipPatterns = [
      '/healthz', // Health check endpoint
      '/healthz/', // Health check endpoint with trailing slash
      '/v1/healthz', // Versioned health check endpoint
      '/v1/healthz/', // Versioned health check endpoint with trailing slash
    ];

    return skipPatterns.some((pattern) => url.includes(pattern));
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...body };

    const sanitizeObject = (obj: any): any => {
      if (!obj || typeof obj !== 'object') {
        return obj;
      }

      const result = Array.isArray(obj) ? [] : {};

      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveFields.some((field) => lowerKey.includes(field))) {
          (result as any)[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          (result as any)[key] = sanitizeObject(value);
        } else {
          (result as any)[key] = value;
        }
      }

      return result;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Sanitize response data for logging
   */
  private sanitizeResponseData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Limit the size of logged response data
    const maxSize = 1000; // characters
    const stringified = JSON.stringify(data);

    if (stringified.length > maxSize) {
      return `[Response too large: ${stringified.length} characters]`;
    }

    return data;
  }
}
