import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CACHE_INSTANCE, ValkeyProvider } from './valkey/valkey';

@Global()
@Module({
  providers: [CacheService, ValkeyProvider],
  exports: [CacheService, CACHE_INSTANCE],
})
export class CacheModule {}