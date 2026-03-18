import * as Sentry from '@sentry/nestjs';

/**
 * Options for the @Trace decorator
 */
export interface TraceOptions {
  /** Name of the span (defaults to method name) */
  name?: string;
  /** Operation type (e.g., 'db', 'http', 'cache') */
  op?: string;
  /** Additional attributes to add to the span */
  attributes?: Record<string, string | number | boolean>;
  /** Whether to capture the method arguments */
  captureArgs?: boolean;
  /** Whether to capture the return value */
  captureResult?: boolean;
}

/**
 * Decorator to trace method execution with Sentry spans
 *
 * @example
 * ```typescript
 * @Trace('user.findById', { op: 'db.query' })
 * async findById(id: string): Promise<User> {
 *   // Method will be traced
 * }
 * ```
 */
export function Trace(nameOrOptions?: string | TraceOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = String(propertyKey);
    const className = target.constructor.name;

    // Parse options
    let options: TraceOptions = {};
    if (typeof nameOrOptions === 'string') {
      options.name = nameOrOptions;
    } else if (nameOrOptions) {
      options = nameOrOptions;
    }

    const spanName = options.name || `${className}.${methodName}`;
    const spanOp = options.op || 'function';

    descriptor.value = async function (...args: any[]) {
      return Sentry.startSpan(
        {
          name: spanName,
          op: spanOp,
          attributes: {
            'code.function': methodName,
            'code.namespace': className,
            ...options.attributes,
          },
        },
        async (span) => {
          try {
            // Add arguments as span data if enabled
            if (options.captureArgs && args.length > 0) {
              span.setAttribute('args', JSON.stringify(args).substring(0, 1000));
            }

            const result = await originalMethod.apply(this, args);

            // Add result as span data if enabled
            if (options.captureResult && result !== undefined) {
              const resultStr = JSON.stringify(result);
              span.setAttribute('result.preview', resultStr.substring(0, 200));
              span.setAttribute('result.size', resultStr.length);
            }

            span.setStatus({ code: 1, message: 'ok' }); // OK status
            return result;
          } catch (error) {
            span.setStatus({ code: 2, message: (error as Error).message }); // ERROR status

            // Add error details to span
            span.setAttribute('error.type', (error as Error).name);
            span.setAttribute('error.message', (error as Error).message);

            throw error;
          }
        },
      );
    };

    return descriptor;
  };
}

/**
 * Decorator to trace database operations
 */
export function TraceDb(name?: string): MethodDecorator {
  return Trace({ name, op: 'db.query' });
}

/**
 * Decorator to trace HTTP client calls
 */
export function TraceHttp(name?: string): MethodDecorator {
  return Trace({ name, op: 'http.client' });
}

/**
 * Decorator to trace cache operations
 */
export function TraceCache(name?: string): MethodDecorator {
  return Trace({ name, op: 'cache' });
}

/**
 * Decorator to trace queue/message operations
 */
export function TraceQueue(name?: string): MethodDecorator {
  return Trace({ name, op: 'queue' });
}

/**
 * Helper to create a child span within a traced method
 */
export async function withSpan<T>(
  name: string,
  op: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return Sentry.startSpan(
    {
      name,
      op,
      attributes,
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1, message: 'ok' });
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: (error as Error).message });
        throw error;
      }
    },
  );
}
