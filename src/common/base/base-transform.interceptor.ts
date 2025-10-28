import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';
import { ClsService } from 'nestjs-cls';

export interface BaseApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}

export interface BaseTransformOptions {
  excludePaths?: string[];
  includeCorrelationId?: boolean;
  defaultMessage?: string;
  transformData?: (data: any) => any;
}

@Injectable()
export class BaseTransformInterceptor<T> implements NestInterceptor<T, BaseApiResponse<T>> {
  protected readonly options: BaseTransformOptions;

  constructor(
    protected readonly cls?: ClsService,
    options: BaseTransformOptions = {},
  ) {
    this.options = {
      excludePaths: ['/health', '/docs', '/metrics'],
      includeCorrelationId: true,
      defaultMessage: 'Request successful',
      ...options,
    };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<BaseApiResponse<T>> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Skip transformation for excluded paths
    if (this.shouldSkipTransformation(request.url)) {
      return next.handle();
    }

    return next.handle().pipe(map((data: T) => this.transformResponse(data, request)));
  }

  protected shouldSkipTransformation(path: string): boolean {
    return this.options.excludePaths?.some((excludePath) => path.startsWith(excludePath)) || false;
  }

  protected transformResponse(data: T, request: FastifyRequest): BaseApiResponse<T> {
    const transformedData = this.options.transformData ? this.options.transformData(data) : data;

    const response: BaseApiResponse<T> = {
      success: true,
      data: transformedData,
      message: this.getResponseMessage(data),
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add correlation ID if available and enabled
    if (this.options.includeCorrelationId && this.cls) {
      const correlationId = this.cls.get('correlationId');
      if (correlationId) {
        response.correlationId = correlationId;
      }
    }

    return response;
  }

  protected getResponseMessage(data: T): string {
    // Allow data to specify its own message
    if (data && typeof data === 'object' && 'message' in data) {
      return (data as any).message;
    }

    return this.options.defaultMessage || 'Request successful';
  }
}
