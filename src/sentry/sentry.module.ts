import { Module, Global } from '@nestjs/common';
import { SentryModule as OfficialSentryModule } from '@sentry/nestjs/setup';
import { SentryService } from './sentry.service';

@Global()
@Module({
  imports: [OfficialSentryModule.forRoot()],
  providers: [SentryService],
  exports: [SentryService],
})
export class SentryModule {}