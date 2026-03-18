# Distributed Tracing

End-to-end request tracing across web pages, API servers, and service-to-service calls.

## Overview

This module provides:

- **Automatic trace context propagation** - W3C Trace Context and Sentry distributed tracing
- **Request correlation** - Link logs and errors across services
- **Sentry integration** - Enhanced error context and performance monitoring
- **HTTP client tracing** - Automatic trace propagation for outgoing requests
- **Method tracing** - Decorators for custom span creation

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│  API Server │────▶│ Downstream  │
│             │     │    (You)    │     │   Service   │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │  trace-id: abc     │  trace-id: abc     │  trace-id: abc
     │  span-id: 123      │  span-id: 456      │  span-id: 789
     │                    │  parent: 123       │  parent: 456
     └────────────────────┴────────────────────┴──────────────▶ Time
```

All requests in the chain share the same `trace-id`, allowing you to:
- View the entire request flow in Sentry
- Correlate logs across services
- Debug distributed systems

## Headers

The module automatically handles these headers:

| Header | Description |
|--------|-------------|
| `sentry-trace` | Sentry distributed tracing |
| `traceparent` | W3C Trace Context |
| `baggage` | Context propagation |
| `x-request-id` | Request ID |
| `x-trace-id` | Trace ID |
| `x-span-id` | Current span ID |
| `x-parent-span-id` | Parent span ID |

## Usage

### Automatic Tracing (Default)

All incoming requests are automatically traced. No code changes needed.

```typescript
// Logs automatically include trace context
this.logger.log('Processing order');
// Output: { "message": "Processing order", "traceId": "abc123", "spanId": "def456", "requestId": "..." }
```

### Method Tracing with Decorators

```typescript
import { Trace, TraceDb, TraceHttp, TraceCache } from '../common/tracing';

@Injectable()
export class OrderService {
  // Basic tracing
  @Trace('order.process')
  async processOrder(orderId: string) {
    // Creates a span named "order.process"
  }

  // Database operation
  @TraceDb('order.findById')
  async findById(id: string) {
    // Creates a span with op: "db.query"
  }

  // HTTP client call
  @TraceHttp('payment.charge')
  async chargePayment(amount: number) {
    // Creates a span with op: "http.client"
  }

  // Cache operation
  @TraceCache('order.cache.get')
  async getCached(key: string) {
    // Creates a span with op: "cache"
  }

  // With options
  @Trace({
    name: 'order.complex',
    op: 'task',
    captureArgs: true,
    captureResult: true,
    attributes: { 'order.type': 'premium' }
  })
  async complexOperation(data: any) {
    // Full control over span
  }
}
```

### Manual Spans

```typescript
import { withSpan } from '../common/tracing';

async function processItems(items: Item[]) {
  await withSpan('process.batch', 'task', async () => {
    for (const item of items) {
      await withSpan(`process.item.${item.id}`, 'task', async () => {
        // Process item
      });
    }
  });
}
```

### HTTP Client with Tracing

```typescript
import { TracedHttpClientService } from '../common/tracing';

@Injectable()
export class PaymentService {
  constructor(private readonly httpClient: TracedHttpClientService) {}

  async chargeCard(amount: number) {
    // Automatically propagates trace context to downstream service
    const response = await this.httpClient.post(
      'https://payment-service.internal/charge',
      { amount }
    );

    return response.data;
  }
}
```

### Accessing Trace Context

```typescript
import { ClsService } from 'nestjs-cls';
import { getTraceContext, getTraceId, getRequestId } from '../common/tracing';

@Injectable()
export class MyService {
  constructor(private readonly cls: ClsService) {}

  async doSomething() {
    const traceContext = getTraceContext(this.cls);
    const traceId = getTraceId(this.cls);
    const requestId = getRequestId(this.cls);

    console.log({ traceId, requestId });
  }
}
```

## Frontend Integration

### Browser SDK Setup

```javascript
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: 'YOUR_SENTRY_DSN',
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/api\.yourapp\.com/,
  ],
});
```

### Fetch with Trace Context

The Sentry browser SDK automatically adds trace headers to fetch requests matching `tracePropagationTargets`.

### Manual Header Propagation

```javascript
// If not using Sentry browser SDK
const response = await fetch('/api/orders', {
  headers: {
    'sentry-trace': sentryTraceHeader,
    'baggage': baggageHeader,
    'x-request-id': requestId,
  }
});
```

## Viewing Traces

### In Sentry

1. Go to **Performance** → **Traces**
2. Search by `trace_id` tag
3. View the full trace waterfall

### In Logs

All logs include trace context:

```json
{
  "level": "info",
  "message": "Order processed",
  "traceId": "abc123def456...",
  "spanId": "789xyz...",
  "parentSpanId": "456uvw...",
  "requestId": "req-123",
  "service": "order-service"
}
```

Search logs by `traceId` to see all logs from a single request chain.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_DSN` | Sentry DSN | - |
| `SENTRY_TRACES_SAMPLE_RATE` | Trace sampling rate | `0.1` |
| `SENTRY_PROFILES_SAMPLE_RATE` | Profile sampling rate | `0.1` |
| `SENTRY_DEBUG` | Enable debug logging | `false` |

### Trace Propagation Targets

Configure which hosts receive trace headers in `sentry.config.ts`:

```typescript
tracePropagationTargets: [
  'localhost',
  /^https:\/\/api\.yourapp\.com/,
  /^https:\/\/.*\.internal\.yourcompany\.com/,
],
```

## Best Practices

1. **Use descriptive span names**: `service.operation` format (e.g., `order.process`, `user.create`)

2. **Add relevant attributes**: Include business context in spans

3. **Don't over-trace**: Trace important operations, not every function

4. **Handle errors properly**: Errors in traced methods are automatically captured

5. **Use appropriate sample rates**: 100% in dev, lower in production

## Response Headers

Every response includes trace headers for debugging:

```
x-trace-id: abc123def456...
x-span-id: 789xyz...
x-request-id: req-123
traceparent: 00-abc123...-789xyz...-01
sentry-trace: abc123...-789xyz...-1
```

Use these to correlate frontend issues with backend traces.
