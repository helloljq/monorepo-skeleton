import { Test, TestingModule } from "@nestjs/testing";
import Redis from "ioredis";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { DictionaryService } from "./dictionary.service";

describe("DictionaryService", () => {
  let service: DictionaryService;
  let prisma: jest.Mocked<PrismaService>;
  let redis: jest.Mocked<Redis>;

  const now = new Date();
  const dictPublicId = "550e8400-e29b-41d4-a716-446655440500";
  const dictInternalId = 1;

  const mockDictionaryRecord = {
    id: dictInternalId,
    publicId: dictPublicId,
    type: "gender",
    key: "MALE",
    value: { label: "男", color: "blue" } as never,
    label: "男",
    description: "性别-男",
    sort: 1,
    isEnabled: true,
    version: "1",
    configHash: "abc123",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  const dictionaryItem = {
    id: dictPublicId,
    type: "gender",
    key: "MALE",
    value: { label: "男", color: "blue" },
    label: "男",
    description: "性别-男",
    sort: 1,
    isEnabled: true,
    version: "1",
    configHash: "abc123",
    createdAt: now,
    updatedAt: now,
  };

  beforeEach(async () => {
    const mockPrisma: Partial<jest.Mocked<PrismaService>> = {
      soft: {
        dictionary: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
        },
      },
      dictionary: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
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
        { provide: PrismaService, useValue: mockPrisma },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
      ],
    }).compile();

    service = module.get(DictionaryService);
    prisma = module.get(PrismaService);
    redis = module.get(REDIS_CLIENT);
  });

  describe("findAll", () => {
    it("should return items and pagination", async () => {
      prisma.soft.dictionary.findMany.mockResolvedValue([mockDictionaryRecord]);
      prisma.soft.dictionary.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: [dictionaryItem],
        pagination: { total: 1, page: 1, pageSize: 10 },
      });
    });

    it("should filter by type when provided", async () => {
      prisma.soft.dictionary.findMany.mockResolvedValue([mockDictionaryRecord]);
      prisma.soft.dictionary.count.mockResolvedValue(1);

      await service.findAll({ page: 1, pageSize: 10, type: "gender" });

      expect(prisma.soft.dictionary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "gender" }),
        }),
      );
    });
  });

  describe("getMetaByType", () => {
    it("should return dictionary metadata list", async () => {
      const mockMeta = [
        { key: "MALE", version: "1", configHash: "hash1" },
        { key: "FEMALE", version: "1", configHash: "hash2" },
      ];
      prisma.soft.dictionary.findMany.mockResolvedValue(mockMeta as never);

      const result = await service.getMetaByType({ type: "gender" });

      expect(result).toEqual(mockMeta);
    });

    it("should filter by isEnabled when provided", async () => {
      prisma.soft.dictionary.findMany.mockResolvedValue([]);

      await service.getMetaByType({ type: "gender", isEnabled: true });

      expect(prisma.soft.dictionary.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "gender", isEnabled: true }),
          select: { key: true, version: true, configHash: true },
        }),
      );
    });
  });

  describe("findByType", () => {
    it("should return cached data if available (array format)", async () => {
      const cachedItem = {
        ...dictionaryItem,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      redis.get.mockResolvedValue(JSON.stringify([cachedItem]));

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual([cachedItem]);
      expect(redis.get).toHaveBeenCalledWith("dict:type:gender:enabled");
      expect(prisma.soft.dictionary.findMany).not.toHaveBeenCalled();
    });

    it("should fetch from DB and cache if cache miss", async () => {
      redis.get.mockResolvedValue(null);
      prisma.soft.dictionary.findMany.mockResolvedValue([mockDictionaryRecord]);
      redis.setex.mockResolvedValue("OK");

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual([dictionaryItem]);
      expect(prisma.soft.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "gender", isEnabled: true },
        orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      });
      expect(redis.setex).toHaveBeenCalled();
    });

    it("should fallback to DB if cache fails", async () => {
      redis.get.mockRejectedValue(new Error("Redis error"));
      redis.setex.mockResolvedValue("OK");
      prisma.soft.dictionary.findMany.mockResolvedValue([mockDictionaryRecord]);

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual([dictionaryItem]);
      expect(prisma.soft.dictionary.findMany).toHaveBeenCalled();
    });

    it("should return cached data if available (legacy {data, meta} format)", async () => {
      const cachedItem = {
        ...dictionaryItem,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      redis.get.mockResolvedValue(
        JSON.stringify({
          data: [cachedItem],
          meta: { total: 1, page: 1, limit: 1, totalPages: 1 },
        }),
      );

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual([cachedItem]);
      expect(prisma.soft.dictionary.findMany).not.toHaveBeenCalled();
    });

    it("should continue without throwing when cache write fails", async () => {
      redis.get.mockResolvedValue(null);
      prisma.soft.dictionary.findMany.mockResolvedValue([mockDictionaryRecord]);
      redis.setex.mockRejectedValue(new Error("Redis write error"));

      const result = await service.findByType({
        type: "gender",
        isEnabled: true,
      });

      expect(result).toEqual([dictionaryItem]);
      expect(prisma.soft.dictionary.findMany).toHaveBeenCalled();
      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe("findOne", () => {
    it("should return dictionary by publicId", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(mockDictionaryRecord);

      const result = await service.findOne(dictPublicId);

      expect(result).toEqual(dictionaryItem);
    });

    it("should throw DICT_NOT_FOUND if dictionary does not exist", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(null);

      await expect(service.findOne(dictPublicId)).rejects.toMatchObject({
        code: ApiErrorCode.DICT_NOT_FOUND,
      });
    });
  });

  describe("findByTypeAndKey", () => {
    it("should return dictionary by type and key", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(mockDictionaryRecord);

      const result = await service.findByTypeAndKey("gender", "MALE");

      expect(result).toEqual(dictionaryItem);
      expect(prisma.soft.dictionary.findUnique).toHaveBeenCalledWith({
        where: {
          type_key: { type: "gender", key: "MALE" },
        },
      });
    });

    it("should throw DICT_NOT_FOUND if dictionary does not exist", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(null);

      await expect(
        service.findByTypeAndKey("gender", "UNKNOWN"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.DICT_NOT_FOUND,
      });
    });
  });

  describe("create", () => {
    it("should create a new dictionary", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(null);
      prisma.dictionary.create.mockResolvedValue(mockDictionaryRecord);
      redis.del.mockResolvedValue(3);

      const result = await service.create({
        type: "gender",
        key: "MALE",
        value: { label: "男", color: "blue" },
        label: "男",
        description: "性别-男",
        sort: 1,
        isEnabled: true,
      });

      expect(result).toEqual(dictionaryItem);
      expect(redis.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:disabled",
        "dict:type:gender:all",
      );
    });

    it("should throw DICT_KEY_EXISTS if type+key already exists", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(mockDictionaryRecord);

      await expect(
        service.create({
          type: "gender",
          key: "MALE",
          value: { label: "男" },
          label: "男",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.DICT_KEY_EXISTS,
      });
    });
  });

  describe("update", () => {
    it("should update dictionary", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue({
        id: dictInternalId,
        type: "gender",
      } as never);
      prisma.dictionary.update.mockResolvedValue({
        ...mockDictionaryRecord,
        label: "男性",
      });
      redis.del.mockResolvedValue(3);

      const result = await service.update(dictPublicId, { label: "男性" });

      expect(result.label).toBe("男性");
      expect(redis.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:disabled",
        "dict:type:gender:all",
      );
    });

    it("should throw DICT_NOT_FOUND when dictionary is missing", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(null);

      await expect(
        service.update(dictPublicId, { label: "男性" }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.DICT_NOT_FOUND,
      });
    });
  });

  describe("remove", () => {
    it("should soft delete dictionary", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue({
        id: dictInternalId,
        type: "gender",
      } as never);
      prisma.genericSoftDelete.mockResolvedValue(undefined);
      redis.del.mockResolvedValue(3);

      const result = await service.remove(dictPublicId);

      expect(result.message).toBe("Dictionary deleted successfully");
      expect(prisma.genericSoftDelete).toHaveBeenCalledWith(
        "Dictionary",
        dictInternalId,
        expect.objectContaining({
          reason: "Deleted by admin",
        }),
      );
      expect(redis.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:disabled",
        "dict:type:gender:all",
      );
    });

    it("should throw DICT_NOT_FOUND when dictionary is missing", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(null);

      await expect(service.remove(dictPublicId)).rejects.toMatchObject({
        code: ApiErrorCode.DICT_NOT_FOUND,
      });
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

      const createdRecords = [
        { ...mockDictionaryRecord, key: "MALE" },
        { ...mockDictionaryRecord, key: "FEMALE" },
      ];

      prisma.$transaction.mockResolvedValue(createdRecords as never);
      redis.del.mockResolvedValue(3);

      const result = await service.bulkCreate(items);

      expect(result.count).toBe(2);
      expect(result.data).toEqual([
        { ...dictionaryItem, key: "MALE" },
        { ...dictionaryItem, key: "FEMALE" },
      ]);
    });

    it("should throw DICT_KEY_EXISTS if duplicate keys in bulk", async () => {
      const items = [
        { type: "gender", key: "MALE", value: "男", label: "男" },
        { type: "gender", key: "MALE", value: "男2", label: "男2" },
      ];

      await expect(service.bulkCreate(items)).rejects.toMatchObject({
        code: ApiErrorCode.DICT_KEY_EXISTS,
      });
    });

    it("should invalidate cache for all types after bulk create", async () => {
      const items = [
        { type: "gender", key: "MALE", value: "男", label: "男" },
        { type: "status", key: "ACTIVE", value: "启用", label: "启用" },
      ];

      prisma.$transaction.mockResolvedValue([
        mockDictionaryRecord,
        { ...mockDictionaryRecord, type: "status" },
      ] as never);
      redis.del.mockResolvedValue(3);

      await service.bulkCreate(items);

      expect(redis.del).toHaveBeenCalledWith(
        "dict:type:gender:enabled",
        "dict:type:gender:disabled",
        "dict:type:gender:all",
      );
      expect(redis.del).toHaveBeenCalledWith(
        "dict:type:status:enabled",
        "dict:type:status:disabled",
        "dict:type:status:all",
      );
    });

    it("should support findByType with isEnabled=false", async () => {
      redis.get.mockResolvedValue(null);
      const disabledRecord = { ...mockDictionaryRecord, isEnabled: false };
      prisma.soft.dictionary.findMany.mockResolvedValue([disabledRecord]);
      redis.setex.mockResolvedValue("OK");

      const result = await service.findByType({
        type: "gender",
        isEnabled: false,
      });

      expect(result).toEqual([
        {
          ...dictionaryItem,
          isEnabled: false,
        },
      ]);
      expect(redis.get).toHaveBeenCalledWith("dict:type:gender:disabled");
      expect(prisma.soft.dictionary.findMany).toHaveBeenCalledWith({
        where: { type: "gender", isEnabled: false },
        orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("invalidateAllCache", () => {
    it("should delete all dictionary cache keys", async () => {
      const cacheKeys = ["dict:type:gender:enabled", "dict:type:status:all"];
      redis.keys.mockResolvedValue(cacheKeys);
      redis.del.mockResolvedValue(2);

      await service.invalidateAllCache();

      expect(redis.keys).toHaveBeenCalledWith("dict:type:*");
      expect(redis.del).toHaveBeenCalledWith(...cacheKeys);
    });

    it("should not call del when no cache keys exist", async () => {
      redis.keys.mockResolvedValue([]);

      await service.invalidateAllCache();

      expect(redis.keys).toHaveBeenCalledWith("dict:type:*");
      expect(redis.del).not.toHaveBeenCalled();
    });

    it("should handle cache invalidation error gracefully", async () => {
      redis.keys.mockRejectedValue(new Error("Redis error"));

      await expect(service.invalidateAllCache()).resolves.not.toThrow();
    });
  });

  describe("cache invalidation on error", () => {
    it("should handle cache invalidation failure in create", async () => {
      prisma.soft.dictionary.findUnique.mockResolvedValue(null);
      prisma.dictionary.create.mockResolvedValue(mockDictionaryRecord);
      redis.del.mockRejectedValue(new Error("Redis error"));

      const result = await service.create({
        type: "gender",
        key: "MALE",
        value: { label: "男" },
        label: "男",
      });

      expect(result).toEqual(dictionaryItem);
    });
  });
});
