import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  BaseTransformInterceptor,
  BaseApiResponse,
  BaseTransformOptions,
} from '../base/base-transform.interceptor';
import { FastifyRequest } from 'fastify';

// Project-specific response interface
export interface ProjectApiResponse<T = any> extends BaseApiResponse<T> {
  version?: string;
  requestId?: string;
  metadata?: {
    executionTime?: number;
    cacheHit?: boolean;
    dataSource?: string;
    userContext?: {
      userId?: string;
      role?: string;
    };
  };
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

// Project-specific transform options
export interface ProjectTransformOptions extends BaseTransformOptions {
  includeVersion?: boolean;
  includeRequestId?: boolean;
  includeExecutionTime?: boolean;
  includeUserContext?: boolean;
  apiVersion?: string;
  paginationEnabled?: boolean;
}

@Injectable()
export class ProjectTransformInterceptor<T> extends BaseTransformInterceptor<T> {
  protected readonly projectOptions: ProjectTransformOptions;

  constructor(cls?: ClsService, options: ProjectTransformOptions = {}) {
    super(cls, options);

    this.projectOptions = {
      includeVersion: true,
      includeRequestId: true,
      includeExecutionTime: true,
      includeUserContext: true,
      apiVersion: '1.0',
      paginationEnabled: true,
      ...options,
    };
  }

  protected transformResponse(data: T, request: FastifyRequest): ProjectApiResponse<T> {
    const baseResponse = super.transformResponse(data, request);

    // Extend with project-specific fields
    const projectResponse: ProjectApiResponse<T> = {
      ...baseResponse,
    };

    // Add API version if enabled
    if (this.projectOptions.includeVersion) {
      projectResponse.version = this.projectOptions.apiVersion;
    }

    // Add request ID if enabled
    if (this.projectOptions.includeRequestId) {
      projectResponse.requestId = this.getRequestId(request);
    }

    // Add metadata
    projectResponse.metadata = this.buildMetadata(data, request);

    // Add pagination if applicable
    if (this.projectOptions.paginationEnabled && this.isPaginatedData(data)) {
      projectResponse.pagination = this.extractPaginationInfo(data);
    }

    return projectResponse;
  }

  protected getRequestId(request: FastifyRequest): string {
    // Get request ID from headers or generate one
    return (
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-trace-id'] as string) ||
      this.generateRequestId()
    );
  }

  protected buildMetadata(data: T, request: FastifyRequest): ProjectApiResponse<T>['metadata'] {
    const metadata: ProjectApiResponse<T>['metadata'] = {};

    // Add execution time if enabled
    if (this.projectOptions.includeExecutionTime) {
      metadata.executionTime = this.getExecutionTime();
    }

    // Add cache information if available
    metadata.cacheHit = this.getCacheHitStatus();

    // Add data source information
    metadata.dataSource = this.getDataSource(data);

    // Add user context if enabled
    if (this.projectOptions.includeUserContext) {
      metadata.userContext = this.getUserContext(request);
    }

    // Remove undefined values
    return Object.fromEntries(Object.entries(metadata).filter(([_, value]) => value !== undefined));
  }

  protected getExecutionTime(): number | undefined {
    // Get execution time from CLS or calculate
    if (this.cls) {
      const startTime = this.cls.get<number>('requestStartTime');
      if (startTime) {
        return Date.now() - startTime;
      }
    }
    return undefined;
  }

  protected getCacheHitStatus(): boolean | undefined {
    // Get cache hit status from CLS or headers
    if (this.cls) {
      return this.cls.get<boolean>('cacheHit');
    }
    return undefined;
  }

  protected getDataSource(data: T): string | undefined {
    // Determine data source based on data characteristics
    if (data && typeof data === 'object') {
      // Check if data has cache indicators
      if ('_fromCache' in data) {
        return 'cache';
      }
      // Check if data has database indicators
      if ('id' in data || ('items' in data && Array.isArray((data as any).items))) {
        return 'database';
      }
    }
    return 'computed';
  }

  protected getUserContext(
    request: FastifyRequest,
  ): { userId?: string; role?: string } | undefined {
    // Extract user context from JWT or session
    const userContext: { userId?: string; role?: string } = {};

    // Extract user ID
    const userId = this.extractUserId(request);
    if (userId) {
      userContext.userId = userId;
    }

    // Extract user role
    const role = this.extractUserRole(request);
    if (role) {
      userContext.role = role;
    }

    return Object.keys(userContext).length > 0 ? userContext : undefined;
  }

  protected extractUserId(request: FastifyRequest): string | undefined {
    // Extract user ID from JWT token or session
    // This would be implemented based on your auth system
    return this.cls?.get<string>('userId');
  }

  protected extractUserRole(request: FastifyRequest): string | undefined {
    // Extract user role from JWT token or session
    // This would be implemented based on your auth system
    return this.cls?.get<string>('userRole');
  }

  protected isPaginatedData(data: T): boolean {
    // Check if data is paginated
    return (
      data &&
      typeof data === 'object' &&
      ('items' in data || 'data' in data) &&
      ('total' in data || 'page' in data || 'limit' in data)
    );
  }

  protected extractPaginationInfo(data: T): ProjectApiResponse<T>['pagination'] {
    if (!this.isPaginatedData(data)) {
      return undefined;
    }

    const paginatedData = data as any;

    return {
      page: paginatedData.page,
      limit: paginatedData.limit,
      total: paginatedData.total,
      hasNext: paginatedData.hasNext,
      hasPrev: paginatedData.hasPrev,
    };
  }

  protected generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  protected shouldSkipTransformation(path: string): boolean {
    // Add project-specific paths to skip
    const projectExcludePaths = ['/api-docs', '/swagger', '/favicon.ico', '/robots.txt'];

    return (
      super.shouldSkipTransformation(path) ||
      projectExcludePaths.some((excludePath) => path.startsWith(excludePath))
    );
  }

  protected getResponseMessage(data: T): string {
    // Project-specific message logic
    if (data && typeof data === 'object') {
      // Handle different response types
      if ('items' in data) {
        const items = (data as any).items;
        if (Array.isArray(items)) {
          return items.length === 0 ? 'No items found' : `Found ${items.length} items`;
        }
      }

      // Handle single resource responses
      if ('id' in data) {
        return 'Resource retrieved successfully';
      }
    }

    return super.getResponseMessage(data);
  }
}
