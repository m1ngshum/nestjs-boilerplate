import { Global, Module } from '@nestjs/common';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { ValidationPipe } from './pipes/validation.pipe';

@Global()
@Module({
  providers: [
    GlobalExceptionFilter,
    TransformInterceptor,
    ValidationPipe,
  ],
  exports: [
    GlobalExceptionFilter,
    TransformInterceptor,
    ValidationPipe,
  ],
})
export class CommonModule {}