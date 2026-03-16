import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggerService } from '../../logger/logger.service';

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'x-refresh-token', 'x-api-key']);
const SENSITIVE_BODY_KEYS = /password|secret|token|creditcard|credit_card/i;

function redactHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return redacted;
}

function redactBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(redactBody);

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_BODY_KEYS.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactBody(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

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
        const responseObj = exceptionResponse as Record<string, unknown>;
        message = (responseObj.message as string) || exception.message;
        error = (responseObj.error as string) || exception.name;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = 'InternalServerError';
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      error,
      message,
    };

    // Log the error with sensitive data redacted
    this.logger.error('Exception caught by global filter', {
      exception: exception instanceof Error ? exception.stack : exception,
      request: {
        method: request.method,
        url: request.url,
        headers: redactHeaders(request.headers as Record<string, unknown>),
        body: redactBody(request.body),
      },
      response: errorResponse,
    });

    response.status(status).send(errorResponse);
  }
}
