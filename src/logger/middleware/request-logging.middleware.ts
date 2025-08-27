import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { LoggerService } from '../logger.service';
import { ClsService } from 'nestjs-cls';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: LoggerService,
    private readonly cls: ClsService,
  ) {
    this.logger.setContext('RequestLoggingMiddleware');
  }

  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    const startTime = Date.now();
    
    // Generate or extract correlation ID
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    
    // Set correlation ID in CLS context
    this.cls.set('correlationId', correlationId);
    
    // Add correlation ID to response headers
    res.header('x-correlation-id', correlationId);

    // Extract request information
    const requestInfo = {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: this.getClientIp(req),
      correlationId,
    };

    // Log incoming request
    this.logger.log('Incoming Request', requestInfo);

    // Store start time in request for later use
    (req as any).startTime = startTime;
    (req as any).requestInfo = requestInfo;

    // Continue to next middleware
    next();
  }

  /**
   * Extract client IP address from request
   */
  private getClientIp(req: FastifyRequest): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }
}