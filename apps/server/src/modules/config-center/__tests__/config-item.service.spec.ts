import { Test, TestingModule } from "@nestjs/testing";
import { ConfigChangeType, ConfigValueType } from "@prisma/client";

import { BusinessException } from "../../../common/errors/business.exception";
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
  let prismaService: jest.Mocked<PrismaService>;
  let namespaceService: jest.Mocked<NamespaceService>;
  let encryptionService: jest.Mocked<ConfigEncryptionService>;
  let schemaValidator: jest.Mocked<ConfigSchemaValidatorService>;
  let cacheService: jest.Mocked<ConfigCacheService>;
  let gateway: jest.Mocked<ConfigCenterGateway>;

  const mockNamespace = {
    id: 1,
    name: "test_ns",
    displayName: "Test Namespace",
    description: "Test description",
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  const mockConfigItem = {
    id: 1,
    namespaceId: 1,
    key: "test_key",
    value: { data: "test value" } as never,
    valueType: ConfigValueType.JSON,
    description: "Test config",
    isEncrypted: false,
    jsonSchema: null,
    version: 1,
    configHash: "098f6bcd4621d373cade4e832627b4f6", // MD5 of "test"
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  const mockHistory = {
    id: 1,
    configId: 1,
    version: 1,
    value: { data: "test value" } as never,
    configHash: "098f6bcd4621d373cade4e832627b4f6",
    changeType: ConfigChangeType.CREATE,
    changeNote: "创建配置项",
    changedBy: null,
    changedById: null,
    changedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      configItem: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      configHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      genericSoftDelete: jest.fn(),

      $transaction: jest.fn((fn: any) =>
        fn({
          configItem: {
            create: jest.fn(),
            update: jest.fn(),
          },
          configHistory: {
            create: jest.fn(),
          },
        }),
      ),
    };

    const mockNamespaceService = {
      findByName: jest.fn(),
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
      set: jest.fn().mockResolvedValue(undefined),
      getAll: jest.fn(),
      setAll: jest.fn().mockResolvedValue(undefined),
      invalidate: jest.fn().mockResolvedValue(undefined),
      getWithLock: jest.fn(),
    };

    const mockGateway = {
      notifyConfigChanged: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigItemService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NamespaceService,
          useValue: mockNamespaceService,
        },
        {
          provide: ConfigEncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: ConfigSchemaValidatorService,
          useValue: mockSchemaValidator,
        },
        {
          provide: ConfigCacheService,
          useValue: mockCacheService,
        },
        {
          provide: ConfigCenterGateway,
          useValue: mockGateway,
        },
      ],
    }).compile();

    service = module.get<ConfigItemService>(ConfigItemService);
    prismaService = module.get(PrismaService);
    namespaceService = module.get(NamespaceService);
    encryptionService = module.get(ConfigEncryptionService);
    schemaValidator = module.get(ConfigSchemaValidatorService);
    cacheService = module.get(ConfigCacheService);
    gateway = module.get(ConfigCenterGateway);
  });

  describe("create", () => {
    const createDto = {
      key: "test_key",
      value: { data: "test value" },
      valueType: ConfigValueType.JSON,
      description: "Test config",
      isEncrypted: false,
      isEnabled: true,
    };

    it("应该成功创建配置项", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue(mockConfigItem),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      const result = await service.create("test_ns", createDto);

      expect(result).toEqual(mockConfigItem);
      expect(namespaceService.findByName).toHaveBeenCalledWith("test_ns");
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        "test_ns",
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "test_ns",
          key: "test_key",
          changeType: ConfigChangeType.CREATE,
        }),
      );
    });

    it("应该在配置项已存在时抛出异常", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockConfigItem);

      await expect(service.create("test_ns", createDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.create("test_ns", createDto)).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFIG_ITEM_EXISTS,
      });
    });

    it("应该在提供 JSON Schema 时进行校验", async () => {
      const dtoWithSchema = {
        ...createDto,
        jsonSchema: {
          type: "object",
          properties: {
            data: { type: "string" },
          },
        },
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);
      schemaValidator.validateSchema.mockReturnValue(true);
      schemaValidator.validate.mockReturnValue(undefined);

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue(mockConfigItem),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      await service.create("test_ns", dtoWithSchema);

      expect(schemaValidator.validateSchema).toHaveBeenCalledWith(
        dtoWithSchema.jsonSchema,
      );
      expect(schemaValidator.validate).toHaveBeenCalledWith(
        dtoWithSchema.value,
        dtoWithSchema.jsonSchema,
      );
    });

    it("应该在 JSON Schema 无效时抛出异常", async () => {
      const dtoWithInvalidSchema = {
        ...createDto,
        jsonSchema: { type: "invalid" },
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);
      schemaValidator.validateSchema.mockReturnValue(false);

      await expect(
        service.create("test_ns", dtoWithInvalidSchema),
      ).rejects.toThrow(BusinessException);
      await expect(
        service.create("test_ns", dtoWithInvalidSchema),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFIG_SCHEMA_INVALID,
      });
    });

    it("应该在需要加密时调用加密服务", async () => {
      const encryptedDto = {
        ...createDto,
        isEncrypted: true,
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);
      encryptionService.isAvailable.mockReturnValue(true);
      encryptionService.encrypt.mockReturnValue("encrypted_value");

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue(mockConfigItem),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      await service.create("test_ns", encryptedDto);

      expect(encryptionService.isAvailable).toHaveBeenCalled();
      expect(encryptionService.encrypt).toHaveBeenCalled();
    });

    it("应该在加密功能未配置时抛出异常", async () => {
      const encryptedDto = {
        ...createDto,
        isEncrypted: true,
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);
      encryptionService.isAvailable.mockReturnValue(false);

      await expect(service.create("test_ns", encryptedDto)).rejects.toThrow(
        BusinessException,
      );
      await expect(
        service.create("test_ns", encryptedDto),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFIG_ENCRYPTION_FAILED,
      });
    });
  });

  describe("findAll", () => {
    it("应该返回分页格式的配置列表", async () => {
      const mockConfigs = [mockConfigItem];
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findMany.mockResolvedValue(mockConfigs);
      prismaService.configItem.count.mockResolvedValue(1);

      const result = await service.findAll("test_ns", { page: 1, limit: 10 });

      expect(result).toEqual({
        data: mockConfigs,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
      expect(prismaService.configItem.findMany).toHaveBeenCalled();
      expect(prismaService.configItem.count).toHaveBeenCalled();
    });

    it("应该支持按 isEnabled 过滤", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findMany.mockResolvedValue([]);
      prismaService.configItem.count.mockResolvedValue(0);

      await service.findAll("test_ns", { isEnabled: true, page: 1, limit: 10 });

      expect(prismaService.configItem.findMany).toHaveBeenCalledWith({
        where: {
          namespaceId: mockNamespace.id,
          isEnabled: true,
          deletedAt: null,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("应该解密加密的配置值", async () => {
      const encryptedConfig = {
        ...mockConfigItem,
        isEncrypted: true,
        value: "encrypted_value" as never,
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findMany.mockResolvedValue([encryptedConfig]);
      prismaService.configItem.count.mockResolvedValue(1);
      encryptionService.decrypt.mockReturnValue('{"data":"decrypted"}');

      const result = await service.findAll("test_ns", { page: 1, limit: 10 });

      expect(result.data[0].value).toEqual({ data: "decrypted" });
      expect(encryptionService.decrypt).toHaveBeenCalledWith("encrypted_value");
    });
  });

  describe("findOne", () => {
    it("应该优先从缓存获取单个配置", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(mockConfigItem);

      const result = await service.findOne("test_ns", "test_key");

      expect(result.key).toBe("test_key");
      expect(cacheService.get).toHaveBeenCalledWith("test_ns", "test_key");
      expect(cacheService.getWithLock).not.toHaveBeenCalled();
    });

    it("应该在缓存未命中时使用锁加载", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(null);
      cacheService.getWithLock.mockResolvedValue(mockConfigItem);

      const result = await service.findOne("test_ns", "test_key");

      expect(result.key).toBe("test_key");
      expect(cacheService.getWithLock).toHaveBeenCalled();
    });

    it("应该在配置不存在时抛出异常", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(null);
      cacheService.getWithLock.mockImplementation(async (key, loader) => {
        return loader();
      });
      prismaService.configItem.findFirst.mockResolvedValue(null);

      await expect(service.findOne("test_ns", "nonexistent")).rejects.toThrow(
        BusinessException,
      );
      await expect(
        service.findOne("test_ns", "nonexistent"),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
      });
    });

    it("当加密配置的值不是字符串时应该直接返回原值", async () => {
      // 当 isEncrypted=true 但 value 不是字符串时（例如已经是对象）
      const nonStringEncryptedConfig = {
        ...mockConfigItem,
        isEncrypted: true,
        value: { data: "already decoded" } as never, // 非字符串值
      };
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(nonStringEncryptedConfig);

      const result = await service.findOne("test_ns", "test_key");

      // 应该直接返回原值，不尝试解密
      expect(result.value).toEqual({ data: "already decoded" });
      expect(encryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    const updateDto = {
      value: { data: "updated value" },
      description: "Updated description",
    };

    it("应该成功更新配置项", async () => {
      const updatedConfig = {
        ...mockConfigItem,
        ...updateDto,
        version: 2,
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockConfigItem);

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            update: jest.fn().mockResolvedValue(updatedConfig),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      const result = await service.update("test_ns", "test_key", updateDto);

      expect(result.version).toBe(2);
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        "test_ns",
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "test_ns",
          key: "test_key",
          changeType: ConfigChangeType.UPDATE,
        }),
      );
    });

    it("应该在配置不存在时抛出异常", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);

      await expect(
        service.update("test_ns", "nonexistent", updateDto),
      ).rejects.toThrow(BusinessException);
    });

    it("应该在更新值时校验新的 JSON Schema", async () => {
      const updateWithSchema = {
        value: { data: "new value" },
        jsonSchema: {
          type: "object",
          properties: {
            data: { type: "string" },
          },
        },
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockConfigItem);
      schemaValidator.validateSchema.mockReturnValue(true);
      schemaValidator.validate.mockReturnValue(undefined);

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            update: jest.fn().mockResolvedValue(mockConfigItem),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      await service.update("test_ns", "test_key", updateWithSchema);

      expect(schemaValidator.validateSchema).toHaveBeenCalled();
      expect(schemaValidator.validate).toHaveBeenCalled();
    });

    it("应该支持更新所有可选字段", async () => {
      const updateAllFields = {
        valueType: ConfigValueType.STRING,
        isEncrypted: true,
        isEnabled: false,
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockConfigItem);
      encryptionService.isAvailable.mockReturnValue(true);

      const updateMock = jest.fn().mockResolvedValue({
        ...mockConfigItem,
        ...updateAllFields,
      });

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: { update: updateMock },
          configHistory: { create: jest.fn().mockResolvedValue(mockHistory) },
        };
        return fn(tx);
      });

      await service.update("test_ns", "test_key", updateAllFields);

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            valueType: ConfigValueType.STRING,
            isEncrypted: true,
            isEnabled: false,
          }),
        }),
      );
    });

    it("应该在更新 JSON Schema 无效时抛出异常", async () => {
      const updateWithInvalidSchema = {
        value: { data: "new value" },
        jsonSchema: { type: "invalid" },
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockConfigItem);
      schemaValidator.validateSchema.mockReturnValue(false);

      await expect(
        service.update("test_ns", "test_key", updateWithInvalidSchema),
      ).rejects.toThrow(BusinessException);
      await expect(
        service.update("test_ns", "test_key", updateWithInvalidSchema),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFIG_SCHEMA_INVALID,
      });
    });
  });

  describe("remove", () => {
    it("应该成功删除配置项", async () => {
      const deletedConfig = {
        ...mockConfigItem,
        deletedAt: new Date(),
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockConfigItem);
      prismaService.genericSoftDelete.mockResolvedValue(deletedConfig);

      await service.remove("test_ns", "test_key");

      expect(prismaService.genericSoftDelete).toHaveBeenCalledWith(
        "ConfigItem",
        mockConfigItem.id,
        expect.objectContaining({
          reason: "用户删除配置项",
        }),
      );
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        "test_ns",
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "test_ns",
          key: "test_key",
          changeType: ConfigChangeType.DELETE,
        }),
      );
    });

    it("应该在配置不存在时抛出异常", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);

      await expect(service.remove("test_ns", "nonexistent")).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe("getMeta", () => {
    it("应该成功获取配置元数据", async () => {
      const mockMeta = {
        key: "test_key",
        version: 1,
        configHash: "abc123",
        isEncrypted: false,
        updatedAt: new Date(),
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(mockMeta as never);

      const result = await service.getMeta("test_ns", "test_key");

      expect(result).toEqual(mockMeta);
    });

    it("配置项不存在时应该抛出异常", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findFirst.mockResolvedValue(null);

      await expect(service.getMeta("test_ns", "non_existent")).rejects.toThrow(
        BusinessException,
      );
    });
  });

  describe("batchGet", () => {
    it("应该成功批量获取配置项", async () => {
      const mockConfigs = [mockConfigItem];
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      prismaService.configItem.findMany.mockResolvedValue(mockConfigs);

      const result = await service.batchGet("test_ns", ["test_key"]);

      expect(result).toEqual({
        data: mockConfigs,
        meta: {
          total: 1,
          page: 1,
          limit: 1,
          totalPages: 1,
        },
      });
      expect(prismaService.configItem.findMany).toHaveBeenCalledWith({
        where: {
          namespaceId: mockNamespace.id,
          key: { in: ["test_key"] },
          deletedAt: null,
        },
      });
    });

    it("应该在 keys 为空时返回空数组", async () => {
      const result = await service.batchGet("test_ns", []);

      expect(result).toEqual({
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 0,
          totalPages: 0,
        },
      });
      expect(prismaService.configItem.findMany).not.toHaveBeenCalled();
    });

    it("应该在 keys 超过 50 个时抛出异常", async () => {
      const keys = Array.from({ length: 51 }, (_, i) => `key_${i}`);

      await expect(service.batchGet("test_ns", keys)).rejects.toThrow(
        BusinessException,
      );
      await expect(service.batchGet("test_ns", keys)).rejects.toMatchObject({
        businessCode: ApiErrorCode.BAD_REQUEST,
      });
    });
  });

  describe("getHistory", () => {
    it("应该成功获取配置历史", async () => {
      const mockHistories = [
        {
          ...mockHistory,
          User: {
            id: 1,
            name: "Test User",
            email: "test@example.com",
          },
        },
      ];

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(mockConfigItem);
      prismaService.configHistory.findMany.mockResolvedValue(mockHistories);
      prismaService.configHistory.count.mockResolvedValue(1);

      const result = await service.getHistory("test_ns", "test_key", 1, 10);

      expect(result).toEqual({
        data: mockHistories,
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      });
      expect(prismaService.configHistory.findMany).toHaveBeenCalledWith({
        where: { configId: mockConfigItem.id },
        skip: 0,
        take: 10,
        orderBy: { version: "desc" },
        include: {
          User: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      expect(prismaService.configHistory.count).toHaveBeenCalledWith({
        where: { configId: mockConfigItem.id },
      });
    });
  });

  describe("rollback", () => {
    it("应该成功回滚到历史版本", async () => {
      const targetHistory = {
        ...mockHistory,
        version: 1,
      };

      const rolledBackConfig = {
        ...mockConfigItem,
        version: 3,
        value: targetHistory.value,
        configHash: targetHistory.configHash,
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue({ ...mockConfigItem, version: 2 });
      prismaService.configHistory.findFirst.mockResolvedValue(targetHistory);

      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            update: jest.fn().mockResolvedValue(rolledBackConfig),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      const result = await service.rollback("test_ns", "test_key", 1);

      expect(result.version).toBe(3);
      expect(cacheService.invalidate).toHaveBeenCalledWith(
        "test_ns",
        "test_key",
      );
      expect(gateway.notifyConfigChanged).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: "test_ns",
          key: "test_key",
          changeType: ConfigChangeType.ROLLBACK,
        }),
      );
    });

    it("应该在目标版本不存在时抛出异常", async () => {
      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(mockConfigItem);
      prismaService.configHistory.findFirst.mockResolvedValue(null);

      await expect(
        service.rollback("test_ns", "test_key", 999),
      ).rejects.toThrow(BusinessException);
      await expect(
        service.rollback("test_ns", "test_key", 999),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFIG_VERSION_NOT_FOUND,
      });
    });
  });

  describe("batchUpsert", () => {
    it("应该成功批量创建/更新配置项", async () => {
      const dto = {
        items: [
          {
            key: "key1",
            value: { data: "value1" },
            valueType: ConfigValueType.JSON,
          },
          {
            key: "key2",
            value: { data: "value2" },
            valueType: ConfigValueType.JSON,
          },
        ],
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);

      // Mock findOne to return null (config doesn't exist, will create)
      cacheService.get.mockResolvedValue(null);
      cacheService.getWithLock.mockImplementation(async (key, loader) => {
        // Simulate config not found
        return await loader();
      });
      prismaService.configItem.findFirst.mockResolvedValue(null);

      // Mock create
      prismaService.$transaction.mockImplementation(async (fn) => {
        const tx = {
          configItem: {
            create: jest.fn().mockResolvedValue(mockConfigItem),
          },
          configHistory: {
            create: jest.fn().mockResolvedValue(mockHistory),
          },
        };
        return fn(tx);
      });

      const result = await service.batchUpsert("test_ns", dto);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it("应该允许部分成功", async () => {
      const dto = {
        items: [
          {
            key: "valid_key",
            value: { data: "value" },
            valueType: ConfigValueType.JSON,
          },
          {
            key: "invalid_key",
            value: null as never, // Invalid value
            valueType: ConfigValueType.JSON,
          },
        ],
      };

      namespaceService.findByName.mockResolvedValue(mockNamespace);
      cacheService.get.mockResolvedValue(null);
      cacheService.getWithLock.mockImplementation(async (key, loader) => {
        return await loader();
      });
      prismaService.configItem.findFirst.mockResolvedValue(null);

      // First item succeeds
      prismaService.$transaction
        .mockImplementationOnce(async (fn) => {
          const tx = {
            configItem: {
              create: jest.fn().mockResolvedValue(mockConfigItem),
            },
            configHistory: {
              create: jest.fn().mockResolvedValue(mockHistory),
            },
          };
          return fn(tx);
        })
        // Second item fails
        .mockRejectedValueOnce(new Error("Invalid value"));

      const result = await service.batchUpsert("test_ns", dto);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });
  });
});
