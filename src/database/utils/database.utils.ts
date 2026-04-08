import { EntityManager, FilterQuery, FindOptions } from '@mikro-orm/core';
import { BaseEntity } from '../entities/base.entity';

/**
 * Soft delete utility functions
 */
export class SoftDeleteUtils {
  /**
   * Add soft delete filter to find options
   */
  static addSoftDeleteFilter<T extends BaseEntity>(
    options: FindOptions<T> = {},
    includeSoftDeleted: boolean = false,
  ): FindOptions<T> {
    if (!includeSoftDeleted) {
      const filters = options.filters || {};
      return {
        ...options,
        filters: {
          ...(filters as any),
          softDelete: { deletedAt: null },
        },
      };
    }
    return options;
  }

  /**
   * Add soft delete condition to where clause
   */
  static addSoftDeleteWhere<T extends BaseEntity>(
    where: FilterQuery<T>,
    includeSoftDeleted: boolean = false,
  ): FilterQuery<T> {
    if (!includeSoftDeleted) {
      return {
        ...(where as any),
        deletedAt: null,
      } as FilterQuery<T>;
    }
    return where;
  }

  /**
   * Soft delete entities
   */
  static async softDelete<T extends BaseEntity>(
    em: EntityManager,
    entities: T | T[],
  ): Promise<void> {
    const entitiesArray = Array.isArray(entities) ? entities : [entities];

    entitiesArray.forEach((entity) => {
      (entity as any).deletedAt = new Date();
    });

    await em.flush();
  }

  /**
   * Restore soft deleted entities
   */
  static async restore<T extends BaseEntity>(em: EntityManager, entities: T | T[]): Promise<void> {
    const entitiesArray = Array.isArray(entities) ? entities : [entities];

    entitiesArray.forEach((entity) => {
      (entity as any).deletedAt = undefined;
    });

    await em.flush();
  }
}

/**
 * Transaction utility functions
 */
export class TransactionUtils {
  /**
   * Execute multiple operations in a transaction
   */
  static async executeInTransaction<T>(
    em: EntityManager,
    operations: (transactionalEm: EntityManager) => Promise<T>,
  ): Promise<T> {
    return em.transactional(operations);
  }

  /**
   * Execute with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Wait before retrying
        await new Promise((resolve) => global.setTimeout(resolve, delay * attempt));
      }
    }

    throw lastError!;
  }
}

/**
 * Query building utilities
 */
export class QueryUtils {
  /**
   * Build ILIKE search condition for multiple fields
   */
  static buildSearchCondition<T>(searchTerm: string, fields: (keyof T)[]): FilterQuery<T> {
    if (!searchTerm || fields.length === 0) {
      return {} as FilterQuery<T>;
    }

    const conditions = fields.map((field) => ({
      [field]: { $ilike: `%${searchTerm}%` },
    }));

    return { $or: conditions } as FilterQuery<T>;
  }

  /**
   * Build date range condition
   */
  static buildDateRangeCondition<T>(
    field: keyof T,
    startDate?: Date,
    endDate?: Date,
  ): FilterQuery<T> {
    const condition: any = {};

    if (startDate && endDate) {
      condition[field] = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      condition[field] = { $gte: startDate };
    } else if (endDate) {
      condition[field] = { $lte: endDate };
    }

    return condition as FilterQuery<T>;
  }

  /**
   * Build IN condition for array values
   */
  static buildInCondition<T>(field: keyof T, values: any[]): FilterQuery<T> {
    if (!values || values.length === 0) {
      return {} as FilterQuery<T>;
    }

    return { [field]: { $in: values } } as FilterQuery<T>;
  }

  /**
   * Combine multiple filter conditions
   */
  static combineConditions<T>(...conditions: FilterQuery<T>[]): FilterQuery<T> {
    return conditions.reduce(
      (combined, condition) => ({
        ...combined,
        ...condition,
      }),
      {} as FilterQuery<T>,
    );
  }
}

/**
 * Validation utilities
 */
export class ValidationUtils {
  /**
   * Validate UUID format
   */
  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize string for database storage
   */
  static sanitizeString(input: string): string {
    return input.trim().replace(/\s+/g, ' ');
  }

  /**
   * Validate pagination parameters
   */
  static validatePaginationParams(
    page: number,
    limit: number,
  ): {
    page: number;
    limit: number;
  } {
    return {
      page: Math.max(1, Math.floor(page)),
      limit: Math.min(100, Math.max(1, Math.floor(limit))),
    };
  }
}

/**
 * Performance utilities
 */
export class PerformanceUtils {
  /**
   * Batch process entities to avoid memory issues
   */
  static async batchProcess<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await processor(batch);
    }
  }

  /**
   * Measure execution time
   */
  static async measureTime<T>(
    operation: () => Promise<T>,
    label?: string,
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await operation();
    const duration = Date.now() - start;

    if (label) {
      console.log(`${label} took ${duration}ms`);
    }

    return { result, duration };
  }

  /**
   * Create optimized find options for large datasets
   */
  static createOptimizedFindOptions<T>(limit: number = 1000, fields?: (keyof T)[]): FindOptions<T> {
    const options: FindOptions<T> = {
      limit,
      // Disable lazy loading for better performance
      populate: false,
    };

    if (fields && fields.length > 0) {
      options.fields = fields as any;
    }

    return options;
  }
}
