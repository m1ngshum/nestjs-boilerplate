import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as Sentry from '@sentry/nestjs';
import { LoggerService } from '../../logger/logger.service';
import { getTraceContext } from './trace.middleware';
import { createOutgoingHeaders, TraceContext, generateSpanId } from './trace-context';

// Use global fetch (available in Node.js 18+)
declare const fetch: typeof globalThis.fetch;

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
  duration: number;
}

/**
 * HTTP client service with automatic distributed tracing
 * Propagates trace context to downstream services
 */
@Injectable()
export class TracedHttpClientService {
  constructor(
    private readonly cls: ClsService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(TracedHttpClientService.name);
  }

  /**
   * Make an HTTP request with automatic tracing
   */
  async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const method = options.method || 'GET';
    const traceContext = getTraceContext(this.cls);
    const startTime = Date.now();

    // Create a child span for this HTTP request
    const childSpanId = generateSpanId();
    const outgoingContext: TraceContext = traceContext
      ? {
          ...traceContext,
          parentSpanId: traceContext.spanId,
          spanId: childSpanId,
        }
      : {
          traceId: childSpanId + childSpanId, // Generate new trace if none exists
          spanId: childSpanId,
          requestId: childSpanId,
          sampled: true,
          startTime,
        };

    // Create trace headers for outgoing request
    const traceHeaders = createOutgoingHeaders(outgoingContext);

    // Merge headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...traceHeaders,
      ...options.headers,
    };

    // Log outgoing request
    this.logger.debug(`Outgoing HTTP request: ${method} ${url}`, {
      traceId: outgoingContext.traceId,
      spanId: outgoingContext.spanId,
      parentSpanId: outgoingContext.parentSpanId,
    });

    // Execute request with Sentry span
    return Sentry.startSpan(
      {
        name: `HTTP ${method}`,
        op: 'http.client',
        attributes: {
          'http.method': method,
          'http.url': url,
          'http.target': new URL(url).pathname,
          'server.address': new URL(url).hostname,
          trace_id: outgoingContext.traceId,
          span_id: outgoingContext.spanId,
        },
      },
      async (span) => {
        // Add breadcrumb
        Sentry.addBreadcrumb({
          category: 'http',
          message: `${method} ${url}`,
          level: 'info',
          data: {
            method,
            url,
            traceId: outgoingContext.traceId,
          },
        });

        try {
          const response = await this.executeRequest<T>(url, method, headers, options);
          const duration = Date.now() - startTime;

          span.setStatus({ code: 1, message: 'ok' });
          span.setAttribute('http.status_code', response.status);
          span.setAttribute('http.response_content_length', JSON.stringify(response.data).length);

          this.logger.debug(
            `HTTP response: ${method} ${url} - ${response.status} (${duration}ms)`,
            {
              traceId: outgoingContext.traceId,
              spanId: outgoingContext.spanId,
              status: response.status,
              duration,
            },
          );

          return { ...response, duration };
        } catch (error) {
          const duration = Date.now() - startTime;

          span.setStatus({ code: 2, message: (error as Error).message });
          span.setAttribute('error.type', (error as Error).name);
          span.setAttribute('error.message', (error as Error).message);

          this.logger.error(`HTTP request failed: ${method} ${url}`, {
            traceId: outgoingContext.traceId,
            spanId: outgoingContext.spanId,
            error: (error as Error).message,
            duration,
          });

          throw error;
        }
      },
    );
  }

  /**
   * Execute the actual HTTP request
   */
  private async executeRequest<T>(
    url: string,
    method: string,
    headers: Record<string, string>,
    options: HttpRequestOptions,
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeout = options.timeout || 30000;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      if (options.body && !['GET', 'HEAD'].includes(method)) {
        fetchOptions.body = JSON.stringify(options.body);
      }

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = (await response.text()) as unknown as T;
      }

      if (!response.ok) {
        throw new HttpException(
          {
            statusCode: response.status,
            message: `HTTP ${response.status}: ${response.statusText}`,
            data,
          },
          response.status,
        );
      }

      return {
        data,
        status: response.status,
        headers: responseHeaders,
        duration: 0, // Will be set by caller
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if ((error as Error).name === 'AbortError') {
        throw new HttpException(`Request timeout after ${timeout}ms`, HttpStatus.REQUEST_TIMEOUT);
      }

      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T = any>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(
    url: string,
    body?: any,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'POST', body });
  }

  /**
   * PUT request
   */
  async put<T = any>(
    url: string,
    body?: any,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PUT', body });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    url: string,
    body?: any,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(
    url: string,
    options?: Omit<HttpRequestOptions, 'method' | 'body'>,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}
