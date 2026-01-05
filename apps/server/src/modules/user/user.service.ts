import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { getAuditContext } from "../../common/audit/audit-context";
import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AssignRoleDto, QueryUserDto } from "./dto";

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取用户列表（分页）
   */
  async findAll(query: QueryUserDto) {
    const { page, limit, id, email, name, roleId, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(id !== undefined && { id }),
      ...(email !== undefined && {
        email: { contains: email, mode: "insensitive" as const },
      }),
      ...(name !== undefined && {
        name: { contains: name, mode: "insensitive" as const },
      }),
      ...(roleId !== undefined && {
        roles: {
          some: {
            roleId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      }),
      ...(status !== undefined && { status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.soft.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          avatar: true,
          email: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              UserRole_UserRole_userIdToUser: true,
            },
          },
        },
      }),
      this.prisma.soft.user.count({ where }),
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
   * 获取用户详情（带角色信息）
   */
  async findOne(id: number) {
    const user = await this.prisma.soft.user.findUnique({
      where: { id },
      include: {
        UserRole_UserRole_userIdToUser: {
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

    if (!user) {
      throw new BusinessException({
        code: ApiErrorCode.USER_NOT_FOUND,
        message: "User not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    return user;
  }

  /**
   * 获取用户的角色列表
   */
  async findUserRoles(userId: number) {
    // 先验证用户存在
    await this.findOne(userId);

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        Role: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            isEnabled: true,
            deletedAt: true,
          },
        },
        User_UserRole_grantedByToUser: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 过滤掉已删除或禁用的角色
    const data = userRoles
      .filter((ur: typeof userRoles[number]) => ur.Role.isEnabled && !ur.Role.deletedAt)
      .map((ur: typeof userRoles[number]) => ({
        id: ur.id,
        roleId: ur.Role.id,
        roleCode: ur.Role.code,
        roleName: ur.Role.name,
        roleType: ur.Role.type,
        grantedAt: ur.grantedAt,
        expiresAt: ur.expiresAt,
        grantedBy: ur.User_UserRole_grantedByToUser,
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
   * 为用户分配角色
   */
  async assignRole(userId: number, dto: AssignRoleDto) {
    // 验证用户存在
    await this.findOne(userId);

    // 验证角色存在且启用
    const role = await this.prisma.soft.role.findUnique({
      where: { id: dto.roleId },
    });

    if (!role) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    if (!role.isEnabled) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role is disabled",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    // 检查是否已分配
    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId: dto.roleId,
        },
      },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_ALREADY_ASSIGNED,
        message: "Role already assigned to this user",
        status: HttpStatus.CONFLICT,
      });
    }

    const auditCtx = getAuditContext();

    const userRole = await this.prisma.userRole.create({
      data: {
        userId,
        roleId: dto.roleId,
        grantedBy: auditCtx?.actorUserId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        Role: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    this.logger.debug(
      { userId, roleId: dto.roleId, roleCode: role.code },
      "[user] Role assigned",
    );

    return {
      message: "Role assigned successfully",
      userRole: {
        id: userRole.id,
        roleId: userRole.roleId,
        roleCode: userRole.Role.code,
        roleName: userRole.Role.name,
        grantedAt: userRole.grantedAt,
        expiresAt: userRole.expiresAt,
      },
    };
  }

  /**
   * 批量为用户分配角色（替换模式）
   */
  async assignRoles(userId: number, roleIds: number[]) {
    // 验证用户存在
    await this.findOne(userId);

    // 验证所有角色存在且启用
    const roles = await this.prisma.soft.role.findMany({
      where: {
        id: { in: roleIds },
        isEnabled: true,
      },
    });

    if (roles.length !== roleIds.length) {
      const foundIds = new Set(roles.map((r: typeof roles[number]) => r.id));
      const missingIds = roleIds.filter((id: number) => !foundIds.has(id));
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: `Roles not found or disabled: ${missingIds.join(", ")}`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const auditCtx = getAuditContext();
    const grantedBy = auditCtx?.actorUserId;

    // 事务：删除旧角色 + 添加新角色
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userRole.createMany({
        data: roleIds.map((roleId: number) => ({
          userId,
          roleId,
          grantedBy,
        })),
      });
    });

    this.logger.debug(
      { userId, roleCount: roleIds.length },
      "[user] Roles replaced",
    );

    return { message: "Roles assigned successfully" };
  }

  /**
   * 移除用户的角色
   */
  async removeRole(userId: number, roleId: number) {
    // 验证用户存在
    await this.findOne(userId);

    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      include: {
        Role: {
          select: { code: true },
        },
      },
    });

    if (!userRole) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role not assigned to this user",
        status: HttpStatus.NOT_FOUND,
      });
    }

    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    this.logger.debug(
      { userId, roleId, roleCode: userRole.Role.code },
      "[user] Role removed",
    );

    return { message: "Role removed successfully" };
  }
}
