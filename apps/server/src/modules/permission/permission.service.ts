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

type RoleItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  isEnabled: boolean;
};

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
    const {
      page,
      pageSize: rawPageSize,
      limit,
      module,
      resource,
      isEnabled,
    } = query;
    const pageSize = rawPageSize ?? limit ?? 10;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(module && { module }),
      ...(resource && { resource }),
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [permissions, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ module: "asc" }, { resource: "asc" }, { action: "asc" }],
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      items: permissions.map((permission) => ({
        id: permission.publicId,
        code: permission.code,
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
        module: permission.module,
        isEnabled: permission.isEnabled,
        createdAt: permission.createdAt,
        updatedAt: permission.updatedAt,
      })),
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * 获取权限详情
   */
  async findOne(permissionPublicId: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { publicId: permissionPublicId },
      include: {
        rolePermissions: {
          include: {
            role: {
              select: {
                publicId: true,
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

    const roles: RoleItem[] = permission.rolePermissions.map((rp) => ({
      id: rp.role.publicId,
      code: rp.role.code,
      name: rp.role.name,
      type: rp.role.type,
      isEnabled: rp.role.isEnabled,
    }));

    return {
      id: permission.publicId,
      code: permission.code,
      name: permission.name,
      description: permission.description,
      resource: permission.resource,
      action: permission.action,
      module: permission.module,
      isEnabled: permission.isEnabled,
      createdAt: permission.createdAt,
      updatedAt: permission.updatedAt,
      roles,
    };
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

    const items = modules.map((m) => ({
      module: m.module,
      count: m._count.id,
    }));

    return {
      items,
      pagination: {
        total: items.length,
        page: 1,
        pageSize: items.length,
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

    const created = await this.prisma.permission.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        resource: dto.resource,
        action: dto.action,
        module: dto.module,
      },
    });

    return {
      id: created.publicId,
      code: created.code,
      name: created.name,
      description: created.description,
      resource: created.resource,
      action: created.action,
      module: created.module,
      isEnabled: created.isEnabled,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * 更新权限
   */
  async update(permissionPublicId: string, dto: UpdatePermissionDto) {
    const current = await this.prisma.permission.findUnique({
      where: { publicId: permissionPublicId },
      include: {
        rolePermissions: { include: { role: { select: { code: true } } } },
      },
    });

    if (!current) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    const updated = await this.prisma.permission.update({
      where: { id: current.id },
      data: {
        name: dto.name,
        description: dto.description,
        module: dto.module,
        isEnabled: dto.isEnabled,
      },
    });

    // 如果权限状态变更，需要失效相关角色的缓存
    if (
      dto.isEnabled !== undefined &&
      dto.isEnabled !== current.isEnabled &&
      current.rolePermissions.length > 0
    ) {
      const affectedRoles = current.rolePermissions.map((rp) => rp.role.code);
      await this.permissionCache.invalidateRoleCaches(affectedRoles);
      this.logger.debug(
        { permissionPublicId, affectedRoles },
        "[permission] Invalidated role caches due to permission status change",
      );
    }

    return {
      id: updated.publicId,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      resource: updated.resource,
      action: updated.action,
      module: updated.module,
      isEnabled: updated.isEnabled,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * 删除权限
   * 注意: Permission 不支持软删除，直接硬删除
   */
  async remove(permissionPublicId: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { publicId: permissionPublicId },
      include: {
        rolePermissions: { include: { role: { select: { code: true } } } },
      },
    });

    if (!permission) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    const affectedRoles = permission.rolePermissions.map((rp) => rp.role.code);

    await this.prisma.permission.delete({
      where: { id: permission.id },
    });

    // 失效相关角色的缓存
    if (affectedRoles.length > 0) {
      await this.permissionCache.invalidateRoleCaches(affectedRoles);
      this.logger.debug(
        { permissionPublicId, affectedRoles },
        "[permission] Invalidated role caches due to permission deletion",
      );
    }

    return { message: "Permission deleted successfully" };
  }
}
