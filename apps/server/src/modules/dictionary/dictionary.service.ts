import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import Redis from "ioredis";

import { getAuditContext } from "../../common/audit/audit-context";
import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  CreateDictionaryDto,
  GetByTypeDto,
  QueryDictionaryDto,
  UpdateDictionaryDto,
} from "./dto";

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);
  private readonly CACHE_PREFIX = "dict:type:";
  private readonly CACHE_TTL = 3600; // 1 小时

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * 获取字典列表（分页）
   */
  async findAll(query: QueryDictionaryDto) {
    const { page, limit, type, isEnabled } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(type && { type }),
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, total] = await Promise.all([
      this.prisma.soft.dictionary.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ type: "asc" }, { sort: "asc" }, { createdAt: "desc" }],
      }),
      this.prisma.soft.dictionary.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取字典元数据（轻量级，仅返回 key + version + configHash）
   * 前端用于判断本地缓存是否过期，避免重复拉取完整数据
   */
  async getMetaByType(params: GetByTypeDto & { type: string }) {
    const { type, isEnabled } = params;

    const data = await this.prisma.soft.dictionary.findMany({
      where: {
        type,
        ...(isEnabled !== undefined && { isEnabled }),
      },
      select: {
        key: true,
        version: true,
        configHash: true,
      },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    });

    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      },
    };
  }

  /**
   * 按类型获取字典列表（带缓存）
   * 前端最常用接口
   */
  async findByType(params: GetByTypeDto & { type: string }) {
    const { type, isEnabled } = params;
    const cacheKey = `${this.CACHE_PREFIX}${type}:${isEnabled ? "enabled" : "all"}`;

    try {
      // 1. 尝试从缓存获取
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsedCache = JSON.parse(cached) as unknown;
        // 兼容旧缓存格式（数组）和新缓存格式（带 meta）
        if (Array.isArray(parsedCache)) {
          return {
            data: parsedCache,
            meta: {
              total: parsedCache.length,
              page: 1,
              limit: parsedCache.length,
              totalPages: 1,
            },
          };
        }
        return parsedCache as {
          data: unknown[];
          meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
          };
        };
      }
    } catch (error) {
      this.logger.warn(
        { type, error: error instanceof Error ? error.message : error },
        "[dictionary] Redis get failed, fallback to DB",
      );
    }

    // 2. 从数据库加载
    const data = await this.prisma.soft.dictionary.findMany({
      where: {
        type,
        ...(isEnabled !== undefined && { isEnabled }),
      },
      orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    });

    const result = {
      data,
      meta: {
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      },
    };

    // 3. 写入缓存（异步，不阻塞返回）
    this.redis
      .setex(cacheKey, this.CACHE_TTL, JSON.stringify(result))
      .catch((error: unknown) => {
        this.logger.warn(
          { type, error: error instanceof Error ? error.message : error },
          "[dictionary] Redis set failed",
        );
      });

    return result;
  }

  /**
   * 获取字典详情
   */
  async findOne(id: number) {
    const dict = await this.prisma.soft.dictionary.findUnique({
      where: { id },
    });

    if (!dict) {
      throw new BusinessException({
        code: ApiErrorCode.DICT_NOT_FOUND,
        message: "Dictionary not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    return dict;
  }

  /**
   * 根据 type + key 查询字典项（精确查询）
   */
  async findByTypeAndKey(type: string, key: string) {
    const dict = await this.prisma.soft.dictionary.findUnique({
      where: {
        type_key: { type, key },
      },
    });

    if (!dict) {
      throw new BusinessException({
        code: ApiErrorCode.DICT_NOT_FOUND,
        message: `Dictionary not found: type=${type}, key=${key}`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    return dict;
  }

  /**
   * 创建字典
   */
  async create(dto: CreateDictionaryDto) {
    // 检查 type + key 唯一性 (仅检查未软删除的记录,允许重新创建已软删除的记录)
    const existing = await this.prisma.soft.dictionary.findUnique({
      where: {
        type_key: {
          type: dto.type,
          key: dto.key,
        },
      },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.DICT_KEY_EXISTS,
        message: `Dictionary key already exists: type=${dto.type}, key=${dto.key}`,
        status: HttpStatus.CONFLICT,
      });
    }

    const configHash = this.calculateConfigHash(dto.value);

    const created = await this.prisma.dictionary.create({
      data: {
        type: dto.type,
        key: dto.key,
        value: dto.value as Prisma.InputJsonValue,
        label: dto.label,
        description: dto.description,
        sort: dto.sort ?? 0,
        isEnabled: dto.isEnabled ?? true,
        version: dto.version,
        configHash,
      },
    });

    // 失效缓存
    await this.invalidateTypeCache(dto.type);

    return created;
  }

  /**
   * 更新字典
   */
  async update(id: number, dto: UpdateDictionaryDto) {
    const dict = await this.findOne(id);

    // 如果 value 被更新，重新计算 configHash
    const configHash =
      dto.value !== undefined ? this.calculateConfigHash(dto.value) : undefined;

    const updated = await this.prisma.dictionary.update({
      where: { id },
      data: {
        value:
          dto.value !== undefined
            ? (dto.value as Prisma.InputJsonValue)
            : undefined,
        label: dto.label,
        description: dto.description,
        sort: dto.sort,
        isEnabled: dto.isEnabled,
        version: dto.version,
        configHash,
      },
    });

    // 失效缓存
    await this.invalidateTypeCache(dict.type);

    return updated;
  }

  /**
   * 删除字典（软删除）
   */
  async remove(id: number): Promise<{ message: string }> {
    const dict = await this.findOne(id);

    const auditCtx = getAuditContext();

    await this.prisma.genericSoftDelete("Dictionary", id, {
      actorUserId: auditCtx?.actorUserId,
      reason: "Deleted by admin",
    });

    // 失效缓存
    await this.invalidateTypeCache(dict.type);

    return { message: "Dictionary deleted successfully" };
  }

  /**
   * 批量创建字典（用于数据初始化）
   */
  async bulkCreate(items: CreateDictionaryDto[]) {
    // 检查是否有重复的 type+key
    const uniqueKeys = new Set<string>();
    for (const item of items) {
      const key = `${item.type}:${item.key}`;
      if (uniqueKeys.has(key)) {
        throw new BusinessException({
          code: ApiErrorCode.DICT_KEY_EXISTS,
          message: `Duplicate key in bulk create: ${key}`,
          status: HttpStatus.BAD_REQUEST,
        });
      }
      uniqueKeys.add(key);
    }

    // 事务批量插入
    const created = await this.prisma.$transaction(
      items.map((item) => {
        const configHash = this.calculateConfigHash(item.value);
        return this.prisma.dictionary.create({
          data: {
            type: item.type,
            key: item.key,
            value: item.value as Prisma.InputJsonValue,
            label: item.label,
            description: item.description,
            sort: item.sort ?? 0,
            isEnabled: item.isEnabled ?? true,
            version: item.version,
            configHash,
          },
        });
      }),
    );

    // 批量失效缓存
    const types = [...new Set(items.map((item) => item.type))];
    await Promise.all(types.map((type) => this.invalidateTypeCache(type)));

    return { count: created.length, data: created };
  }

  /**
   * 计算 value 的 MD5 hash
   * 用于前端判断配置是否变化，避免重复拉取相同数据
   */
  private calculateConfigHash(value: unknown): string {
    const jsonString = JSON.stringify(value);
    return createHash("md5").update(jsonString).digest("hex");
  }

  /**
   * 失效某个类型的缓存
   * 使用固定 key 格式避免 KEYS 命令性能问题
   */
  private async invalidateTypeCache(type: string): Promise<void> {
    try {
      const keys = [
        `${this.CACHE_PREFIX}${type}:enabled`,
        `${this.CACHE_PREFIX}${type}:all`,
      ];
      await this.redis.del(...keys);
      this.logger.debug({ type, keys }, "[dictionary] Cache invalidated");
    } catch (error) {
      this.logger.warn(
        { type, error: error instanceof Error ? error.message : error },
        "[dictionary] Cache invalidation failed",
      );
    }
  }

  /**
   * 清空所有字典缓存（谨慎使用）
   * 注意: 此方法使用 KEYS 命令，仅用于管理操作，不应在业务流程中调用
   */
  async invalidateAllCache(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length) {
        await this.redis.del(...keys);
        this.logger.warn(
          { count: keys.length },
          "[dictionary] All cache invalidated (admin operation)",
        );
      }
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : error },
        "[dictionary] All cache invalidation failed",
      );
    }
  }
}
