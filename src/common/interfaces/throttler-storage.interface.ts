import { ThrottlerStorage } from '@nestjs/throttler';
import Redis, { Cluster } from 'iovalkey';

export interface ThrottlerStorageRedis {
  redis: Redis | Cluster;
  increment: ThrottlerStorage['increment'];
}

export const ThrottlerStorageRedis = Symbol('ThrottlerStorageRedis');