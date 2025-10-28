import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConfigurationService } from './configuration.service';
import { validateConfiguration } from './configuration.validation';
import configuration from './configuration';
import baseConfiguration from './base-configuration';
import projectConfiguration from './project-configuration';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        baseConfiguration, // Template-managed configuration
        projectConfiguration, // Project-specific configuration
        configuration, // Main merged configuration
      ],
      envFilePath: ['.env.local', '.env'],
      validate: validateConfiguration,
      validationOptions: {
        allowUnknown: false,
        abortEarly: true,
      },
    }),
  ],
  providers: [ConfigurationService],
  exports: [ConfigurationService],
})
export class ConfigurationModule {}
