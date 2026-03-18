import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerRequest,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ThrottlerCustomPath } from '../types/throttler.type';
import { CLIENT_IP } from '../constants/async-context-key';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  private readonly pathToThrottlerMap: Map<string, ThrottlerCustomPath>;

  constructor(
    protected options: ThrottlerModuleOptions,
    protected storageService: ThrottlerStorage,
    protected reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {
    super(options, storageService, reflector);

    // Initialize custom throttler paths from config
    const throttleConfig = this.configService.get('throttle') || {};
    const customPaths = throttleConfig.custom || [];

    this.pathToThrottlerMap = new Map(
      customPaths.map((throttler: ThrottlerCustomPath) => [
        throttler.path,
        {
          ...throttler,
          ttl: throttler.ttl * 1000, // Convert to milliseconds
          blockDuration: (throttler.blockDuration || throttler.ttl) * 1000,
        },
      ]),
    );
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const tracker = this.cls.get<string>(CLIENT_IP) ?? 'unknown';
    return tracker;
  }

  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, ttl, limit, throttler, blockDuration } = requestProps;
    const request = context.switchToHttp().getRequest();
    const customThrottler = this.pathToThrottlerMap.get(request.url);

    return customThrottler
      ? super.handleRequest({
          ...requestProps,
          limit: customThrottler.limit,
          ttl: customThrottler.ttl,
          blockDuration: customThrottler.blockDuration ?? blockDuration,
        })
      : super.handleRequest(requestProps);
  }
}
