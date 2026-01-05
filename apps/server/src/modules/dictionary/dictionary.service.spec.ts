import { Test, TestingModule } from "@nestjs/testing";
import Redis from "ioredis";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { DictionaryService } from "./dictionary.service";

describe("DictionaryService", () => {
  let service: DictionaryService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisClient: jest.Mocked<Redis>;

  const mockDictionary = {
    id: 1,
    type: "gender",
    key: "MALE",
    value: { label: "男", color: "blue" },
    label: "男",
    description: "性别-男",
    sort: 1,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      soft: {
        dictionary: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
        },
      },
      dictionary: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((fns: unknown[]) => Promise.all(fns)),
      genericSoftDelete: jest.fn(),
    };

    const mockRedisClient = {
      get: jest.fn(),
      setex: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DictionaryService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    service = module.get<DictionaryService>(DictionaryService);
    prismaService = module.get(PrismaService);
    redisClient = module.get(REDIS_CLIENT);
  });

  describe("findAll", () => {
    it("should return paginated dictionaries", async () => {
      const mockDictionaries = [mockDictionary];
      prismaService.soft.dictionary.findMany.mockResolvedValue(
        mockDictionaries,
      );
      prismaService.soft.dictionary.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockDictionaries);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should filter by type when provided", async () => {
      const mockDictionaries = [mockDictionary];
      prismaService.soft.dictionary.findMany.mockResolvedValue(
        mockDictionaries,
      );
      prismaService.soft.dictionary.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, type: "gender" });

      expect(prismaService.soft.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "gender" },
        skip: 0,
        take: 10,
        orderBy: [{ type: "asc" }, { sort: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("getMetaByType", () => {
    it("should return dictionary metadata", async () => {
      const mockMeta = [
        { key: "MALE", version: 1, configHash: "hash1" },
        { key: "FEMALE", version: 1, configHash: "hash2" },
      ];
      prismaService.soft.dictionary.findMany.mockResolvedValue(mockMeta);

      const result = await service.getMetaByType({ type: "gender" });

      expect(result.data).toEqual(mockMeta);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 2,
        totalPages: 1,
      });
    });

    it("should filter by isEnabled when provided", async () => {
      prismaService.soft.dictionary.findMany.mockResolvedValue([]);

      await service.getMetaByType({ type: "gender", isEnabled: true });

      expect(prismaService.soft.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "gender", isEnabled: true },
        select: { key: true, version: true, configHash: true },
        orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("findByType", () => {
    it("should return cached data if available (array format)", async () => {
      const mockDict = {
        ...mockDictionary,
        createdAt: mockDictionary.createdAt.toISOString(),
        updatedAt: mockDictionary.updatedAt.toISOString(),
      };
      const cachedData = JSON.stringify([mockDict]);
      redisClient.get.mockResolvedValue(cachedData);

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual({
        data: [mockDict],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(redisClient.get).toHaveBeenCalledWith("dict:type:gender:enabled");
      expect(prismaService.soft.dictionary.findMany).not.toHaveBeenCalled();
    });

    it("should fetch from DB and cache if cache miss", async () => {
      redisClient.get.mockResolvedValue(null);
      prismaService.soft.dictionary.findMany.mockResolvedValue([
        mockDictionary,
      ]);
      redisClient.setex.mockResolvedValue("OK");

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual({
        data: [mockDictionary],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(prismaService.soft.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "gender", isEnabled: true },
        orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      });
      expect(redisClient.setex).toHaveBeenCalled();
    });

    it("should fallback to DB if cache fails", async () => {
      redisClient.get.mockRejectedValue(new Error("Redis error"));
      redisClient.setex.mockResolvedValue("OK");
      prismaService.soft.dictionary.findMany.mockResolvedValue([
        mockDictionary,
      ]);

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual({
        data: [mockDictionary],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(prismaService.soft.dictionary.findMany).toHaveBeenCalled();
    });

    it("should return cached data if available (paginated format)", async () => {
      const mockDict = {
        ...mockDictionary,
        createdAt: mockDictionary.createdAt.toISOString(),
        updatedAt: mockDictionary.updatedAt.toISOString(),
      };
      // Cache returns data in paginated format (not array)
      const cachedData = JSON.stringify({
        data: [mockDict],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      redisClient.get.mockResolvedValue(cachedData);

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual({
        data: [mockDict],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(prismaService.soft.dictionary.findMany).not.toHaveBeenCalled();
    });

    it("should continue without throwing when cache write fails", async () => {
      redisClient.get.mockResolvedValue(null);
      prismaService.soft.dictionary.findMany.mockResolvedValue([
        mockDictionary,
      ]);
      redisClient.setex.mockRejectedValue(new Error("Redis write error"));

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual({
        data: [mockDictionary],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(prismaService.soft.dictionary.findMany).toHaveBeenCalled();
      expect(redisClient.setex).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return dictionary by id", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );

      const result = await service.findOne(1);

      expect(result).toEqual(mockDictionary);
    });

    it("should throw DICT_NOT_FOUND if dictionary does not exist", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.DICT_NOT_FOUND,
      });
    });
  });

  describe("findByTypeAndKey", () => {
    it("should return dictionary by type and key", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );

      const result = await service.findByTypeAndKey("gender", "MALE");

      expect(result).toEqual(mockDictionary);
      expect(prismaService.soft.dictionary.findUnique).toHaveBeenCalledWith({
        where: {
          type_key: { type: "gender", key: "MALE" },
        },
      });
    });

    it("should throw DICT_NOT_FOUND if dictionary does not exist", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(null);

      await expect(
        service.findByTypeAndKey("gender", "UNKNOWN"),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.DICT_NOT_FOUND,
      });
    });
  });

  describe("create", () => {
    it("should create a new dictionary", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(null);
      prismaService.dictionary.create.mockResolvedValue(mockDictionary);
      redisClient.del.mockResolvedValue(2);

      const result = await service.create({
        type: "gender",
        key: "MALE",
        value: { label: "男", color: "blue" },
        label: "男",
        description: "性别-男",
        sort: 1,
        isEnabled: true,
      });

      expect(result).toEqual(mockDictionary);
      expect(prismaService.dictionary.create).toHaveBeenCalled();
    });

    it("should throw DICT_KEY_EXISTS if type+key already exists (active record)", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );

      await expect(
        service.create({
          type: "gender",
          key: "MALE",
          value: { label: "男" },
          label: "男",
        }),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.DICT_KEY_EXISTS,
      });
    });

    it("should allow creating dictionary with same type+key if old one is soft-deleted", async () => {
      // soft.dictionary.findUnique 查不到软删除的记录，返回 null
      prismaService.soft.dictionary.findUnique.mockResolvedValue(null);
      prismaService.dictionary.create.mockResolvedValue(mockDictionary);
      redisClient.del.mockResolvedValue(2);

      const result = await service.create({
        type: "gender",
        key: "MALE",
        value: { label: "男" },
        label: "男",
      });

      expect(result).toEqual(mockDictionary);
      expect(prismaService.soft.dictionary.findUnique).toHaveBeenCalled();
    });

    it("should invalidate cache after creation", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(null);
      prismaService.dictionary.create.mockResolvedValue(mockDictionary);
      redisClient.del.mockResolvedValue(2);

      await service.create({
        type: "gender",
        key: "MALE",
        value: { label: "男" },
        label: "男",
      });

      expect(redisClient.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:all",
      );
    });
  });

  describe("update", () => {
    it("should update dictionary", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );
      prismaService.dictionary.update.mockResolvedValue({
        ...mockDictionary,
        label: "男性",
      });
      redisClient.keys.mockResolvedValue([]);

      const result = await service.update(1, { label: "男性" });

      expect(result.label).toBe("男性");
      expect(prismaService.dictionary.update).toHaveBeenCalled();
    });

    it("should invalidate cache after update", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );
      prismaService.dictionary.update.mockResolvedValue(mockDictionary);
      redisClient.del.mockResolvedValue(2);

      await service.update(1, { label: "男性" });

      expect(redisClient.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:all",
      );
    });
  });

  describe("remove", () => {
    it("should soft delete dictionary", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );
      prismaService.genericSoftDelete.mockResolvedValue(undefined);
      redisClient.keys.mockResolvedValue([]);

      const result = await service.remove(1);

      expect(result.message).toBe("Dictionary deleted successfully");
      expect(prismaService.genericSoftDelete).toHaveBeenCalledWith(
        "Dictionary",
        1,
        expect.objectContaining({
          reason: "Deleted by admin",
        }),
      );
    });

    it("should invalidate cache after deletion", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(
        mockDictionary,
      );
      prismaService.genericSoftDelete.mockResolvedValue(undefined);
      redisClient.del.mockResolvedValue(2);

      await service.remove(1);

      expect(redisClient.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:all",
      );
    });
  });

  describe("bulkCreate", () => {
    it("should create multiple dictionaries in transaction", async () => {
      const items = [
        {
          type: "gender",
          key: "MALE",
          value: { label: "男" },
          label: "男",
        },
        {
          type: "gender",
          key: "FEMALE",
          value: { label: "女" },
          label: "女",
        },
      ];

      const mockCreated = [
        { ...mockDictionary, key: "MALE" },
        { ...mockDictionary, key: "FEMALE" },
      ];

      prismaService.$transaction.mockResolvedValue(mockCreated);
      redisClient.keys.mockResolvedValue([]);

      const result = await service.bulkCreate(items);

      expect(result.count).toBe(2);
      expect(result.data).toEqual(mockCreated);
    });

    it("should throw DICT_KEY_EXISTS if duplicate keys in bulk", async () => {
      const items = [
        { type: "gender", key: "MALE", value: "男", label: "男" },
        { type: "gender", key: "MALE", value: "男2", label: "男2" }, // duplicate
      ];

      await expect(service.bulkCreate(items)).rejects.toMatchObject({
        businessCode: ApiErrorCode.DICT_KEY_EXISTS,
      });
    });

    it("should invalidate cache for all types after bulk create", async () => {
      const items = [
        { type: "gender", key: "MALE", value: "男", label: "男" },
        { type: "status", key: "ACTIVE", value: "启用", label: "启用" },
      ];

      prismaService.$transaction.mockResolvedValue([
        mockDictionary,
        mockDictionary,
      ]);
      redisClient.del.mockResolvedValue(2);

      await service.bulkCreate(items);

      // Should call del for both types (each type has 2 keys: enabled and all)
      expect(redisClient.del).toHaveBeenCalledTimes(2);
      expect(redisClient.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:all",
      );
      expect(redisClient.del).toHaveBeenCalledWith(
        "dict:type:status:enabled",
        "dict:type:status:all",
      );
    });

    it("should test findByType with isEnabled=false", async () => {
      redisClient.get.mockResolvedValue(null);
      const disabledDict = { ...mockDictionary, isEnabled: false };
      prismaService.soft.dictionary.findMany.mockResolvedValue([disabledDict]);
      redisClient.setex.mockResolvedValue("OK");

      const result = await service.findByType({
        type: "gender",
        isEnabled: false,
      });

      expect(result).toEqual({
        data: [disabledDict],
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(prismaService.soft.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "gender", isEnabled: false },
        orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("invalidateAllCache", () => {
    it("should delete all dictionary cache keys", async () => {
      const cacheKeys = ["dict:type:gender:enabled", "dict:type:status:all"];
      redisClient.keys.mockResolvedValue(cacheKeys);
      redisClient.del.mockResolvedValue(2);

      await service.invalidateAllCache();

      expect(redisClient.keys).toHaveBeenCalledWith("dict:type:*");
      expect(redisClient.del).toHaveBeenCalledWith(...cacheKeys);
    });

    it("should not call del when no cache keys exist", async () => {
      redisClient.keys.mockResolvedValue([]);

      await service.invalidateAllCache();

      expect(redisClient.keys).toHaveBeenCalledWith("dict:type:*");
      expect(redisClient.del).not.toHaveBeenCalled();
    });

    it("should handle cache invalidation error gracefully", async () => {
      redisClient.keys.mockRejectedValue(new Error("Redis error"));

      // Should not throw
      await expect(service.invalidateAllCache()).resolves.not.toThrow();
    });
  });

  describe("cache invalidation on error", () => {
    it("should handle cache invalidation failure in create", async () => {
      prismaService.soft.dictionary.findUnique.mockResolvedValue(null);
      prismaService.dictionary.create.mockResolvedValue(mockDictionary);
      redisClient.del.mockRejectedValue(new Error("Redis error"));

      // Should still return result even if cache invalidation fails
      const result = await service.create({
        type: "gender",
        key: "MALE",
        value: { label: "男" },
        label: "男",
      });

      expect(result).toEqual(mockDictionary);
    });
  });
});
