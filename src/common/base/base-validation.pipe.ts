import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Type,
} from '@nestjs/common';
import { validate, ValidationError } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export interface BaseValidationOptions {
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
  transform?: boolean;
  skipMissingProperties?: boolean;
  forbidUnknownValues?: boolean;
  groups?: string[];
  customErrorMessages?: Record<string, string>;
  transformValidationError?: (errors: ValidationError[]) => any;
}

export interface BaseValidationErrorResponse {
  message: string;
  errors: ValidationErrorDetail[];
  statusCode: number;
}

export interface ValidationErrorDetail {
  property: string;
  value: any;
  constraints: Record<string, string>;
  children?: ValidationErrorDetail[];
}

@Injectable()
export class BaseValidationPipe implements PipeTransform<any> {
  protected readonly options: BaseValidationOptions;

  constructor(options: BaseValidationOptions = {}) {
    this.options = {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      skipMissingProperties: false,
      forbidUnknownValues: true,
      ...options,
    };
  }

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!this.shouldValidate(metatype)) {
      return value;
    }

    const object = plainToInstance(metatype!, value);
    const validationOptions = this.buildValidationOptions();
    const errors = await validate(object, validationOptions);

    if (errors.length > 0) {
      const errorResponse = this.buildErrorResponse(errors);
      throw new BadRequestException(errorResponse);
    }

    return object;
  }

  protected shouldValidate(metatype?: Type<any>): boolean {
    if (!metatype) {
      return false;
    }

    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  protected buildValidationOptions() {
    const { customErrorMessages, transformValidationError, ...validationOptions } = this.options;
    return validationOptions;
  }

  protected buildErrorResponse(errors: ValidationError[]): BaseValidationErrorResponse {
    const errorDetails = this.options.transformValidationError
      ? this.options.transformValidationError(errors)
      : this.buildErrorDetails(errors);

    return {
      message: this.getErrorMessage(errors),
      errors: errorDetails,
      statusCode: 400,
    };
  }

  protected getErrorMessage(errors: ValidationError[]): string {
    const firstError = errors[0];
    const property = firstError?.property;

    // Check for custom error message
    if (property && this.options.customErrorMessages?.[property]) {
      return this.options.customErrorMessages[property];
    }

    // Default validation message
    return 'Validation failed';
  }

  protected buildErrorDetails(errors: ValidationError[]): ValidationErrorDetail[] {
    return errors.map((error) => this.mapValidationError(error));
  }

  protected mapValidationError(error: ValidationError): ValidationErrorDetail {
    const detail: ValidationErrorDetail = {
      property: error.property,
      value: error.value,
      constraints: error.constraints || {},
    };

    // Handle nested validation errors
    if (error.children && error.children.length > 0) {
      detail.children = error.children.map((child) => this.mapValidationError(child));
    }

    return detail;
  }

  /**
   * Create a validation pipe with custom options
   */
  static create(options: BaseValidationOptions = {}): BaseValidationPipe {
    return new BaseValidationPipe(options);
  }

  /**
   * Create a validation pipe for groups
   */
  static forGroups(groups: string[], options: BaseValidationOptions = {}): BaseValidationPipe {
    return new BaseValidationPipe({
      ...options,
      groups,
    });
  }
}
