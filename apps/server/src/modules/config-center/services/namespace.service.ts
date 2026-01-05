import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import { PrismaService } from "../../../database/prisma/prisma.service";
import {
  CreateNamespaceDto,
  QueryNamespaceDto,
  UpdateNamespaceDto,
} from "../dto";
import { ConfigCacheService } from "./config-cache.service";

/**
 * 配置命名空间服务
 */
@Injectable()
export class NamespaceService {
  private readonly logger = new Logger(NamespaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: ConfigCacheService,
  ) {}

  /**
   * 创建命名空间
   */
  async create(dto: CreateNamespaceDto) {
    // 检查名称是否已存在
    const existing = await this.prisma.configNamespace.findFirst({
      where: { name: dto.name, deletedAt: null },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_NAMESPACE_EXISTS,
        message: `命名空间 "${dto.name}" 已存在`,
        status: 409, // CONFLICT
      });
    }

    const result = await this.prisma.configNamespace.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
    });

    // 失效命名空间列表缓存
    await this.cacheService.invalidateNamespaceList();

    return result;
  }

  /**
   * 查询命名空间列表（分页）
   */
  async findAll(query: QueryNamespaceDto) {
    const { page = 1, limit = 10, isEnabled } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ConfigNamespaceWhereInput = {
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, total] = await Promise.all([
      this.prisma.soft.configNamespace.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.soft.configNamespace.count({ where }),
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
   * 根据名称获取命名空间
   */
  async findByName(name: string) {
    const namespace = await this.prisma.configNamespace.findFirst({
      where: { name, deletedAt: null },
    });

    if (!namespace) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_NAMESPACE_NOT_FOUND,
        message: `命名空间 "${name}" 不存在`,
        status: 404, // NOT_FOUND
      });
    }

    return namespace;
  }

  /**
   * 更新命名空间
   */
  async update(name: string, dto: UpdateNamespaceDto) {
    // 检查命名空间是否存在
    const namespace = await this.findByName(name);

    const result = await this.prisma.raw.configNamespace.update({
      where: { id: namespace.id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
    });

    // 失效命名空间列表缓存
    await this.cacheService.invalidateNamespaceList();

    return result;
  }

  /**
   * 删除命名空间（软删除）
   *
   * 删除前检查是否存在活跃配置项，若存在则拒绝删除
   */
  async remove(
    name: string,
  ): Promise<{ id: number; deletedAt: Date | null } | null> {
    // 检查命名空间是否存在
    const namespace = await this.findByName(name);

    // 检查是否有活跃的配置项
    const activeItemsCount = await this.prisma.configItem.count({
      where: { namespaceId: namespace.id, deletedAt: null },
    });

    if (activeItemsCount > 0) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_NAMESPACE_HAS_ITEMS,
        message: `命名空间 "${name}" 下还有 ${activeItemsCount} 个活跃配置项，请先删除或迁移配置项`,
      });
    }

    // 执行软删除
    const result = await this.prisma.genericSoftDelete(
      "ConfigNamespace",
      namespace.id,
      {
        reason: "用户删除命名空间",
      },
    );

    // 失效命名空间列表缓存
    await this.cacheService.invalidateNamespaceList();

    return result;
  }
}
