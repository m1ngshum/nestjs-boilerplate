import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';
import * as Sentry from '@sentry/nestjs';
import { FastifyRequest } from 'fastify';
import { getTraceContext } from './trace.middleware';

/**
 * Interceptor that enriches Sentry context with request information
 * and creates spans for request handling
 */
@Injectable()
export class SentryContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const traceContext = getTraceContext(this.cls);
    const startTime = Date.now();

    // Get route information
    const handler = context.getHandler();
    const controller = context.getClass();
    const routeName = `${controller.name}.${handler.name}`;
    const httpMethod = request.method;
    const url = request.url;

    // Set Sentry scope with request context
    Sentry.withScope((scope) => {
      // Set transaction name
      scope.setTransactionName(`${httpMethod} ${url}`);

      // Set tags for easy filtering
      scope.setTag('http.method', httpMethod);
      scope.setTag('http.route', routeName);
      scope.setTag('controller', controller.name);
      scope.setTag('handler', handler.name);

      if (traceContext) {
        scope.setTag('trace_id', traceContext.traceId);
        scope.setTag('request_id', traceContext.requestId);
      }

      // Set request context
      scope.setContext('request', {
        method: httpMethod,
        url: url,
        route: routeName,
        headers: this.sanitizeHeaders(request.headers),
        query: request.query,
        params: request.params,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      // Set user context if available
      const user = (request as any).user;
      if (user) {
        scope.setUser({
          id: user.id || user.sub,
          email: user.email,
          username: user.username || user.name,
        });
      }

      // Set trace context
      if (traceContext) {
        scope.setContext('trace', {
          traceId: traceContext.traceId,
          spanId: traceContext.spanId,
          parentSpanId: traceContext.parentSpanId,
          requestId: traceContext.requestId,
        });
      }
    });

    // Add breadcrumb for request start
    Sentry.addBreadcrumb({
      category: 'http',
      message: `${httpMethod} ${url}`,
      level: 'info',
      data: {
        method: httpMethod,
        url: url,
        route: routeName,
        traceId: traceContext?.traceId,
        requestId: traceContext?.requestId,
      },
    });

    return next.handle().pipe(
      tap((_response) => {
        const duration = Date.now() - startTime;

        // Add breadcrumb for successful response
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${httpMethod} ${url} completed`,
          level: 'info',
          data: {
            method: httpMethod,
            url: url,
            route: routeName,
            duration: `${duration}ms`,
            statusCode: 200,
          },
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Enrich error with request context
        Sentry.withScope((scope) => {
          scope.setTag('error.handled', 'true');
          scope.setTag('http.method', httpMethod);
          scope.setTag('http.route', routeName);

          scope.setContext('error_context', {
            method: httpMethod,
            url: url,
            route: routeName,
            duration: `${duration}ms`,
            traceId: traceContext?.traceId,
            requestId: traceContext?.requestId,
          });

          // Add breadcrumb for error
          Sentry.addBreadcrumb({
            category: 'http',
            message: `${httpMethod} ${url} failed`,
            level: 'error',
            data: {
              method: httpMethod,
              url: url,
              route: routeName,
              duration: `${duration}ms`,
              error: error.message,
            },
          });
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Remove sensitive headers before sending to Sentry
   */
  private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'api-key',
      'x-auth-token',
      'x-access-token',
    ];

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
