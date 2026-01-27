import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ClsService } from 'nestjs-cls';
import * as Sentry from '@sentry/nestjs';
import {
  TraceContext,
  extractTraceContext,
  createTraceparent,
  createSentryTrace,
  TRACE_HEADERS,
} from './trace-context';

/**
 * CLS keys for trace context
 */
export const TRACE_CLS_KEYS = {
  TRACE_CONTEXT: 'traceContext',
  TRACE_ID: 'traceId',
  SPAN_ID: 'spanId',
  PARENT_SPAN_ID: 'parentSpanId',
  REQUEST_ID: 'requestId',
} as const;

/**
 * Middleware to extract/generate trace context and propagate it through the request lifecycle
 */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    // Extract trace context from incoming headers
    const traceContext = extractTraceContext(req.headers as Record<string, string | undefined>);

    // Store trace context in CLS for access throughout the request
    this.cls.set(TRACE_CLS_KEYS.TRACE_CONTEXT, traceContext);
    this.cls.set(TRACE_CLS_KEYS.TRACE_ID, traceContext.traceId);
    this.cls.set(TRACE_CLS_KEYS.SPAN_ID, traceContext.spanId);
    this.cls.set(TRACE_CLS_KEYS.REQUEST_ID, traceContext.requestId);

    if (traceContext.parentSpanId) {
      this.cls.set(TRACE_CLS_KEYS.PARENT_SPAN_ID, traceContext.parentSpanId);
    }

    // Set correlation ID for nestjs-cls (used by logger)
    this.cls.set('id', traceContext.requestId);

    // Set Sentry scope with trace context
    Sentry.withScope((scope) => {
      // Set tags for filtering in Sentry
      scope.setTag('trace_id', traceContext.traceId);
      scope.setTag('span_id', traceContext.spanId);
      scope.setTag('request_id', traceContext.requestId);

      if (traceContext.parentSpanId) {
        scope.setTag('parent_span_id', traceContext.parentSpanId);
      }

      // Set context for detailed view
      scope.setContext('trace', {
        traceId: traceContext.traceId,
        spanId: traceContext.spanId,
        parentSpanId: traceContext.parentSpanId,
        requestId: traceContext.requestId,
        sampled: traceContext.sampled,
        startTime: new Date(traceContext.startTime).toISOString(),
      });
    });

    // Add trace headers to response for debugging
    res.setHeader(TRACE_HEADERS.TRACE_ID, traceContext.traceId);
    res.setHeader(TRACE_HEADERS.SPAN_ID, traceContext.spanId);
    res.setHeader(TRACE_HEADERS.REQUEST_ID, traceContext.requestId);
    res.setHeader(TRACE_HEADERS.TRACEPARENT, createTraceparent(traceContext));
    res.setHeader(TRACE_HEADERS.SENTRY_TRACE, createSentryTrace(traceContext));

    next();
  }
}

/**
 * Helper to get current trace context from CLS
 */
export function getTraceContext(cls: ClsService): TraceContext | undefined {
  return cls.get(TRACE_CLS_KEYS.TRACE_CONTEXT);
}

/**
 * Helper to get current trace ID from CLS
 */
export function getTraceId(cls: ClsService): string | undefined {
  return cls.get(TRACE_CLS_KEYS.TRACE_ID);
}

/**
 * Helper to get current request ID from CLS
 */
export function getRequestId(cls: ClsService): string | undefined {
  return cls.get(TRACE_CLS_KEYS.REQUEST_ID);
}
