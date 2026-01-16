import { Test, TestingModule } from "@nestjs/testing";
import { ConfigChangeType, ConfigValueType } from "@prisma/client";

import { ApiErrorCode } from "../../../common/errors/error-codes";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { ConfigCenterGateway } from "../gateways/config-center.gateway";
import { ConfigCacheService } from "../services/config-cache.service";
import { ConfigEncryptionService } from "../services/config-encryption.service";
import { ConfigItemService } from "../services/config-item.service";
import { ConfigSchemaValidatorService } from "../services/config-schema-validator.service";
import { NamespaceService } from "../services/namespace.service";

describe("ConfigItemService", () => {
  let service: ConfigItemService;
  let prisma: jest.Mocked<PrismaService>;
  let namespaceService: jest.Mocked<NamespaceService>;
  let encryptionService: jest.Mocked<ConfigEncryptionService>;
  let schemaValidator: jest.Mocked<ConfigSchemaValidatorService>;
  let cacheService: jest.Mocked<ConfigCacheService>;
  let gateway: jest.Mocked<ConfigCenterGateway>;

  const namespace = "test_ns";
  const now = new Date();

  const mockNamespaceRecord = {
    id: 1,
    publicId: "550e8400-e29b-41d4-a716-446655440700",
    name: namespace,
    displayName: "Test Namespace",
    description: "Test description",
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  const configPublicId = "550e8400-e29b-41d4-a716-446655440701";
  const configInternalId = 10;

  const mockConfigRecord = {
    id: configInternalId,
    publicId: configPublicId,
    namespaceId: mockNamespaceRecord.id,
    key: "test_key",
    value: { data: "test value" } as never,
    valueType: ConfigValueType.JSON,
    description: "Test config",
    isEncrypted: false,
    isPublic: false,
    jsonSchema: null,
    version: 1,
    configHash: "hash-1",
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  beforeEach(async () => {
    const mockPrisma: Partial<jest.Mocked<PrismaService>> = {
      configItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      configHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      genericSoftDelete: jest.fn(),
      $transaction: jest.fn(),
    };

    const mockNamespaceService = {
      getNamespaceInternalOrThrow: jest.fn(),
    };

    const mockEncryptionService = {
      isAvailable: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    };

    const mockSchemaValidator = {
      validateSchema: jest.fn(),
      validate: jest.fn(),
    };

    const mockCacheService = {
      get: jest.fn(),
      invalidate: jest.fn().mockResolvedValue(undefined),
      getWithLock: jest.fn(),
    };

    const mockGateway = {
      notifyConfigChanged: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigItemService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NamespaceService, useValue: mockNamespaceService },
        { provide: ConfigEncryptionService, useValue: mockEncryptionService },
        {
          provide: ConfigSchemaValidatorService,
          useValue: mockSchemaValidator,
        },
        { provide: ConfigCacheService, useValue: mockCacheService },
        { provide: ConfigCenterGateway, useValue: mockGateway },
      ],
    }).compile();

    service = module.get(ConfigItemService);
    prisma = module.get(PrismaService);
    namespaceService = module.get(NamespaceService);
    encryptionService = module.get(ConfigEncryptionService);
    schemaValidator = module.get(ConfigSchemaValidatorService);
    cacheService = module.get(ConfigCacheService);
    gateway = module.get(ConfigCenterGateway);
  });

  describe("create", () => {
    it("should create config item and invalidate cache", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue(mockConfigRecord),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        return fn(tx as never);
      });

      const result = await service.create(namespace, {
        key: "test_key",
        value: { data: "test value" },
        valueType: ConfigValueType.JSON,
        description: "Test config",
        isEncrypted: false,
        isEnabled: true,
      });

      expect(result).toEqual({
        id: configPublicId,
        key: "test_key",
        value: { data: "test value" },
        valueType: ConfigValueType.JSON,
        description: "Test config",
        isEncrypted: false,
        isEnabled: true,
        version: 1,
        createdAt: now,
        updatedAt: now,
        namespace,
      });
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        namespace,
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace,
          key: "test_key",
          changeType: ConfigChangeType.CREATE,
        }),
      );
    });

    it("should throw CONFIG_ITEM_EXISTS when already exists", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(mockConfigRecord);

      await expect(
        service.create(namespace, {
          key: "test_key",
          value: { data: "test value" },
          valueType: ConfigValueType.JSON,
        }),
      ).rejects.toMatchObject({ code: ApiErrorCode.CONFIG_ITEM_EXISTS });
    });

    it("should validate JSON Schema when provided", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);
      schemaValidator.validateSchema.mockReturnValue(true);
      schemaValidator.validate.mockReturnValue(undefined);

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue(mockConfigRecord),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        return fn(tx as never);
      });

      await service.create(namespace, {
        key: "test_key",
        value: { data: "test value" },
        valueType: ConfigValueType.JSON,
        jsonSchema: {
          type: "object",
          properties: { data: { type: "string" } },
        },
      });

      expect(schemaValidator.validateSchema).toHaveBeenCalled();
      expect(schemaValidator.validate).toHaveBeenCalled();
    });

    it("should throw CONFIG_SCHEMA_INVALID when JSON Schema is invalid", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);
      schemaValidator.validateSchema.mockReturnValue(false);

      await expect(
        service.create(namespace, {
          key: "test_key",
          value: { data: "test value" },
          valueType: ConfigValueType.JSON,
          jsonSchema: { type: "invalid" } as never,
        }),
      ).rejects.toMatchObject({ code: ApiErrorCode.CONFIG_SCHEMA_INVALID });
    });

    it("should encrypt and decrypt value when isEncrypted=true", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);
      encryptionService.isAvailable.mockReturnValue(true);
      encryptionService.encrypt.mockReturnValue("encrypted_value");
      encryptionService.decrypt.mockReturnValue(
        JSON.stringify({ data: "test value" }),
      );

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue({
              ...mockConfigRecord,
              isEncrypted: true,
              value: "encrypted_value" as never,
            }),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        return fn(tx as never);
      });

      const result = await service.create(namespace, {
        key: "test_key",
        value: { data: "test value" },
        valueType: ConfigValueType.JSON,
        isEncrypted: true,
      });

      expect(encryptionService.encrypt).toHaveBeenCalled();
      expect(encryptionService.decrypt).toHaveBeenCalledWith("encrypted_value");
      expect(result.value).toEqual({ data: "test value" });
    });

    it("should throw CONFIG_ENCRYPTION_FAILED when encryption is not available", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);
      encryptionService.isAvailable.mockReturnValue(false);

      await expect(
        service.create(namespace, {
          key: "test_key",
          value: { data: "test value" },
          valueType: ConfigValueType.JSON,
          isEncrypted: true,
        }),
      ).rejects.toMatchObject({ code: ApiErrorCode.CONFIG_ENCRYPTION_FAILED });
    });
  });

  describe("findAll", () => {
    it("should return items and pagination", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findMany.mockResolvedValue([mockConfigRecord]);
      prisma.configItem.count.mockResolvedValue(1);

      const result = await service.findAll(namespace, {
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({
        items: [
          {
            id: configPublicId,
            key: "test_key",
            value: { data: "test value" },
            valueType: ConfigValueType.JSON,
            description: "Test config",
            isEncrypted: false,
            isEnabled: true,
            version: 1,
            createdAt: now,
            updatedAt: now,
            namespace,
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 10 },
      });
    });

    it("should support filtering by isEnabled", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findMany.mockResolvedValue([]);
      prisma.configItem.count.mockResolvedValue(0);

      await service.findAll(namespace, {
        page: 1,
        pageSize: 10,
        isEnabled: true,
      });

      expect(prisma.configItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            namespaceId: mockNamespaceRecord.id,
            isEnabled: true,
            deletedAt: null,
          },
        }),
      );
    });

    it("should decrypt encrypted config values", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findMany.mockResolvedValue([
        {
          ...mockConfigRecord,
          isEncrypted: true,
          value: "encrypted_value" as never,
        },
      ]);
      prisma.configItem.count.mockResolvedValue(1);
      encryptionService.decrypt.mockReturnValue(
        JSON.stringify({ data: "decrypted" }),
      );

      const result = await service.findAll(namespace, {
        page: 1,
        pageSize: 10,
      });

      expect(result.items[0].value).toEqual({ data: "decrypted" });
    });
  });

  describe("findOne", () => {
    it("should return config from cache when available", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      cacheService.get.mockResolvedValue(mockConfigRecord as never);

      const result = await service.findOne(namespace, "test_key");

      expect(result.id).toBe(configPublicId);
      expect(cacheService.get).toHaveBeenCalledWith(namespace, "test_key");
      expect(cacheService.getWithLock).not.toHaveBeenCalled();
    });

    it("should use lock loader when cache miss", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      cacheService.get.mockResolvedValue(null);
      prisma.configItem.findFirst.mockResolvedValue(mockConfigRecord);
      cacheService.getWithLock.mockImplementation(async (_key, loader) =>
        loader(),
      );

      const result = await service.findOne(namespace, "test_key");

      expect(result.id).toBe(configPublicId);
      expect(cacheService.getWithLock).toHaveBeenCalled();
    });

    it("should throw CONFIG_ITEM_NOT_FOUND when missing", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      cacheService.get.mockResolvedValue(null);
      prisma.configItem.findFirst.mockResolvedValue(null);
      cacheService.getWithLock.mockImplementation(async (_key, loader) =>
        loader(),
      );

      await expect(service.findOne(namespace, "missing")).rejects.toMatchObject(
        {
          code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        },
      );
    });

    it("should return encrypted value as-is when value is not a string", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      cacheService.get.mockResolvedValue({
        ...mockConfigRecord,
        isEncrypted: true,
        value: { data: "already decoded" } as never,
      } as never);

      const result = await service.findOne(namespace, "test_key");

      expect(result.value).toEqual({ data: "already decoded" });
      expect(encryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update config item and invalidate cache", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(mockConfigRecord);

      const updatedRecord = {
        ...mockConfigRecord,
        value: { data: "updated value" } as never,
        version: 2,
      };

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            update: jest.fn().mockResolvedValue(updatedRecord),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        return fn(tx as never);
      });

      const result = await service.update(namespace, "test_key", {
        value: { data: "updated value" },
        description: "Updated description",
      });

      expect(result.version).toBe(2);
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        namespace,
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace,
          key: "test_key",
          changeType: ConfigChangeType.UPDATE,
        }),
      );
    });

    it("should throw CONFIG_ITEM_NOT_FOUND when missing", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);

      await expect(
        service.update(namespace, "missing", { value: { a: 1 } }),
      ).rejects.toMatchObject({ code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND });
    });

    it("should validate new JSON Schema when updating value", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(mockConfigRecord);
      schemaValidator.validateSchema.mockReturnValue(true);
      schemaValidator.validate.mockReturnValue(undefined);

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            update: jest.fn().mockResolvedValue(mockConfigRecord),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        return fn(tx as never);
      });

      await service.update(namespace, "test_key", {
        value: { data: "new value" },
        jsonSchema: {
          type: "object",
          properties: { data: { type: "string" } },
        },
      });

      expect(schemaValidator.validateSchema).toHaveBeenCalled();
      expect(schemaValidator.validate).toHaveBeenCalled();
    });

    it("should throw CONFIG_SCHEMA_INVALID when updating invalid JSON Schema", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(mockConfigRecord);
      schemaValidator.validateSchema.mockReturnValue(false);

      await expect(
        service.update(namespace, "test_key", {
          value: { data: "new value" },
          jsonSchema: { type: "invalid" } as never,
        }),
      ).rejects.toMatchObject({ code: ApiErrorCode.CONFIG_SCHEMA_INVALID });
    });
  });

  describe("remove", () => {
    it("should soft delete config item and invalidate cache", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(mockConfigRecord);
      prisma.genericSoftDelete.mockResolvedValue({
        id: configInternalId,
        deletedAt: new Date(),
      } as never);

      await service.remove(namespace, "test_key");

      expect(prisma.genericSoftDelete).toHaveBeenCalledWith(
        "ConfigItem",
        configInternalId,
        expect.objectContaining({ reason: "用户删除配置项" }),
      );
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        namespace,
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace,
          key: "test_key",
          changeType: ConfigChangeType.DELETE,
        }),
      );
    });

    it("should throw CONFIG_ITEM_NOT_FOUND when missing", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);

      await expect(service.remove(namespace, "missing")).rejects.toMatchObject({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
      });
    });
  });

  describe("getMeta", () => {
    it("should return config meta", async () => {
      const meta = {
        key: "test_key",
        version: 1,
        configHash: "abc123",
        isEncrypted: false,
        updatedAt: now,
      };
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(meta as never);

      await expect(service.getMeta(namespace, "test_key")).resolves.toEqual(
        meta,
      );
    });

    it("should throw CONFIG_ITEM_NOT_FOUND when missing", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);

      await expect(service.getMeta(namespace, "missing")).rejects.toMatchObject(
        {
          code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        },
      );
    });
  });

  describe("batchGet", () => {
    it("should return empty items for empty keys", async () => {
      const result = await service.batchGet(namespace, []);

      expect(result).toEqual({
        items: [],
        pagination: { total: 0, page: 1, pageSize: 0 },
      });
    });

    it("should throw BAD_REQUEST when keys exceed limit", async () => {
      const keys = Array.from({ length: 51 }, (_, i) => `k${i}`);

      await expect(service.batchGet(namespace, keys)).rejects.toMatchObject({
        code: ApiErrorCode.BAD_REQUEST,
      });
    });

    it("should return items and pagination", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findMany.mockResolvedValue([mockConfigRecord]);

      const result = await service.batchGet(namespace, ["test_key"]);

      expect(result).toEqual({
        items: [
          {
            id: configPublicId,
            key: "test_key",
            value: { data: "test value" },
            valueType: ConfigValueType.JSON,
            description: "Test config",
            isEncrypted: false,
            isEnabled: true,
            version: 1,
            createdAt: now,
            updatedAt: now,
            namespace,
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 1 },
      });
    });
  });

  describe("getHistory", () => {
    it("should throw CONFIG_ITEM_NOT_FOUND when config does not exist", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue(null);

      await expect(
        service.getHistory(namespace, "missing"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
      });
    });

    it("should return items and pagination", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue({
        id: configInternalId,
        isEncrypted: false,
        valueType: ConfigValueType.JSON,
      } as never);

      prisma.configHistory.findMany.mockResolvedValue([
        {
          version: 2,
          value: { data: "v2" } as never,
          changeType: ConfigChangeType.UPDATE,
          changeNote: "updated",
          changedBy: {
            publicId: "550e8400-e29b-41d4-a716-446655440799",
            name: "Operator",
          },
          createdAt: now,
        },
        {
          version: 1,
          value: { data: "v1" } as never,
          changeType: ConfigChangeType.CREATE,
          changeNote: "created",
          changedBy: null,
          createdAt: now,
        },
      ] as never);
      prisma.configHistory.count.mockResolvedValue(2);

      const result = await service.getHistory(namespace, "test_key", 1, 10);

      expect(result).toEqual({
        items: [
          {
            version: 2,
            value: { data: "v2" },
            valueType: ConfigValueType.JSON,
            changeType: ConfigChangeType.UPDATE,
            changeNote: "updated",
            operator: {
              id: "550e8400-e29b-41d4-a716-446655440799",
              name: "Operator",
            },
            createdAt: now,
          },
          {
            version: 1,
            value: { data: "v1" },
            valueType: ConfigValueType.JSON,
            changeType: ConfigChangeType.CREATE,
            changeNote: "created",
            operator: null,
            createdAt: now,
          },
        ],
        pagination: { total: 2, page: 1, pageSize: 10 },
      });
    });
  });

  describe("rollback", () => {
    it("should rollback to target version", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue({
        id: configInternalId,
        publicId: configPublicId,
        key: "test_key",
        value: { data: "current" } as never,
        valueType: ConfigValueType.JSON,
        description: "Test config",
        isEncrypted: false,
        isEnabled: true,
        version: 2,
        jsonSchema: null,
        createdAt: now,
        updatedAt: now,
      } as never);

      prisma.configHistory.findFirst.mockResolvedValue({
        version: 1,
        value: { data: "v1" } as never,
        configHash: "hash-v1",
      } as never);

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            update: jest.fn().mockResolvedValue({
              ...mockConfigRecord,
              version: 3,
              value: { data: "v1" } as never,
              configHash: "hash-v1",
            }),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        };
        return fn(tx as never);
      });

      const result = await service.rollback(namespace, "test_key", 1);

      expect(result.version).toBe(3);
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        namespace,
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace,
          key: "test_key",
          changeType: ConfigChangeType.ROLLBACK,
        }),
      );
    });

    it("should throw CONFIG_VERSION_NOT_FOUND when target history missing", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );
      prisma.configItem.findFirst.mockResolvedValue({
        id: configInternalId,
        version: 2,
        jsonSchema: null,
        isEncrypted: false,
      } as never);
      prisma.configHistory.findFirst.mockResolvedValue(null);

      await expect(
        service.rollback(namespace, "test_key", 999),
      ).rejects.toMatchObject({ code: ApiErrorCode.CONFIG_VERSION_NOT_FOUND });
    });
  });

  describe("batchUpsert", () => {
    it("should allow partial success", async () => {
      namespaceService.getNamespaceInternalOrThrow.mockResolvedValue(
        mockNamespaceRecord as never,
      );

      jest
        .spyOn(service, "findOne")
        .mockRejectedValueOnce(new Error("not found"))
        .mockRejectedValueOnce(new Error("not found"));

      jest
        .spyOn(service, "create")
        .mockResolvedValueOnce({ id: "1" } as never)
        .mockRejectedValueOnce(new Error("Invalid value"));

      const result = await service.batchUpsert(namespace, {
        items: [
          { key: "key1", value: { a: 1 }, valueType: ConfigValueType.JSON },
          {
            key: "key2",
            value: null as never,
            valueType: ConfigValueType.JSON,
          },
        ],
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });
});
