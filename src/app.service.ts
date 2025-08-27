import { Injectable } from '@nestjs/common';
import { ConfigurationService } from './config/configuration.service';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigurationService) {}

  getAppInfo() {
    const appConfig = this.configService.app;
    return {
      name: appConfig.name,
      version: '1.0.0',
      description: 'A comprehensive NestJS boilerplate with authentication, logging, database, caching, and more',
      environment: appConfig.environment,
      timestamp: new Date().toISOString(),
    };
  }

  ping() {
    return {
      message: 'pong',
      timestamp: new Date().toISOString(),
    };
  }
}