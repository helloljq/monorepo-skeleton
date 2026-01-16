import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { RoleType } from "@prisma/client";

import { getAuditContext } from "../../common/audit/audit-context";
import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { PermissionCacheService } from "../auth/services/permission-cache.service";
import { CreateRoleDto, QueryRoleDto, UpdateRoleDto } from "./dto";

type PermissionItem = {
  id: string;
  code: string;
  name: string;
  resource: string;
  action: string;
  module: string | null;
  isEnabled: boolean;
};

@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  /**
   * 获取角色列表（分页）
   */
  async findAll(query: QueryRoleDto) {
    const { page, pageSize: rawPageSize, limit, isEnabled } = query;
    const pageSize = rawPageSize ?? limit ?? 10;
    const skip = (page - 1) * pageSize;

    const where = {
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [roles, total] = await Promise.all([
      this.prisma.soft.role.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              userRoles: true,
              rolePermissions: true,
            },
          },
        },
      }),
      this.prisma.soft.role.count({ where }),
    ]);

    return {
      items: roles.map((role) => ({
        id: role.publicId,
        code: role.code,
        name: role.name,
        description: role.description,
        type: role.type,
        isEnabled: role.isEnabled,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        userCount: role._count.userRoles,
        permissionCount: role._count.rolePermissions,
      })),
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * 获取角色详情（含权限列表）
   */
  async findOne(rolePublicId: string) {
    const role = await this.prisma.soft.role.findUnique({
      where: { publicId: rolePublicId },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                publicId: true,
                code: true,
                name: true,
                resource: true,
                action: true,
                module: true,
                isEnabled: true,
              },
            },
          },
        },
        _count: { select: { userRoles: true } },
      },
    });

    if (!role) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    return {
      id: role.publicId,
      code: role.code,
      name: role.name,
      description: role.description,
      type: role.type,
      isEnabled: role.isEnabled,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map(
        (rp): PermissionItem => ({
          id: rp.permission.publicId,
          code: rp.permission.code,
          name: rp.permission.name,
          resource: rp.permission.resource,
          action: rp.permission.action,
          module: rp.permission.module,
          isEnabled: rp.permission.isEnabled,
        }),
      ),
    };
  }

  /**
   * 获取角色的权限列表
   */
  async findRolePermissions(rolePublicId: string) {
    const role = await this.prisma.soft.role.findUnique({
      where: { publicId: rolePublicId },
      include: {
        rolePermissions: {
          include: {
            permission: {
              select: {
                publicId: true,
                code: true,
                name: true,
                resource: true,
                action: true,
                module: true,
                isEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    const items: PermissionItem[] = role.rolePermissions.map((rp) => ({
      id: rp.permission.publicId,
      code: rp.permission.code,
      name: rp.permission.name,
      resource: rp.permission.resource,
      action: rp.permission.action,
      module: rp.permission.module,
      isEnabled: rp.permission.isEnabled,
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
   * 创建角色
   */
  async create(dto: CreateRoleDto) {
    // 检查 code 唯一性
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.CONFLICT,
        message: "Role code already exists",
        status: HttpStatus.CONFLICT,
      });
    }

    const created = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: RoleType.CUSTOM,
      },
    });

    return {
      id: created.publicId,
      code: created.code,
      name: created.name,
      description: created.description,
      type: created.type,
      isEnabled: created.isEnabled,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * 更新角色
   */
  async update(rolePublicId: string, dto: UpdateRoleDto) {
    const role = await this.getRoleInternalOrThrow(rolePublicId);

    // 系统角色不可修改
    if (role.type === RoleType.SYSTEM) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
        message: "System role cannot be modified",
        status: HttpStatus.FORBIDDEN,
      });
    }

    const updated = await this.prisma.role.update({
      where: { id: role.id },
      data: {
        name: dto.name,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
    });

    // 角色更新后失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    return {
      id: updated.publicId,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      type: updated.type,
      isEnabled: updated.isEnabled,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * 删除角色（软删除）
   */
  async remove(rolePublicId: string): Promise<{ message: string }> {
    const role = await this.getRoleInternalOrThrow(rolePublicId);

    // 系统角色不可删除
    if (role.type === RoleType.SYSTEM) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
        message: "System role cannot be deleted",
        status: HttpStatus.FORBIDDEN,
      });
    }

    // 获取当前审计上下文中的用户 ID
    const auditCtx = getAuditContext();

    // 使用泛型软删除
    await this.prisma.genericSoftDelete("Role", role.id, {
      actorUserId: auditCtx?.actorUserId,
      reason: "Deleted by admin",
    });

    // 失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    return { message: "Role deleted successfully" };
  }

  /**
   * 为角色分配权限（替换模式）
   */
  async assignPermissions(rolePublicId: string, permissionPublicIds: string[]) {
    const role = await this.getRoleInternalOrThrow(rolePublicId);

    // 验证所有权限是否存在
    const permissions = await this.prisma.permission.findMany({
      where: {
        publicId: { in: permissionPublicIds },
      },
      select: { id: true, publicId: true },
    });

    if (permissions.length !== permissionPublicIds.length) {
      const foundIds = new Set(permissions.map((p) => p.publicId));
      const missingIds = permissionPublicIds.filter((id) => !foundIds.has(id));
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: `Permissions not found: ${missingIds.join(", ")}`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    // 获取当前用户 ID
    const auditCtx = getAuditContext();
    const grantedBy = auditCtx?.actorUserId;

    // 事务：删除旧权限 + 添加新权限
    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
          grantedById: grantedBy,
        })),
      });
    });

    // 失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    this.logger.debug(
      {
        rolePublicId,
        roleCode: role.code,
        permissionCount: permissionPublicIds.length,
      },
      "[role] Permissions assigned",
    );

    return { message: "Permissions assigned successfully" };
  }

  /**
   * 为角色添加单个权限
   */
  async addPermission(rolePublicId: string, permissionPublicId: string) {
    const role = await this.getRoleInternalOrThrow(rolePublicId);

    const permission = await this.prisma.permission.findUnique({
      where: { publicId: permissionPublicId },
      select: { id: true },
    });

    if (!permission) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_ALREADY_ASSIGNED,
        message: "Permission already assigned to this role",
        status: HttpStatus.CONFLICT,
      });
    }

    const auditCtx = getAuditContext();
    await this.prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id,
        grantedById: auditCtx?.actorUserId,
      },
    });

    await this.permissionCache.invalidateRoleCache(role.code);

    return { message: "Permission added successfully" };
  }

  /**
   * 移除角色的权限
   */
  async removePermission(rolePublicId: string, permissionPublicId: string) {
    const role = await this.getRoleInternalOrThrow(rolePublicId);

    const permission = await this.prisma.permission.findUnique({
      where: { publicId: permissionPublicId },
      select: { id: true },
    });

    if (!permission) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    const rolePermission = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
    });

    if (!rolePermission) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not assigned to this role",
        status: HttpStatus.NOT_FOUND,
      });
    }

    await this.prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
    });

    // 失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    return { message: "Permission removed successfully" };
  }

  private async getRoleInternalOrThrow(publicId: string): Promise<{
    id: number;
    publicId: string;
    code: string;
    type: RoleType;
  }> {
    const role = await this.prisma.soft.role.findUnique({
      where: { publicId },
      select: { id: true, publicId: true, code: true, type: true },
    });

    if (!role) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    return role;
  }
}
