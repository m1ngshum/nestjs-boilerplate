import { plainToInstance, Transform } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsIn,
  IsUrl,
  Min,
  Max,
  validateSync,
  IsNotEmpty,
} from 'class-validator';

// Custom transformation functions for reliable type conversion
function transformToNumber(value: any): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      return undefined;
    }

    const parsed = parseInt(trimmed, 10);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert "${value}" to number`);
    }

    return parsed;
  }

  throw new Error(`Cannot convert ${typeof value} to number`);
}

function transformToOptionalPort(value: any): number | undefined {
  const transformed = transformToNumber(value);

  if (transformed === undefined) {
    return undefined;
  }

  if (transformed < 1 || transformed > 65535) {
    throw new Error(`Port number must be between 1 and 65535, got ${transformed}`);
  }

  return transformed;
}

function transformToBoolean(value: any): boolean | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') {
      return true;
    }
    if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') {
      return false;
    }
    if (trimmed === '') {
      return undefined;
    }
  }

  throw new Error(`Cannot convert "${value}" to boolean`);
}

function transformToBooleanDefaultTrue(value: any): boolean | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') {
      return false;
    }
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes' || trimmed === '') {
      return true;
    }
  }

  // Default to true for any other value
  return true;
}

function transformToRequiredNumber(value: any): number {
  const transformed = transformToNumber(value);

  if (transformed === undefined) {
    throw new Error('Required number field cannot be empty');
  }

  return transformed;
}

class DatabaseConfigDto {
  @IsIn(['postgres'])
  DATABASE_TYPE: 'postgres' = 'postgres';

  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string = 'localhost';

  @Transform(({ value }) => transformToRequiredNumber(value))
  @IsNumber()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DATABASE_USERNAME: string = 'postgres';

  @IsString()
  @IsNotEmpty()
  DATABASE_PASSWORD: string = '';

  @IsString()
  @IsNotEmpty()
  DATABASE_NAME: string = '';

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBoolean(value))
  DATABASE_SYNCHRONIZE?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBoolean(value))
  DATABASE_LOGGING?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBoolean(value))
  DATABASE_SSL?: boolean;
}

class AppConfigDto {
  @IsString()
  @IsOptional()
  APP_NAME?: string;

  @IsOptional()
  @Transform(({ value }) => transformToOptionalPort(value))
  @IsNumber()
  @Min(1)
  @Max(65535)
  APP_PORT?: number;

  @IsString()
  @IsOptional()
  APP_HOST?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  APP_URL?: string;

  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV?: 'development' | 'production' | 'test';
}

class CacheConfigDto {
  @IsString()
  @IsOptional()
  VALKEY_CLUSTER_HOST?: string;

  @IsOptional()
  @Transform(({ value }) => transformToOptionalPort(value))
  @IsNumber()
  @Min(1)
  @Max(65535)
  VALKEY_CLUSTER_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsOptional()
  @Transform(({ value }) => transformToOptionalPort(value))
  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(15)
  @Transform(({ value }) => parseInt(value, 10))
  REDIS_DB?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  CACHE_TTL?: number;
}

class SentryConfigDto {
  @IsUrl()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsString()
  @IsOptional()
  SENTRY_ENVIRONMENT?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  @Transform(({ value }) => parseFloat(value))
  SENTRY_TRACES_SAMPLE_RATE?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  @Transform(({ value }) => parseFloat(value))
  SENTRY_PROFILES_SAMPLE_RATE?: number;
}

class CorsConfigDto {
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBoolean(value))
  CORS_CREDENTIALS?: boolean;

  @IsString()
  @IsOptional()
  CORS_METHODS?: string;

  @IsString()
  @IsOptional()
  CORS_ALLOWED_HEADERS?: string;
}

class ThrottleConfigDto {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_TTL?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  THROTTLE_LIMIT?: number;
}

class SwaggerConfigDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBooleanDefaultTrue(value))
  SWAGGER_ENABLED?: boolean;

  @IsString()
  @IsOptional()
  SWAGGER_TITLE?: string;

  @IsString()
  @IsOptional()
  SWAGGER_DESCRIPTION?: string;

  @IsString()
  @IsOptional()
  SWAGGER_VERSION?: string;

  @IsString()
  @IsOptional()
  SWAGGER_PATH?: string;
}

class HealthConfigDto {
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBooleanDefaultTrue(value))
  HEALTH_CHECK_ENABLED?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBooleanDefaultTrue(value))
  HEALTH_CHECK_DATABASE_ENABLED?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => transformToBooleanDefaultTrue(value))
  HEALTH_CHECK_REDIS_ENABLED?: boolean;
}

class LogConfigDto {
  @IsIn(['error', 'warn', 'info', 'debug', 'verbose'])
  @IsOptional()
  LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';

  @IsIn(['json', 'simple'])
  @IsOptional()
  LOG_FORMAT?: 'json' | 'simple';
}

class EnvironmentVariables
  extends AppConfigDto
  implements
    DatabaseConfigDto,
    CacheConfigDto,
    SentryConfigDto,
    CorsConfigDto,
    ThrottleConfigDto,
    SwaggerConfigDto,
    HealthConfigDto,
    LogConfigDto
{
  // Database
  DATABASE_TYPE: 'postgres' = 'postgres';
  DATABASE_HOST: string = 'localhost';
  DATABASE_PORT: number = 5432;
  DATABASE_USERNAME: string = 'postgres';
  DATABASE_PASSWORD: string = '';
  DATABASE_NAME: string = '';

  DATABASE_SYNCHRONIZE?: boolean;
  DATABASE_LOGGING?: boolean;
  DATABASE_SSL?: boolean;

  // Cache
  VALKEY_CLUSTER_HOST?: string;
  VALKEY_CLUSTER_PORT?: number;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  REDIS_DB?: number;
  CACHE_TTL?: number;

  // Sentry
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
  SENTRY_TRACES_SAMPLE_RATE?: number;
  SENTRY_PROFILES_SAMPLE_RATE?: number;

  // CORS
  CORS_ORIGIN?: string;
  CORS_CREDENTIALS?: boolean;
  CORS_METHODS?: string;
  CORS_ALLOWED_HEADERS?: string;

  // Throttle
  THROTTLE_TTL?: number;
  THROTTLE_LIMIT?: number;

  // Swagger
  SWAGGER_ENABLED?: boolean;
  SWAGGER_TITLE?: string;
  SWAGGER_DESCRIPTION?: string;
  SWAGGER_VERSION?: string;
  SWAGGER_PATH?: string;

  // Health
  HEALTH_CHECK_ENABLED?: boolean;
  HEALTH_CHECK_DATABASE_ENABLED?: boolean;
  HEALTH_CHECK_REDIS_ENABLED?: boolean;

  // Log
  LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  LOG_FORMAT?: 'json' | 'simple';
}

function getFieldSuggestion(fieldName: string, value: any): string {
  const suggestions: Record<string, string> = {
    APP_PORT: 'Set APP_PORT to a valid port number between 1-65535 (e.g., 3000)',
    DATABASE_PORT: 'Set DATABASE_PORT to a valid port number (e.g., 5432 for PostgreSQL)',
    DATABASE_HOST: 'Set DATABASE_HOST to your database server address (e.g., localhost)',
    DATABASE_USERNAME: 'Set DATABASE_USERNAME to your database username',
    DATABASE_PASSWORD: 'Set DATABASE_PASSWORD to your database password',
    DATABASE_NAME: 'Set DATABASE_NAME to your database name',
    REDIS_PORT:
      'Set REDIS_PORT to a valid port number (e.g., 6379) or leave empty to disable Redis',
    VALKEY_CLUSTER_PORT:
      'Set VALKEY_CLUSTER_PORT to a valid port number or leave empty to disable Valkey',
    NODE_ENV: 'Set NODE_ENV to one of: development, production, test',
    LOG_LEVEL: 'Set LOG_LEVEL to one of: error, warn, info, debug, verbose',
    LOG_FORMAT: 'Set LOG_FORMAT to either "json" or "simple"',
  };

  return (
    suggestions[fieldName] ||
    `Check the value for ${fieldName} and ensure it meets the validation requirements`
  );
}

export function validateConfiguration(config: Record<string, unknown>) {
  try {
    const validatedConfig = plainToInstance(EnvironmentVariables, config, {
      enableImplicitConversion: true,
    });

    const errors = validateSync(validatedConfig, {
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const errorMessages = errors.map((error) => {
        const constraints = error.constraints ? Object.values(error.constraints) : [];
        const currentValue = error.value !== undefined ? error.value : 'undefined';
        const suggestion = getFieldSuggestion(error.property, error.value);

        return [
          `${error.property}: ${constraints.join(', ')}`,
          `  Current value: "${currentValue}"`,
          `  Suggestion: ${suggestion}`,
        ].join('\n');
      });

      const errorMessage = [
        'Configuration validation failed:',
        '',
        ...errorMessages,
        '',
        'Please check your .env file and ensure all required environment variables are properly set.',
      ].join('\n');

      throw new Error(errorMessage);
    }

    return validatedConfig;
  } catch (error) {
    // If it's a transformation error, provide a more helpful message
    if (error instanceof Error && error.message.includes('Cannot convert')) {
      throw new Error(
        `Configuration transformation failed: ${error.message}\n\nPlease check your .env file for invalid values.`,
      );
    }

    // Re-throw other errors as-is
    throw error;
  }
}
