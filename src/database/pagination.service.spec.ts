import { Test, TestingModule } from '@nestjs/testing';
import { MikroORM, EntityRepository } from '@mikro-orm/core';
import { PaginationService } from './pagination.service';
import { BaseEntity } from './entities/base.entity';

describe('PaginationService', () => {
  let service: PaginationService;
  let orm: MikroORM;

  const mockRepository = {
    count: jest.fn(),
    find: jest.fn(),
  };

  const mockORM = {
    em: {
      fork: jest.fn().mockReturnValue({
        getRepository: jest.fn().mockReturnValue(mockRepository),
      }),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaginationService,
        {
          provide: MikroORM,
          useValue: mockORM,
        },
      ],
    }).compile();

    service = module.get<PaginationService>(PaginationService);
    orm = module.get<MikroORM>(MikroORM);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('paginateRepository', () => {
    const mockUsers = [
      { id: '1', email: 'user1@example.com', createdAt: new Date() },
      { id: '2', email: 'user2@example.com', createdAt: new Date() },
    ];

    beforeEach(() => {
      mockRepository.count.mockResolvedValue(10);
      mockRepository.find.mockResolvedValue(mockUsers);
    });

    it('should paginate with default options', async () => {
      const result = await service.paginateRepository(mockRepository as any);

      expect(result).toEqual({
        data: mockUsers,
        pagination: {
          page: 1,
          limit: 10,
          total: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          nextPage: null,
          previousPage: null,
        },
      });

      expect(mockRepository.count).toHaveBeenCalledWith({});
      expect(mockRepository.find).toHaveBeenCalledWith({}, {
        limit: 10,
        offset: 0,
        orderBy: { createdAt: 'DESC' },
      });
    });

    it('should paginate with custom options', async () => {
      const options = {
        page: 2,
        limit: 5,
        sortBy: 'email',
        sortOrder: 'ASC' as const,
      };

      await service.paginateRepository(mockRepository as any, options);

      expect(mockRepository.find).toHaveBeenCalledWith({}, {
        limit: 5,
        offset: 5,
        orderBy: { email: 'ASC' },
      });
    });

    it('should handle search functionality', async () => {
      const options = {
        search: 'john',
        searchFields: ['email', 'firstName'],
      };

      await service.paginateRepository(mockRepository as any, options);

      expect(mockRepository.count).toHaveBeenCalledWith({
        $or: [
          { email: { $ilike: '%john%' } },
          { firstName: { $ilike: '%john%' } },
        ],
      });
    });

    it('should handle filters', async () => {
      const options = {
        filters: {
          status: 'active',
          role: { operator: 'in', value: ['admin', 'user'] },
        },
      };

      await service.paginateRepository(mockRepository as any, options);

      expect(mockRepository.count).toHaveBeenCalledWith({
        status: 'active',
        role: { $in: ['admin', 'user'] },
      });
    });

    it('should calculate pagination metadata correctly', async () => {
      mockRepository.count.mockResolvedValue(25);
      
      const options = { page: 2, limit: 10 };
      const result = await service.paginateRepository(mockRepository as any, options);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
        nextPage: 3,
        previousPage: 1,
      });
    });

    it('should enforce maximum limit', async () => {
      const options = { limit: 200 }; // Above max of 100

      await service.paginateRepository(mockRepository as any, options);

      expect(mockRepository.find).toHaveBeenCalledWith({}, expect.objectContaining({
        limit: 100,
      }));
    });

    it('should enforce minimum page number', async () => {
      const options = { page: -1 };

      await service.paginateRepository(mockRepository as any, options);

      expect(mockRepository.find).toHaveBeenCalledWith({}, expect.objectContaining({
        offset: 0, // page 1
      }));
    });
  });

  describe('paginate', () => {
    it('should create forked entity manager and call paginateRepository', async () => {
      const mockUsers = [{ id: '1', email: 'test@example.com' }];
      mockRepository.count.mockResolvedValue(1);
      mockRepository.find.mockResolvedValue(mockUsers);

      const result = await service.paginate(BaseEntity as any, { page: 1, limit: 10 });

      expect(mockORM.em.fork).toHaveBeenCalled();
      expect(result.data).toEqual(mockUsers);
    });
  });

  describe('paginateCursor', () => {
    const mockUsers = [
      { id: '1', email: 'user1@example.com' },
      { id: '2', email: 'user2@example.com' },
      { id: '3', email: 'user3@example.com' },
    ];

    beforeEach(() => {
      mockRepository.find.mockResolvedValue(mockUsers);
    });

    it('should paginate with cursor', async () => {
      const options = {
        cursor: '1',
        limit: 2,
        cursorField: 'id',
        sortOrder: 'ASC' as const,
      };

      const result = await service.paginateCursor(mockRepository as any, options);

      expect(result).toEqual({
        data: [mockUsers[0], mockUsers[1]], // First 2 items
        cursor: {
          next: '2', // ID of last item
          previous: '1',
          hasNext: true,
          hasPrevious: true,
        },
      });

      expect(mockRepository.find).toHaveBeenCalledWith(
        { id: { $gt: '1' } },
        {
          limit: 3, // limit + 1 to check for next page
          orderBy: { id: 'ASC' },
        },
      );
    });

    it('should handle first page (no cursor)', async () => {
      mockRepository.find.mockResolvedValue([mockUsers[0], mockUsers[1]]);

      const result = await service.paginateCursor(mockRepository as any, {
        limit: 2,
      });

      expect(result.cursor.hasPrevious).toBe(false);
      expect(result.cursor.previous).toBeNull();
    });

    it('should handle last page (no more items)', async () => {
      mockRepository.find.mockResolvedValue([mockUsers[0]]); // Only 1 item, less than limit

      const result = await service.paginateCursor(mockRepository as any, {
        limit: 2,
      });

      expect(result.cursor.hasNext).toBe(false);
      expect(result.cursor.next).toBeNull();
    });

    it('should use DESC sort order', async () => {
      const options = {
        cursor: '3',
        sortOrder: 'DESC' as const,
      };

      await service.paginateCursor(mockRepository as any, options);

      expect(mockRepository.find).toHaveBeenCalledWith(
        { id: { $lt: '3' } },
        expect.objectContaining({
          orderBy: { id: 'DESC' },
        }),
      );
    });
  });

  describe('getPaginationInfo', () => {
    it('should return pagination metadata without data', async () => {
      const result = await service.getPaginationInfo(50, { page: 3, limit: 10 });

      expect(result).toEqual({
        page: 3,
        limit: 10,
        total: 50,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: true,
        nextPage: 4,
        previousPage: 2,
      });
    });

    it('should use default values', async () => {
      const result = await service.getPaginationInfo(20);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        total: 20,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
        nextPage: 2,
        previousPage: null,
      });
    });
  });
});