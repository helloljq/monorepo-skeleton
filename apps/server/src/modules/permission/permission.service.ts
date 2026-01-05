import { HttpStatus, Injectable, Logger } from "@nestjs/common";

import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { PermissionCacheService } from "../auth/services/permission-cache.service";
import {
  CreatePermissionDto,
  QueryPermissionDto,
  UpdatePermissionDto,
} from "./dto";

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  /**
   * 获取权限列表（分页）
   */
  async findAll(query: QueryPermissionDto) {
    const { page, limit, module, resource, isEnabled } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(module && { module }),
      ...(resource && { resource }),
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ module: "asc" }, { resource: "asc" }, { action: "asc" }],
      }),
      this.prisma.permission.count({ where }),
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
   * 获取权限详情
   */
  async findOne(id: number) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: {
        RolePermission: {
          include: {
            Role: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                isEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!permission) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    return permission;
  }

  /**
   * 获取权限模块分组
   */
  async findModules() {
    const modules = await this.prisma.permission.groupBy({
      by: ["module"],
      where: {
        module: { not: null },
      },
      _count: {
        id: true,
      },
      orderBy: {
        module: "asc",
      },
    });

    const data = modules.map((m) => ({
      module: m.module,
      count: m._count.id,
    }));

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
   * 创建权限
   */
  async create(dto: CreatePermissionDto) {
    // 检查 code 唯一性
    const existing = await this.prisma.permission.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.CONFLICT,
        message: "Permission code already exists",
        status: HttpStatus.CONFLICT,
      });
    }

    return this.prisma.permission.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        resource: dto.resource,
        action: dto.action,
        module: dto.module,
      },
    });
  }

  /**
   * 更新权限
   */
  async update(id: number, dto: UpdatePermissionDto) {
    const permission = await this.findOne(id);

    const updated = await this.prisma.permission.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        module: dto.module,
        isEnabled: dto.isEnabled,
      },
    });

    // 如果权限状态变更，需要失效相关角色的缓存
    if (dto.isEnabled !== undefined && dto.isEnabled !== permission.isEnabled) {
      const affectedRoles = permission.RolePermission.map((rp) => rp.Role.code);
      if (affectedRoles.length > 0) {
        await this.permissionCache.invalidateRoleCaches(affectedRoles);
        this.logger.debug(
          { permissionId: id, affectedRoles },
          "[permission] Invalidated role caches due to permission status change",
        );
      }
    }

    return updated;
  }

  /**
   * 删除权限
   * 注意: Permission 不支持软删除，直接硬删除
   */
  async remove(id: number) {
    const permission = await this.findOne(id);

    // 获取受影响的角色，用于后续失效缓存
    const affectedRoles = permission.RolePermission.map((rp) => rp.Role.code);

    await this.prisma.permission.delete({
      where: { id },
    });

    // 失效相关角色的缓存
    if (affectedRoles.length > 0) {
      await this.permissionCache.invalidateRoleCaches(affectedRoles);
      this.logger.debug(
        { permissionId: id, affectedRoles },
        "[permission] Invalidated role caches due to permission deletion",
      );
    }

    return { message: "Permission deleted successfully" };
  }
}
