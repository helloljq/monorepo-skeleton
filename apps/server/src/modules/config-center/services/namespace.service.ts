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

type NamespaceItem = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

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
  async create(dto: CreateNamespaceDto): Promise<NamespaceItem> {
    const existing = await this.prisma.configNamespace.findFirst({
      where: { name: dto.name, deletedAt: null },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_NAMESPACE_EXISTS,
        message: `命名空间 "${dto.name}" 已存在`,
        status: 409,
      });
    }

    const created = await this.prisma.configNamespace.create({
      data: {
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
    });

    await this.cacheService.invalidateNamespaceList();

    return this.toNamespaceItem(created);
  }

  /**
   * 查询命名空间列表（分页）
   */
  async findAll(query: QueryNamespaceDto) {
    const { page = 1, pageSize: rawPageSize, limit, isEnabled } = query;
    const pageSize = rawPageSize ?? limit ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ConfigNamespaceWhereInput = {
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, total] = await Promise.all([
      this.prisma.soft.configNamespace.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.soft.configNamespace.count({ where }),
    ]);

    return {
      items: data.map((n) => this.toNamespaceItem(n)),
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * 根据名称获取命名空间
   */
  async findByName(name: string): Promise<NamespaceItem> {
    const namespace = await this.getNamespaceInternalOrThrow(name);
    return this.toNamespaceItem(namespace);
  }

  /**
   * 更新命名空间
   */
  async update(name: string, dto: UpdateNamespaceDto): Promise<NamespaceItem> {
    const namespace = await this.getNamespaceInternalOrThrow(name);

    const updated = await this.prisma.raw.configNamespace.update({
      where: { id: namespace.id },
      data: {
        displayName: dto.displayName,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
    });

    await this.cacheService.invalidateNamespaceList();

    return this.toNamespaceItem(updated);
  }

  /**
   * 删除命名空间（软删除）
   *
   * 删除前检查是否存在活跃配置项，若存在则拒绝删除
   */
  async remove(name: string): Promise<void> {
    const namespace = await this.getNamespaceInternalOrThrow(name);

    const activeItemsCount = await this.prisma.configItem.count({
      where: { namespaceId: namespace.id, deletedAt: null },
    });

    if (activeItemsCount > 0) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_NAMESPACE_HAS_ITEMS,
        message: `命名空间 "${name}" 下还有 ${activeItemsCount} 个活跃配置项，请先删除或迁移配置项`,
      });
    }

    await this.prisma.genericSoftDelete("ConfigNamespace", namespace.id, {
      reason: "用户删除命名空间",
    });

    await this.cacheService.invalidateNamespaceList();
  }

  async getNamespaceInternalOrThrow(name: string) {
    const namespace = await this.prisma.configNamespace.findFirst({
      where: { name, deletedAt: null },
    });

    if (!namespace) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_NAMESPACE_NOT_FOUND,
        message: `命名空间 "${name}" 不存在`,
        status: 404,
      });
    }

    return namespace;
  }

  private toNamespaceItem(namespace: {
    publicId: string;
    name: string;
    displayName: string;
    description: string | null;
    isEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): NamespaceItem {
    return {
      id: namespace.publicId,
      name: namespace.name,
      displayName: namespace.displayName,
      description: namespace.description,
      isEnabled: namespace.isEnabled,
      createdAt: namespace.createdAt,
      updatedAt: namespace.updatedAt,
    };
  }
}
