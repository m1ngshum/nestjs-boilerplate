import { randomUUID, randomBytes } from 'crypto';

/**
 * W3C Trace Context and Sentry distributed tracing headers
 */
export interface TraceContext {
  // Unique trace ID for the entire request chain
  traceId: string;
  // Unique span ID for this service's portion
  spanId: string;
  // Parent span ID (from upstream service)
  parentSpanId?: string;
  // Sentry trace header value
  sentryTrace?: string;
  // Baggage header for context propagation
  baggage?: string;
  // Sampling decision
  sampled?: boolean;
  // Request ID (may be same as traceId or separate)
  requestId: string;
  // Timestamp when trace started
  startTime: number;
}

/**
 * Headers used for distributed tracing
 */
export const TRACE_HEADERS = {
  // W3C Trace Context
  TRACEPARENT: 'traceparent',
  TRACESTATE: 'tracestate',
  // Sentry distributed tracing
  SENTRY_TRACE: 'sentry-trace',
  BAGGAGE: 'baggage',
  // Custom headers
  REQUEST_ID: 'x-request-id',
  CORRELATION_ID: 'x-correlation-id',
  TRACE_ID: 'x-trace-id',
  SPAN_ID: 'x-span-id',
  PARENT_SPAN_ID: 'x-parent-span-id',
} as const;

/**
 * Generate a random hex string of specified length
 */
function randomHex(length: number): string {
  return randomBytes(length / 2).toString('hex');
}

/**
 * Generate a new trace ID (32 hex characters)
 */
export function generateTraceId(): string {
  return randomHex(32);
}

/**
 * Generate a new span ID (16 hex characters)
 */
export function generateSpanId(): string {
  return randomHex(16);
}

/**
 * Parse W3C traceparent header
 * Format: version-traceid-parentid-flags (e.g., 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01)
 */
export function parseTraceparent(traceparent: string): Partial<TraceContext> | null {
  if (!traceparent) return null;

  const parts = traceparent.split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, parentSpanId, flags] = parts;

  // Only support version 00
  if (version !== '00') return null;

  // Validate trace ID (32 hex chars, not all zeros)
  if (!/^[a-f0-9]{32}$/.test(traceId) || traceId === '0'.repeat(32)) {
    return null;
  }

  // Validate parent span ID (16 hex chars, not all zeros)
  if (!/^[a-f0-9]{16}$/.test(parentSpanId) || parentSpanId === '0'.repeat(16)) {
    return null;
  }

  return {
    traceId,
    parentSpanId,
    sampled: (parseInt(flags, 16) & 0x01) === 1,
  };
}

/**
 * Parse sentry-trace header
 * Format: traceid-spanid-sampled (e.g., 0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-1)
 */
export function parseSentryTrace(sentryTrace: string): Partial<TraceContext> | null {
  if (!sentryTrace) return null;

  const parts = sentryTrace.split('-');
  if (parts.length < 2) return null;

  const [traceId, parentSpanId, sampledStr] = parts;

  // Validate trace ID (32 hex chars)
  if (!/^[a-f0-9]{32}$/.test(traceId)) return null;

  // Validate parent span ID (16 hex chars)
  if (!/^[a-f0-9]{16}$/.test(parentSpanId)) return null;

  return {
    traceId,
    parentSpanId,
    sampled: sampledStr === '1',
    sentryTrace,
  };
}

/**
 * Create traceparent header value
 */
export function createTraceparent(context: TraceContext): string {
  const flags = context.sampled ? '01' : '00';
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Create sentry-trace header value
 */
export function createSentryTrace(context: TraceContext): string {
  const sampled = context.sampled ? '1' : '0';
  return `${context.traceId}-${context.spanId}-${sampled}`;
}

/**
 * Extract trace context from incoming request headers
 */
export function extractTraceContext(
  headers: Record<string, string | string[] | undefined>,
): TraceContext {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const startTime = Date.now();
  let traceId: string | undefined;
  let parentSpanId: string | undefined;
  let sampled: boolean | undefined;
  let sentryTrace: string | undefined;
  let baggage: string | undefined;

  // Try to extract from sentry-trace header first (preferred for Sentry)
  const sentryTraceHeader = getHeader(TRACE_HEADERS.SENTRY_TRACE);
  if (sentryTraceHeader) {
    const parsed = parseSentryTrace(sentryTraceHeader);
    if (parsed) {
      traceId = parsed.traceId;
      parentSpanId = parsed.parentSpanId;
      sampled = parsed.sampled;
      sentryTrace = sentryTraceHeader;
    }
  }

  // Fallback to W3C traceparent
  if (!traceId) {
    const traceparentHeader = getHeader(TRACE_HEADERS.TRACEPARENT);
    if (traceparentHeader) {
      const parsed = parseTraceparent(traceparentHeader);
      if (parsed) {
        traceId = parsed.traceId;
        parentSpanId = parsed.parentSpanId;
        sampled = parsed.sampled;
      }
    }
  }

  // Fallback to custom headers
  if (!traceId) {
    traceId = getHeader(TRACE_HEADERS.TRACE_ID) || getHeader(TRACE_HEADERS.CORRELATION_ID);
  }

  // Get baggage for context propagation
  baggage = getHeader(TRACE_HEADERS.BAGGAGE);

  // Get or generate request ID
  const requestId = getHeader(TRACE_HEADERS.REQUEST_ID) || randomUUID();

  // Generate new trace ID if not provided
  if (!traceId) {
    traceId = generateTraceId();
  }

  // Always generate a new span ID for this service
  const spanId = generateSpanId();

  return {
    traceId,
    spanId,
    parentSpanId,
    sentryTrace,
    baggage,
    sampled: sampled ?? true,
    requestId,
    startTime,
  };
}

/**
 * Create headers for outgoing requests (propagate trace context)
 */
export function createOutgoingHeaders(context: TraceContext): Record<string, string> {
  const headers: Record<string, string> = {
    [TRACE_HEADERS.TRACEPARENT]: createTraceparent(context),
    [TRACE_HEADERS.SENTRY_TRACE]: createSentryTrace(context),
    [TRACE_HEADERS.REQUEST_ID]: context.requestId,
    [TRACE_HEADERS.TRACE_ID]: context.traceId,
    [TRACE_HEADERS.SPAN_ID]: context.spanId,
  };

  if (context.parentSpanId) {
    headers[TRACE_HEADERS.PARENT_SPAN_ID] = context.parentSpanId;
  }

  if (context.baggage) {
    headers[TRACE_HEADERS.BAGGAGE] = context.baggage;
  }

  return headers;
}
