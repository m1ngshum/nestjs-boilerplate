import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
  correlationId?: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(map((data) => this.transformResponse(data)));
  }

  private transformResponse(data: T): ApiResponse<T> {
    // Don't transform if data is already in the expected format
    if (this.isAlreadyTransformed(data)) {
      return data as ApiResponse<T>;
    }

    // Get correlation ID
    const correlationId = this.getCorrelationId();

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(correlationId && { correlationId }),
    };
  }

  private isAlreadyTransformed(data: any): boolean {
    return data && typeof data === 'object' && 'success' in data && 'timestamp' in data;
  }

  private getCorrelationId(): string | undefined {
    try {
      return this.cls.getId();
    } catch {
      return undefined;
    }
  }
}
