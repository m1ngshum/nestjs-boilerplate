import { Injectable, HttpStatus } from '@nestjs/common';
import { LoggerService } from '../../logger/logger.service';
import {
  BaseExceptionFilter,
  BaseErrorResponse,
  BaseExceptionFilterOptions,
} from '../base/base-exception.filter';
import { FastifyRequest } from 'fastify';

// Project-specific error types
export interface ProjectErrorResponse extends BaseErrorResponse {
  traceId?: string;
  userContext?: {
    userId?: string;
    sessionId?: string;
    userAgent?: string;
  };
  details?: Record<string, any>;
}

// Project-specific exception filter options
export interface ProjectExceptionFilterOptions extends BaseExceptionFilterOptions {
  includeUserContext?: boolean;
  includeTraceId?: boolean;
  customErrorCodes?: Record<string, number>;
  notificationThresholds?: {
    errorCount?: number;
    timeWindow?: number;
  };
}

@Injectable()
export class ProjectExceptionFilter extends BaseExceptionFilter {
  protected readonly projectOptions: ProjectExceptionFilterOptions;

  constructor(logger: LoggerService, options: ProjectExceptionFilterOptions = {}) {
    super(logger, options);

    this.projectOptions = {
      includeUserContext: true,
      includeTraceId: true,
      customErrorCodes: {
        BUSINESS_RULE_VIOLATION: HttpStatus.UNPROCESSABLE_ENTITY,
        RESOURCE_NOT_FOUND: HttpStatus.NOT_FOUND,
        PERMISSION_DENIED: HttpStatus.FORBIDDEN,
        RATE_LIMIT_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
      },
      notificationThresholds: {
        errorCount: 10,
        timeWindow: 60000, // 1 minute
      },
      ...options,
    };
  }

  protected buildErrorResponse(exception: unknown, request: FastifyRequest): ProjectErrorResponse {
    const baseResponse = super.buildErrorResponse(exception, request);

    // Extend with project-specific fields
    const projectResponse: ProjectErrorResponse = {
      ...baseResponse,
    };

    // Add trace ID if enabled
    if (this.projectOptions.includeTraceId) {
      projectResponse.traceId = this.generateTraceId(request);
    }

    // Add user context if enabled
    if (this.projectOptions.includeUserContext) {
      projectResponse.userContext = this.extractUserContext(request);
    }

    // Add custom error details
    projectResponse.details = this.extractErrorDetails(exception);

    // Apply custom error codes
    const customStatus = this.getCustomErrorCode(exception);
    if (customStatus) {
      projectResponse.statusCode = customStatus;
    }

    return projectResponse;
  }

  protected generateTraceId(request: FastifyRequest): string {
    // Try to get trace ID from headers or generate one
    return (
      (request.headers['x-trace-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      this.generateUniqueId()
    );
  }

  protected extractUserContext(request: FastifyRequest): ProjectErrorResponse['userContext'] {
    // Extract user context from request
    // This would typically come from JWT token or session
    const userContext: ProjectErrorResponse['userContext'] = {
      userAgent: request.headers['user-agent'],
    };

    // Add user ID if available (from JWT or session)
    const userId = this.extractUserId(request);
    if (userId) {
      userContext.userId = userId;
    }

    // Add session ID if available
    const sessionId = this.extractSessionId(request);
    if (sessionId) {
      userContext.sessionId = sessionId;
    }

    return userContext;
  }

  protected extractUserId(request: FastifyRequest): string | undefined {
    // Extract user ID from JWT token or session
    // This is project-specific implementation
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        // In a real implementation, you'd decode the JWT token
        // For now, return undefined
        return undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  protected extractSessionId(request: FastifyRequest): string | undefined {
    // Extract session ID from cookies or headers
    return request.headers['x-session-id'] as string;
  }

  protected extractErrorDetails(exception: unknown): Record<string, any> | undefined {
    // Extract additional error details based on exception type
    if (exception instanceof Error) {
      // Add project-specific error details
      const details: Record<string, any> = {};

      // Example: Extract validation details
      if (exception.name === 'ValidationError') {
        details.validationErrors = (exception as any).details;
      }

      // Example: Extract business rule violations
      if (exception.message.includes('BUSINESS_RULE')) {
        details.businessRule = this.extractBusinessRuleInfo(exception.message);
      }

      return Object.keys(details).length > 0 ? details : undefined;
    }
    return undefined;
  }

  protected getCustomErrorCode(exception: unknown): number | undefined {
    if (exception instanceof Error) {
      // Check for custom error codes in message or name
      for (const [errorType, statusCode] of Object.entries(
        this.projectOptions.customErrorCodes || {},
      )) {
        if (exception.message.includes(errorType) || exception.name === errorType) {
          return statusCode;
        }
      }
    }
    return undefined;
  }

  protected extractBusinessRuleInfo(message: string): Record<string, any> {
    // Extract business rule information from error message
    // This is project-specific logic
    const match = message.match(/BUSINESS_RULE:(.+)/);
    return match ? { rule: match[1].trim() } : {};
  }

  protected generateUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  protected logError(logData: Record<string, any>): void {
    // Call base logging
    super.logError(logData);

    // Add project-specific logging logic
    // Example: Send alerts for critical errors
    if (this.shouldSendAlert(logData)) {
      this.sendErrorAlert(logData);
    }
  }

  protected shouldSendAlert(logData: Record<string, any>): boolean {
    // Project-specific logic to determine if an alert should be sent
    const statusCode = logData.response?.statusCode;
    return statusCode >= 500; // Alert on server errors
  }

  protected sendErrorAlert(logData: Record<string, any>): void {
    // Project-specific alert implementation
    // Example: Send to Slack, email, or monitoring service
    this.logger.warn('Error alert triggered', {
      alert: true,
      ...logData,
    });
  }
}
