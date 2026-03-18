import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TraceMiddleware } from './trace.middleware';
import { SentryContextInterceptor } from './sentry-context.interceptor';
import { TracedHttpClientService } from './traced-http-client.service';

@Global()
@Module({
  providers: [
    TracedHttpClientService,
    // Register Sentry context interceptor globally
    {
      provide: APP_INTERCEPTOR,
      useClass: SentryContextInterceptor,
    },
  ],
  exports: [TracedHttpClientService],
})
export class TracingModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply trace middleware to all routes
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
