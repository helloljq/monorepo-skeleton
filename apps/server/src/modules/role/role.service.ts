import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { RoleType } from "@prisma/client";

import { getAuditContext } from "../../common/audit/audit-context";
import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { PermissionCacheService } from "../auth/services/permission-cache.service";
import { CreateRoleDto, QueryRoleDto, UpdateRoleDto } from "./dto";

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
    const { page, limit, isEnabled } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(isEnabled !== undefined && { isEnabled }),
    };

    const [data, total] = await Promise.all([
      this.prisma.soft.role.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              UserRole: true,
              RolePermission: true,
            },
          },
        },
      }),
      this.prisma.soft.role.count({ where }),
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
   * 获取角色详情
   */
  async findOne(id: number) {
    const role = await this.prisma.soft.role.findUnique({
      where: { id },
      include: {
        RolePermission: {
          include: {
            Permission: {
              select: {
                id: true,
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
        _count: {
          select: { UserRole: true },
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

    return role;
  }

  /**
   * 获取角色的权限列表
   */
  async findRolePermissions(id: number) {
    const role = await this.prisma.soft.role.findUnique({
      where: { id },
      include: {
        RolePermission: {
          include: {
            Permission: {
              select: {
                id: true,
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

    const data = role.RolePermission.map((rp) => rp.Permission);

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

    return this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        type: RoleType.CUSTOM,
      },
    });
  }

  /**
   * 更新角色
   */
  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.findOne(id);

    // 系统角色不可修改
    if (role.type === RoleType.SYSTEM) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
        message: "System role cannot be modified",
        status: HttpStatus.FORBIDDEN,
      });
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isEnabled: dto.isEnabled,
      },
    });

    // 角色更新后失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    return updated;
  }

  /**
   * 删除角色（软删除）
   */
  async remove(id: number): Promise<{ message: string }> {
    const role = await this.findOne(id);

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
    await this.prisma.genericSoftDelete("Role", id, {
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
  async assignPermissions(roleId: number, permissionIds: number[]) {
    const role = await this.findOne(roleId);

    // 验证所有权限是否存在
    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
    });

    if (permissions.length !== permissionIds.length) {
      const foundIds = new Set(permissions.map((p) => p.id));
      const missingIds = permissionIds.filter((id) => !foundIds.has(id));
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
      await tx.rolePermission.deleteMany({ where: { roleId } });
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
          grantedBy,
        })),
      });
    });

    // 失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    this.logger.debug(
      { roleId, roleCode: role.code, permissionCount: permissionIds.length },
      "[role] Permissions assigned",
    );

    return { message: "Permissions assigned successfully" };
  }

  /**
   * 为角色添加单个权限
   */
  async addPermission(roleId: number, permissionId: number) {
    const role = await this.findOne(roleId);

    // 检查权限是否存在
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      throw new BusinessException({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
        message: "Permission not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    // 检查是否已分配
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
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
        roleId,
        permissionId,
        grantedBy: auditCtx?.actorUserId,
      },
    });

    // 失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    return { message: "Permission added successfully" };
  }

  /**
   * 移除角色的权限
   */
  async removePermission(roleId: number, permissionId: number) {
    const role = await this.findOne(roleId);

    const rolePermission = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
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
          roleId,
          permissionId,
        },
      },
    });

    // 失效缓存
    await this.permissionCache.invalidateRoleCache(role.code);

    return { message: "Permission removed successfully" };
  }
}
