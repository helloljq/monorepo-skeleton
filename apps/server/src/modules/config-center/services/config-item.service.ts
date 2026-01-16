import { Injectable, Logger } from "@nestjs/common";
import { ConfigChangeType, Prisma } from "@prisma/client";
import { createHash } from "crypto";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  BatchOperationResponse,
  BatchOperationResult,
  BatchUpsertConfigDto,
  CreateConfigItemDto,
  QueryConfigItemDto,
  UpdateConfigItemDto,
} from "../dto";
import { ConfigCenterGateway } from "../gateways/config-center.gateway";
import { ConfigCacheService } from "./config-cache.service";
import { ConfigEncryptionService } from "./config-encryption.service";
import { ConfigSchemaValidatorService } from "./config-schema-validator.service";
import { NamespaceService } from "./namespace.service";

/**
 * 配置项服务
 *
 * 负责配置项的 CRUD 操作，包括：
 * - 配置值加密/解密
 * - JSON Schema 校验
 * - 版本控制和历史记录
 * - configHash 计算
 */
@Injectable()
export class ConfigItemService {
  private readonly logger = new Logger(ConfigItemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly namespaceService: NamespaceService,
    private readonly encryptionService: ConfigEncryptionService,
    private readonly schemaValidator: ConfigSchemaValidatorService,
    private readonly cacheService: ConfigCacheService,
    private readonly gateway: ConfigCenterGateway,
  ) {}

  /**
   * 计算配置值的 MD5 hash
   * 用于客户端缓存校验
   */
  private calculateConfigHash(value: unknown): string {
    const jsonString = JSON.stringify(value);
    return createHash("md5").update(jsonString).digest("hex");
  }

  /**
   * 加密配置值
   * 如果 isEncrypted 为 true，对 value 进行加密并包装为 JSON 字符串
   */
  private encryptValue(value: unknown, isEncrypted: boolean): unknown {
    if (!isEncrypted) {
      return value;
    }

    // 检查加密功能是否可用
    if (!this.encryptionService.isAvailable()) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ENCRYPTION_FAILED,
        message: "加密功能未配置，无法创建加密配置项",
      });
    }

    // 将值序列化为字符串后加密
    const plaintext = JSON.stringify(value);
    const encrypted = this.encryptionService.encrypt(plaintext);

    // 返回加密字符串（存储在 Json 字段中）
    return encrypted;
  }

  /**
   * 解密配置值
   * 如果 isEncrypted 为 true，解密并解析 JSON
   */
  private decryptValue(value: unknown, isEncrypted: boolean): unknown {
    if (!isEncrypted) {
      return value;
    }

    if (typeof value !== "string") {
      this.logger.warn("Encrypted value is not a string, returning as-is");
      return value;
    }

    const decrypted = this.encryptionService.decrypt(value);
    return JSON.parse(decrypted) as unknown;
  }

  /**
   * 创建配置项
   */
  async create(namespace: string, dto: CreateConfigItemDto) {
    // 1. 验证命名空间存在
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    // 2. 检查配置项是否已存在
    const existing = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key: dto.key,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_EXISTS,
        message: `配置项 "${namespace}:${dto.key}" 已存在`,
        status: 409, // CONFLICT
      });
    }

    // 3. JSON Schema 校验（如果提供）
    if (dto.jsonSchema) {
      // 先校验 Schema 本身是否有效
      if (!this.schemaValidator.validateSchema(dto.jsonSchema)) {
        throw new BusinessException({
          code: ApiErrorCode.CONFIG_SCHEMA_INVALID,
          message: "JSON Schema 定义无效",
        });
      }

      // 再校验值是否符合 Schema
      this.schemaValidator.validate(dto.value, dto.jsonSchema);
    }

    // 4. 计算 hash (加密前的原始值)
    const configHash = this.calculateConfigHash(dto.value);

    // 5. 加密值（如果需要）
    const valueToStore = this.encryptValue(dto.value, dto.isEncrypted);

    // 6. 创建配置项和历史记录（事务）
    const result = await this.prisma.$transaction(async (tx) => {
      const config = await tx.configItem.create({
        data: {
          namespaceId: ns.id,
          key: dto.key,
          value: valueToStore as never, // Prisma Json type
          valueType: dto.valueType,
          description: dto.description,
          isEncrypted: dto.isEncrypted,
          isPublic: dto.isPublic,
          jsonSchema: dto.jsonSchema as never,
          version: 1,
          configHash,
          isEnabled: dto.isEnabled,
        },
      });

      // 创建历史记录
      await tx.configHistory.create({
        data: {
          configId: config.id,
          version: 1,
          value: valueToStore as never,
          configHash,
          changeType: ConfigChangeType.CREATE,
          changeNote: "创建配置项",
        },
      });

      return config;
    });

    // 7. 失效缓存
    await this.cacheService.invalidate(namespace, dto.key);

    // 8. 推送变更通知
    this.gateway.notifyConfigChanged({
      namespace,
      key: dto.key,
      version: result.version,
      configHash: result.configHash,
      changeType: ConfigChangeType.CREATE,
      changedAt: result.updatedAt.toISOString(),
    });

    return {
      id: result.publicId,
      key: result.key,
      value: this.decryptValue(result.value, result.isEncrypted),
      valueType: result.valueType,
      description: result.description,
      isEncrypted: result.isEncrypted,
      isEnabled: result.isEnabled,
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      namespace,
    };
  }

  /**
   * 查询命名空间下的所有配置项
   */
  async findAll(namespace: string, query: QueryConfigItemDto) {
    // 验证命名空间存在
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const { key, isEnabled, page, pageSize: rawPageSize, limit } = query;
    const pageSize = rawPageSize ?? limit ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ConfigItemWhereInput = {
      namespaceId: ns.id,
      ...(key && { key: { contains: key, mode: "insensitive" as const } }),
      ...(isEnabled !== undefined && { isEnabled }),
      deletedAt: null,
    };

    // 查询数据和总数
    const [configs, total] = await Promise.all([
      this.prisma.configItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.configItem.count({ where }),
    ]);

    return {
      items: configs.map((config) => ({
        id: config.publicId,
        key: config.key,
        value: this.decryptValue(config.value, config.isEncrypted),
        valueType: config.valueType,
        description: config.description,
        isEncrypted: config.isEncrypted,
        isEnabled: config.isEnabled,
        version: config.version,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        namespace,
      })),
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * 获取单个配置项
   */
  async findOne(namespace: string, key: string) {
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    // 尝试从缓存获取
    const cached = await this.cacheService.get(namespace, key);
    if (cached) {
      return {
        id: cached.publicId,
        key: cached.key,
        value: this.decryptValue(cached.value, cached.isEncrypted),
        valueType: cached.valueType,
        description: cached.description,
        isEncrypted: cached.isEncrypted,
        isEnabled: cached.isEnabled,
        version: cached.version,
        createdAt: cached.createdAt,
        updatedAt: cached.updatedAt,
        namespace,
      };
    }

    // 使用分布式锁防止缓存击穿
    const cacheKey = `config:${namespace}:${key}`;
    const config = await this.cacheService.getWithLock(cacheKey, async () => {
      const result = await this.prisma.configItem.findFirst({
        where: {
          namespaceId: ns.id,
          key,
          deletedAt: null,
        },
      });

      if (!result) {
        throw new BusinessException({
          code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
          message: `配置项 "${namespace}:${key}" 不存在`,
          status: 404, // NOT_FOUND
        });
      }

      return result;
    });

    // 解密配置值
    return {
      id: config.publicId,
      key: config.key,
      value: this.decryptValue(config.value, config.isEncrypted),
      valueType: config.valueType,
      description: config.description,
      isEncrypted: config.isEncrypted,
      isEnabled: config.isEnabled,
      version: config.version,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      namespace,
    };
  }

  /**
   * 获取配置项元数据（轻量级，不包含 value）
   * 用于客户端缓存校验
   */
  async getMeta(namespace: string, key: string) {
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const config = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key,
        deletedAt: null,
      },
      select: {
        key: true,
        version: true,
        configHash: true,
        isEncrypted: true,
        updatedAt: true,
      },
    });

    if (!config) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        message: `配置项 "${namespace}:${key}" 不存在`,
        status: 404, // NOT_FOUND
      });
    }

    return config;
  }

  /**
   * 更新配置项
   */
  async update(namespace: string, key: string, dto: UpdateConfigItemDto) {
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    // 获取当前配置
    const current = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key,
        deletedAt: null,
      },
    });

    if (!current) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        message: `配置项 "${namespace}:${key}" 不存在`,
        status: 404, // NOT_FOUND
      });
    }

    // 准备更新数据
    const updateData: Prisma.ConfigItemUpdateInput = {};
    let newValue = dto.value;
    const newIsEncrypted = dto.isEncrypted ?? current.isEncrypted;
    const newJsonSchema =
      dto.jsonSchema !== undefined ? dto.jsonSchema : current.jsonSchema;

    // 如果更新了值
    if (dto.value !== undefined) {
      // 使用新值
      newValue = dto.value;

      // JSON Schema 校验（使用新 Schema 或当前 Schema）
      const schemaToUse = newJsonSchema;
      if (schemaToUse) {
        // 如果更新了 Schema，先校验 Schema 本身
        if (dto.jsonSchema !== undefined && dto.jsonSchema !== null) {
          if (!this.schemaValidator.validateSchema(dto.jsonSchema)) {
            throw new BusinessException({
              code: ApiErrorCode.CONFIG_SCHEMA_INVALID,
              message: "JSON Schema 定义无效",
            });
          }
        }

        // 校验值是否符合 Schema
        this.schemaValidator.validate(newValue, schemaToUse as object);
      }

      // 计算新 hash
      const newConfigHash = this.calculateConfigHash(newValue);

      // 加密新值
      const valueToStore = this.encryptValue(newValue, newIsEncrypted);

      updateData.value = valueToStore as never;
      updateData.configHash = newConfigHash;
      updateData.version = current.version + 1;
    }

    // 其他字段更新
    if (dto.valueType !== undefined) {
      updateData.valueType = dto.valueType;
    }
    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }
    if (dto.isEncrypted !== undefined) {
      updateData.isEncrypted = dto.isEncrypted;
    }
    if (dto.isPublic !== undefined) {
      updateData.isPublic = dto.isPublic;
    }
    if (dto.isEnabled !== undefined) {
      updateData.isEnabled = dto.isEnabled;
    }
    if (dto.jsonSchema !== undefined) {
      updateData.jsonSchema = dto.jsonSchema as never;
    }

    // 事务更新
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.configItem.update({
        where: { id: current.id },
        data: updateData,
      });

      // 如果更新了值，记录历史
      if (updateData.value !== undefined) {
        await tx.configHistory.create({
          data: {
            configId: current.id,
            version: updateData.version as number,
            value: updateData.value,
            configHash: updateData.configHash as string,
            changeType: ConfigChangeType.UPDATE,
            changeNote: "更新配置值",
          },
        });
      }

      return updated;
    });

    // 失效缓存
    await this.cacheService.invalidate(namespace, key);

    // 推送变更通知
    this.gateway.notifyConfigChanged({
      namespace,
      key,
      version: result.version,
      configHash: result.configHash,
      changeType: ConfigChangeType.UPDATE,
      changedAt: result.updatedAt.toISOString(),
    });

    return {
      id: result.publicId,
      key: result.key,
      value: this.decryptValue(result.value, result.isEncrypted),
      valueType: result.valueType,
      description: result.description,
      isEncrypted: result.isEncrypted,
      isEnabled: result.isEnabled,
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      namespace,
    };
  }

  /**
   * 删除配置项（软删除）
   */
  async remove(
    namespace: string,
    key: string,
  ): Promise<{ id: number; deletedAt: Date | null } | null> {
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const config = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key,
        deletedAt: null,
      },
    });

    if (!config) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        message: `配置项 "${namespace}:${key}" 不存在`,
        status: 404, // NOT_FOUND
      });
    }

    // 执行软删除
    const result = await this.prisma.genericSoftDelete(
      "ConfigItem",
      config.id,
      {
        reason: "用户删除配置项",
      },
    );

    // 失效缓存
    await this.cacheService.invalidate(namespace, key);

    // 推送变更通知（使用删除前的配置信息）
    this.gateway.notifyConfigChanged({
      namespace,
      key,
      version: config.version,
      configHash: config.configHash,
      changeType: ConfigChangeType.DELETE, // 软删除推送 DELETE 事件
      changedAt: new Date().toISOString(),
    });

    return result;
  }

  /**
   * 批量获取配置项
   *
   * @param namespace 命名空间
   * @param keys 配置项 key 列表（最多 50 个）
   */
  async batchGet(namespace: string, keys: string[]) {
    // 验证 keys 数量
    if (keys.length === 0) {
      return {
        items: [],
        pagination: { total: 0, page: 1, pageSize: 0 },
      };
    }

    if (keys.length > 50) {
      throw new BusinessException({
        code: ApiErrorCode.BAD_REQUEST,
        message: "批量获取最多支持 50 个配置项",
      });
    }

    // 验证命名空间存在
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    // 查询配置项
    const configs = await this.prisma.configItem.findMany({
      where: {
        namespaceId: ns.id,
        key: { in: keys },
        deletedAt: null,
      },
    });

    // 解密配置值
    return {
      items: configs.map((config) => ({
        id: config.publicId,
        key: config.key,
        value: this.decryptValue(config.value, config.isEncrypted),
        valueType: config.valueType,
        description: config.description,
        isEncrypted: config.isEncrypted,
        isEnabled: config.isEnabled,
        version: config.version,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
        namespace,
      })),
      pagination: {
        total: configs.length,
        page: 1,
        pageSize: configs.length,
      },
    };
  }

  /**
   * 获取配置项的变更历史
   */
  async getHistory(
    namespace: string,
    key: string,
    page: number = 1,
    pageSize: number = 10,
  ) {
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const config = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key,
        deletedAt: null,
      },
      select: {
        id: true,
        isEncrypted: true,
        valueType: true,
      },
    });

    if (!config) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        message: `配置项 "${namespace}:${key}" 不存在`,
        status: 404, // NOT_FOUND
      });
    }

    const skip = (page - 1) * pageSize;
    const where = { configId: config.id };

    const [histories, total] = await Promise.all([
      this.prisma.configHistory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { version: "desc" },
        include: {
          changedBy: {
            select: {
              publicId: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.configHistory.count({ where }),
    ]);

    // 解密历史值（如果当前配置是加密的）
    const items = histories.map((h) => ({
      version: h.version,
      value: this.decryptValue(h.value, config.isEncrypted),
      valueType: config.valueType,
      changeType: h.changeType,
      changeNote: h.changeNote,
      operator: h.changedBy
        ? { id: h.changedBy.publicId, name: h.changedBy.name }
        : null,
      createdAt: h.createdAt,
    }));

    return {
      items,
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * 回滚配置到指定版本
   */
  async rollback(
    namespace: string,
    key: string,
    targetVersion: number,
    changeNote?: string,
  ) {
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const config = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key,
        deletedAt: null,
      },
      select: {
        id: true,
        publicId: true,
        key: true,
        value: true,
        valueType: true,
        description: true,
        isEncrypted: true,
        isEnabled: true,
        version: true,
        jsonSchema: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!config) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        message: `配置项 "${namespace}:${key}" 不存在`,
        status: 404,
      });
    }

    // 查找目标版本的历史记录
    const targetHistory = await this.prisma.configHistory.findFirst({
      where: {
        configId: config.id,
        version: targetVersion,
      },
    });

    if (!targetHistory) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_VERSION_NOT_FOUND,
        message: `版本 ${targetVersion} 不存在`,
      });
    }

    // 如果有 Schema，校验目标版本的值是否符合当前 Schema
    if (config.jsonSchema) {
      const targetValue = this.decryptValue(
        targetHistory.value,
        config.isEncrypted,
      );
      this.schemaValidator.validate(targetValue, config.jsonSchema as object);
    }

    const newVersion = config.version + 1;

    // 事务执行回滚
    const result = await this.prisma.$transaction(async (tx) => {
      // 更新配置项
      const updated = await tx.configItem.update({
        where: { id: config.id },
        data: {
          value: targetHistory.value as never,
          configHash: targetHistory.configHash,
          version: newVersion,
        },
      });

      // 记录回滚历史
      await tx.configHistory.create({
        data: {
          configId: config.id,
          version: newVersion,
          value: targetHistory.value as never,
          configHash: targetHistory.configHash,
          changeType: ConfigChangeType.ROLLBACK,
          changeNote: changeNote || `回滚到版本 ${targetVersion}`,
        },
      });

      return updated;
    });

    // 失效缓存
    await this.cacheService.invalidate(namespace, key);

    // 推送变更通知
    this.gateway.notifyConfigChanged({
      namespace,
      key,
      version: result.version,
      configHash: result.configHash,
      changeType: ConfigChangeType.ROLLBACK,
      changedAt: result.updatedAt.toISOString(),
    });

    return {
      id: result.publicId,
      key: result.key,
      value: this.decryptValue(result.value, result.isEncrypted),
      valueType: result.valueType,
      description: result.description,
      isEncrypted: result.isEncrypted,
      isEnabled: result.isEnabled,
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      namespace,
    };
  }

  /**
   * 批量创建/更新配置项
   *
   * @param namespace 命名空间
   * @param dto 批量操作数据
   * @returns 批量操作结果
   */
  async batchUpsert(
    namespace: string,
    dto: BatchUpsertConfigDto,
  ): Promise<BatchOperationResponse> {
    // 验证命名空间存在
    await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const results: BatchOperationResult[] = [];
    let successful = 0;
    let failed = 0;

    // 逐个处理配置项（不使用事务，允许部分成功）
    for (const item of dto.items) {
      try {
        // 检查配置项是否存在
        let config;
        try {
          config = await this.findOne(namespace, item.key);
        } catch {
          // 配置不存在，执行创建
          config = null;
        }

        let result;
        if (config) {
          // 配置存在，执行更新
          result = await this.update(namespace, item.key, {
            value: item.value,
            valueType: item.valueType,
            description: item.description,
            isEncrypted: item.isEncrypted,
            isEnabled: item.isEnabled,
            jsonSchema: item.jsonSchema,
          });
        } else {
          // 配置不存在，执行创建
          result = await this.create(namespace, item);
        }

        results.push({
          key: item.key,
          success: true,
          data: result,
        });
        successful++;
      } catch (error) {
        results.push({
          key: item.key,
          success: false,
          error:
            error instanceof BusinessException
              ? error.message
              : error instanceof Error
                ? error.message
                : String(error),
        });
        failed++;
      }
    }

    return {
      total: dto.items.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * 获取公开配置项（匿名访问）
   * 只返回 isPublic=true 且 isEnabled=true 的配置
   */
  async findPublicByKey(namespace: string, key: string) {
    // 验证命名空间存在
    const ns =
      await this.namespaceService.getNamespaceInternalOrThrow(namespace);

    const config = await this.prisma.configItem.findFirst({
      where: {
        namespaceId: ns.id,
        key,
        isPublic: true,
        isEnabled: true,
        deletedAt: null,
      },
    });

    if (!config) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ITEM_NOT_FOUND,
        message: `公开配置项 "${namespace}:${key}" 不存在`,
        status: 404,
      });
    }

    return {
      id: config.publicId,
      key: config.key,
      value: this.decryptValue(config.value, config.isEncrypted),
      valueType: config.valueType,
      description: config.description,
      isEncrypted: config.isEncrypted,
      isEnabled: config.isEnabled,
      version: config.version,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      namespace,
    };
  }
}
