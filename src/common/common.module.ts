import { Global, Module } from '@nestjs/common';
import { ConfigurationService } from '../config/configuration.service';
import { LoggerService } from '../logger/logger.service';

// Base providers (template-managed)
import { BaseExceptionFilter } from './base/base-exception.filter';
import { BaseTransformInterceptor } from './base/base-transform.interceptor';
import { BaseValidationPipe } from './base/base-validation.pipe';

// Project providers (project-specific)
import { ProjectExceptionFilter } from './project/project-exception.filter';
import { ProjectTransformInterceptor } from './project/project-transform.interceptor';

// Legacy providers for backward compatibility
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ValidationPipe } from './pipes/validation.pipe';

@Global()
@Module({
  providers: [
    // Base providers (template-managed)
    {
      provide: BaseExceptionFilter,
      useFactory: (logger: LoggerService) => {
        return new BaseExceptionFilter(logger, {
          includeStackTrace: false,
          logLevel: 'error',
        });
      },
      inject: [LoggerService],
    },
    {
      provide: BaseTransformInterceptor,
      useFactory: () => {
        return new BaseTransformInterceptor(undefined, {
          excludePaths: ['/health', '/docs', '/metrics'],
          includeCorrelationId: true,
        });
      },
    },
    {
      provide: BaseValidationPipe,
      useFactory: () => {
        return new BaseValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        });
      },
    },

    // Project providers (project-specific)
    {
      provide: ProjectExceptionFilter,
      useFactory: (logger: LoggerService, config: ConfigurationService) => {
        return new ProjectExceptionFilter(logger, {
          includeUserContext: true,
          includeTraceId: true,
          includeStackTrace: !config.isProduction(),
        });
      },
      inject: [LoggerService, ConfigurationService],
    },
    {
      provide: ProjectTransformInterceptor,
      useFactory: (config: ConfigurationService) => {
        return new ProjectTransformInterceptor(undefined, {
          includeVersion: true,
          includeRequestId: true,
          apiVersion: '1.0',
        });
      },
      inject: [ConfigurationService],
    },

    // Legacy providers for backward compatibility
    GlobalExceptionFilter,
    TransformInterceptor,
    ValidationPipe,
  ],
  exports: [
    // Export both base and project providers
    BaseExceptionFilter,
    BaseTransformInterceptor,
    BaseValidationPipe,
    ProjectExceptionFilter,
    ProjectTransformInterceptor,

    // Legacy exports for backward compatibility
    GlobalExceptionFilter,
    TransformInterceptor,
    ValidationPipe,
  ],
})
export class CommonModule {}
