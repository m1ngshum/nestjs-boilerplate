import { Injectable } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { ConfigurationService } from '../config/configuration.service';
import { LoggerService } from '../logger/logger.service';

export interface SentryContext {
  [key: string]: any;
}

@Injectable()
export class SentryService {
  private isEnabled: boolean;

  constructor(
    private configService: ConfigurationService,
    private logger: LoggerService,
  ) {
    this.isEnabled = this.configService.sentry.enabled;
    this.logger.setContext(SentryService.name);
  }

  /**
   * Capture an exception
   */
  captureException(exception: any, context?: SentryContext): string | undefined {
    if (!this.isEnabled) {
      this.logger.debug('Sentry disabled, not capturing exception');
      return undefined;
    }

    try {
      if (context) {
        Sentry.withScope((scope) => {
          Object.keys(context).forEach((key) => {
            scope.setContext(key, context[key]);
          });
          return Sentry.captureException(exception);
        });
      }

      return Sentry.captureException(exception);
    } catch (error) {
      this.logger.error('Failed to capture exception with Sentry:', error);
      return undefined;
    }
  }

  /**
   * Capture a message
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: SentryContext,
  ): string | undefined {
    if (!this.isEnabled) {
      this.logger.debug('Sentry disabled, not capturing message');
      return undefined;
    }

    try {
      if (context) {
        return Sentry.withScope((scope) => {
          Object.keys(context).forEach((key) => {
            scope.setContext(key, context[key]);
          });
          return Sentry.captureMessage(message, level);
        });
      }

      return Sentry.captureMessage(message, level);
    } catch (error) {
      this.logger.error('Failed to capture message with Sentry:', error);
      return undefined;
    }
  }

  /**
   * Set tag
   */
  setTag(key: string, value: string): void {
    if (!this.isEnabled) {
      return;
    }

    try {
      Sentry.setTag(key, value);
    } catch (error) {
      this.logger.error('Failed to set tag in Sentry:', error);
    }
  }

  /**
   * Set context
   */
  setContext(name: string, context: SentryContext): void {
    if (!this.isEnabled) {
      return;
    }

    try {
      Sentry.setContext(name, context);
    } catch (error) {
      this.logger.error('Failed to set context in Sentry:', error);
    }
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.isEnabled) {
      return;
    }

    try {
      Sentry.addBreadcrumb(breadcrumb);
    } catch (error) {
      this.logger.error('Failed to add breadcrumb to Sentry:', error);
    }
  }

  /**
   * Start a transaction (if available in Sentry version)
   */
  startTransaction(context: any): any {
    if (!this.isEnabled) {
      return undefined;
    }

    try {
      // Note: startTransaction may not be available in all Sentry versions
      if (typeof (Sentry as any).startTransaction === 'function') {
        return (Sentry as any).startTransaction(context);
      }
      return undefined;
    } catch (error) {
      this.logger.error('Failed to start transaction in Sentry:', error);
      return undefined;
    }
  }

  /**
   * Flush pending events
   */
  async flush(timeout?: number): Promise<boolean> {
    if (!this.isEnabled) {
      return true;
    }

    try {
      return await Sentry.flush(timeout);
    } catch (error) {
      this.logger.error('Failed to flush Sentry events:', error);
      return false;
    }
  }

  /**
   * Close Sentry client
   */
  async close(timeout?: number): Promise<boolean> {
    if (!this.isEnabled) {
      return true;
    }

    try {
      return await Sentry.close(timeout);
    } catch (error) {
      this.logger.error('Failed to close Sentry client:', error);
      return false;
    }
  }
}
