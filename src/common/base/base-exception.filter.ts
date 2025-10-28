import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggerService } from '../../logger/logger.service';

export interface BaseErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  error: string;
  message: string;
}

export interface BaseExceptionFilterOptions {
  logLevel?: 'error' | 'warn' | 'log';
  includeStackTrace?: boolean;
  sensitiveHeaders?: string[];
  sensitiveBodyFields?: string[];
}

@Catch()
export class BaseExceptionFilter implements ExceptionFilter {
  protected readonly options: BaseExceptionFilterOptions;

  constructor(
    protected readonly logger: LoggerService,
    options: BaseExceptionFilterOptions = {},
  ) {
    this.options = {
      logLevel: 'error',
      includeStackTrace: false,
      sensitiveHeaders: ['authorization', 'cookie', 'x-api-key'],
      sensitiveBodyFields: ['password', 'token', 'secret'],
      ...options,
    };
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const errorResponse = this.buildErrorResponse(exception, request);
    const logData = this.buildLogData(exception, request, errorResponse);

    // Log the error with appropriate level
    this.logError(logData);

    // Send response
    this.sendErrorResponse(response, errorResponse);
  }

  protected buildErrorResponse(exception: unknown, request: FastifyRequest): BaseErrorResponse {
    let status: number;
    let message: string;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.name;
      } else {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.name;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';
    }

    return {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    };
  }

  protected buildLogData(
    exception: unknown,
    request: FastifyRequest,
    errorResponse: BaseErrorResponse,
  ): Record<string, any> {
    return {
      exception: this.formatException(exception),
      request: this.sanitizeRequestData(request),
      response: errorResponse,
    };
  }

  protected formatException(exception: unknown): any {
    if (exception instanceof Error) {
      return {
        name: exception.name,
        message: exception.message,
        ...(this.options.includeStackTrace && { stack: exception.stack }),
      };
    }
    return exception;
  }

  protected sanitizeRequestData(request: FastifyRequest): any {
    const sanitizedHeaders = this.sanitizeObject(
      request.headers,
      this.options.sensitiveHeaders || [],
    );

    const sanitizedBody = this.sanitizeObject(request.body, this.options.sensitiveBodyFields || []);

    return {
      method: request.method,
      url: request.url,
      headers: sanitizedHeaders,
      body: sanitizedBody,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };
  }

  protected sanitizeObject(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized = { ...obj };
    sensitiveFields.forEach((field) => {
      if (field.toLowerCase() in sanitized) {
        sanitized[field.toLowerCase()] = '[REDACTED]';
      }
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  protected logError(logData: Record<string, any>): void {
    const message = 'Exception caught by global filter';

    switch (this.options.logLevel) {
      case 'warn':
        this.logger.warn(message, logData);
        break;
      case 'log':
        this.logger.log(message, logData);
        break;
      default:
        this.logger.error(message, logData);
    }
  }

  protected sendErrorResponse(response: FastifyReply, errorResponse: BaseErrorResponse): void {
    response.status(errorResponse.statusCode).send(errorResponse);
  }
}
