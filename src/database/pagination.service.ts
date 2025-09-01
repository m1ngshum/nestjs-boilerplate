import { Injectable } from '@nestjs/common';
import {
  EntityManager,
  EntityRepository,
  FindOptions,
  FilterQuery,
  MikroORM,
} from '@mikro-orm/postgresql';
import { InjectMikroORM } from '@mikro-orm/nestjs';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  searchFields?: string[];
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextPage: number | null;
    previousPage: number | null;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
}

@Injectable()
export class PaginationService {
  constructor(@InjectMikroORM('default') private readonly orm: MikroORM) {}

  /**
   * Default pagination options
   */
  private getDefaultOptions(): Required<
    Omit<PaginationOptions, 'search' | 'searchFields' | 'filters'>
  > {
    return {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    };
  }

  /**
   * Validate and normalize pagination options
   */
  private normalizeOptions(options: PaginationOptions): PaginationOptions {
    const defaults = this.getDefaultOptions();

    return {
      page: Math.max(1, options.page || defaults.page),
      limit: Math.min(100, Math.max(1, options.limit || defaults.limit)),
      sortBy: options.sortBy || defaults.sortBy,
      sortOrder: options.sortOrder || defaults.sortOrder,
      search: options.search,
      searchFields: options.searchFields,
      filters: options.filters,
    };
  }

  /**
   * Create pagination metadata
   */
  private createPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      nextPage: hasNextPage ? page + 1 : null,
      previousPage: hasPreviousPage ? page - 1 : null,
    };
  }

  /**
   * Build where conditions with search and filters
   */
  private buildWhereConditions<T extends object>(
    baseWhere: FilterQuery<T>,
    search?: string,
    searchFields?: string[],
    filters?: Record<string, any>,
  ): FilterQuery<T> {
    let whereConditions: FilterQuery<T> = { ...baseWhere };

    // Apply search
    if (search && searchFields && searchFields.length > 0) {
      const searchConditions = searchFields.map((field) => ({
        [field]: { $ilike: `%${search}%` },
      }));
      whereConditions = {
        ...whereConditions,
        $or: searchConditions,
      } as FilterQuery<T>;
    }

    // Apply filters
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            (whereConditions as any)[key] = { $in: value };
          } else if (typeof value === 'object' && value.operator) {
            (whereConditions as any)[key] = { [`$${value.operator}`]: value.value };
          } else {
            (whereConditions as any)[key] = value;
          }
        }
      });
    }

    return whereConditions;
  }

  /**
   * Paginate using EntityRepository
   */
  async paginateRepository<T extends object>(
    repository: EntityRepository<T>,
    options: PaginationOptions = {},
    where: FilterQuery<T> = {} as FilterQuery<T>,
  ): Promise<PaginatedResult<T>> {
    const normalizedOptions = this.normalizeOptions(options);
    const { page, limit, sortBy, sortOrder, search, searchFields, filters } = normalizedOptions;

    // Build where conditions
    const whereConditions = this.buildWhereConditions(where, search, searchFields, filters);

    // Get total count
    const total = await repository.count(whereConditions);

    // Get data with pagination
    const offset = (page! - 1) * limit!;
    const findOptions: FindOptions<T> = {
      limit: limit!,
      offset,
      orderBy: { [sortBy!]: sortOrder! } as any,
    };

    const data = await repository.find(whereConditions, findOptions);

    return {
      data,
      pagination: this.createPaginationMeta(page!, limit!, total),
    };
  }

  /**
   * Paginate using EntityManager and entity class
   */
  async paginate<T extends object>(
    entityClass: new () => T,
    options: PaginationOptions = {},
    where: FilterQuery<T> = {} as FilterQuery<T>,
  ): Promise<PaginatedResult<T>> {
    const em = this.orm.em.fork();
    const repository = em.getRepository(entityClass);
    return this.paginateRepository(repository, options, where);
  }

  /**
   * Create cursor-based pagination (for large datasets)
   */
  async paginateCursor<T extends object>(
    repository: EntityRepository<T>,
    options: {
      cursor?: string;
      limit?: number;
      cursorField?: string;
      sortOrder?: 'ASC' | 'DESC';
      where?: FilterQuery<T>;
    } = {},
  ): Promise<{
    data: T[];
    cursor: {
      next: string | null;
      previous: string | null;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }> {
    const {
      cursor,
      limit = 10,
      cursorField = 'id',
      sortOrder = 'ASC',
      where = {} as FilterQuery<T>,
    } = options;

    let whereConditions = { ...where };

    // Apply cursor condition
    if (cursor) {
      const operator = sortOrder === 'ASC' ? '$gt' : '$lt';
      (whereConditions as any)[cursorField] = { [operator]: cursor };
    }

    // Get data with limit + 1 to check if there's a next page
    const findOptions: FindOptions<T> = {
      limit: limit + 1,
      orderBy: { [cursorField]: sortOrder } as any,
    };

    const results = await repository.find(whereConditions, findOptions);
    const hasNext = results.length > limit;
    const data = hasNext ? results.slice(0, -1) : results;

    const nextCursor =
      hasNext && data.length > 0 ? (data[data.length - 1] as any)[cursorField] : null;

    const previousCursor = cursor || null;

    return {
      data,
      cursor: {
        next: nextCursor,
        previous: previousCursor,
        hasNext,
        hasPrevious: !!cursor,
      },
    };
  }

  /**
   * Get pagination info without data (useful for counts)
   */
  async getPaginationInfo(
    total: number,
    options: Pick<PaginationOptions, 'page' | 'limit'> = {},
  ): Promise<PaginationMeta> {
    const { page = 1, limit = 10 } = options;
    return this.createPaginationMeta(page, limit, total);
  }
}
