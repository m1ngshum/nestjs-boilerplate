import { SetMetadata } from '@nestjs/common';

export const LOG_METADATA_KEY = 'log_metadata';

export interface LogOptions {
  level?: 'debug' | 'info' | 'warn' | 'error';
  message?: string;
  logArgs?: boolean;
  logResult?: boolean;
  logErrors?: boolean;
  context?: string;
}

/**
 * Decorator to enable automatic logging for methods
 */
export const Log = (options: LogOptions = {}): MethodDecorator => {
  const defaultOptions: LogOptions = {
    level: 'info',
    logArgs: false,
    logResult: false,
    logErrors: true,
    ...options,
  };

  return SetMetadata(LOG_METADATA_KEY, defaultOptions);
};

/**
 * Decorator to log method arguments
 */
export const LogArgs = (level: LogOptions['level'] = 'debug'): MethodDecorator => {
  return Log({ level, logArgs: true });
};

/**
 * Decorator to log method results
 */
export const LogResult = (level: LogOptions['level'] = 'debug'): MethodDecorator => {
  return Log({ level, logResult: true });
};

/**
 * Decorator to log method execution time
 */
export const LogPerformance = (message?: string): MethodDecorator => {
  return Log({ level: 'info', message, logResult: false });
};

/**
 * Decorator to log security-related operations
 */
export const LogSecurity = (message?: string): MethodDecorator => {
  return Log({ level: 'warn', message, context: 'Security' });
};

/**
 * Decorator to log business operations
 */
export const LogBusiness = (message?: string): MethodDecorator => {
  return Log({ level: 'info', message, context: 'Business' });
};