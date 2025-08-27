import { Global, Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';

@Global()
@Module({
  providers: [
    LoggerService,
    LoggingInterceptor,
    RequestLoggingMiddleware,
  ],
  exports: [
    LoggerService,
    LoggingInterceptor,
    RequestLoggingMiddleware,
  ],
})
export class LoggerModule {}