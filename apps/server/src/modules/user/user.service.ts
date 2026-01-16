import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { getAuditContext } from "../../common/audit/audit-context";
import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { AssignRoleDto, QueryUserDto } from "./dto";

type RoleItem = {
  id: string;
  code: string;
  name: string;
  type: string;
  isEnabled: boolean;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取用户列表（分页）
   */
  async findAll(query: QueryUserDto) {
    const {
      page,
      pageSize: rawPageSize,
      limit,
      id,
      email,
      name,
      roleId,
      status,
    } = query;
    const pageSize = rawPageSize ?? limit ?? 10;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      ...(id !== undefined && { publicId: id }),
      ...(email !== undefined && {
        email: { contains: email, mode: "insensitive" as const },
      }),
      ...(name !== undefined && {
        name: { contains: name, mode: "insensitive" as const },
      }),
      ...(roleId !== undefined && {
        userRoles: {
          some: {
            role: { publicId: roleId },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        },
      }),
      ...(status !== undefined && { status }),
    };

    const [users, total] = await Promise.all([
      this.prisma.soft.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        select: {
          publicId: true,
          name: true,
          avatar: true,
          email: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              userRoles: true,
            },
          },
        },
      }),
      this.prisma.soft.user.count({ where }),
    ]);

    return {
      items: users.map((user) => ({
        id: user.publicId,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        roleCount: user._count.userRoles,
      })),
      pagination: {
        total,
        page,
        pageSize,
      },
    };
  }

  /**
   * 获取用户详情（带角色信息）
   */
  async findOne(userPublicId: string) {
    const user = await this.prisma.soft.user.findUnique({
      where: { publicId: userPublicId },
      include: {
        userRoles: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: {
            role: {
              select: {
                publicId: true,
                code: true,
                name: true,
                type: true,
                isEnabled: true,
                deletedAt: true,
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

    const roles: RoleItem[] = user.userRoles
      .filter((ur) => ur.role.isEnabled && !ur.role.deletedAt)
      .map((ur) => ({
        id: ur.role.publicId,
        code: ur.role.code,
        name: ur.role.name,
        type: ur.role.type,
        isEnabled: ur.role.isEnabled,
      }));

    return {
      id: user.publicId,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles,
    };
  }

  /**
   * 获取用户的角色列表
   */
  async findUserRoles(userPublicId: string) {
    const user = await this.getUserInternalOrThrow(userPublicId);

    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        role: {
          select: {
            publicId: true,
            code: true,
            name: true,
            type: true,
            isEnabled: true,
            deletedAt: true,
          },
        },
        grantedBy: {
          select: {
            publicId: true,
            name: true,
          },
        },
      },
    });

    const items = userRoles
      .filter((ur) => ur.role.isEnabled && !ur.role.deletedAt)
      .map((ur) => ({
        role: {
          id: ur.role.publicId,
          code: ur.role.code,
          name: ur.role.name,
          type: ur.role.type,
          isEnabled: ur.role.isEnabled,
        },
        grantedAt: ur.grantedAt,
        expiresAt: ur.expiresAt,
        grantedBy: ur.grantedBy
          ? { id: ur.grantedBy.publicId, name: ur.grantedBy.name }
          : null,
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
   * 为用户分配角色
   */
  async assignRole(userPublicId: string, dto: AssignRoleDto) {
    const user = await this.getUserInternalOrThrow(userPublicId);

    const role = await this.prisma.soft.role.findUnique({
      where: { publicId: dto.roleId },
      select: {
        id: true,
        publicId: true,
        code: true,
        name: true,
        isEnabled: true,
      },
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

    const existing = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
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
        userId: user.id,
        roleId: role.id,
        grantedById: auditCtx?.actorUserId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      select: {
        grantedAt: true,
        expiresAt: true,
      },
    });

    this.logger.debug(
      { userPublicId, rolePublicId: role.publicId, roleCode: role.code },
      "[user] Role assigned",
    );

    return {
      message: "Role assigned successfully",
      userRole: {
        roleId: role.publicId,
        roleCode: role.code,
        roleName: role.name,
        grantedAt: userRole.grantedAt,
        expiresAt: userRole.expiresAt,
      },
    };
  }

  /**
   * 批量为用户分配角色（替换模式）
   */
  async assignRoles(userPublicId: string, rolePublicIds: string[]) {
    const user = await this.getUserInternalOrThrow(userPublicId);

    const roles = await this.prisma.soft.role.findMany({
      where: {
        publicId: { in: rolePublicIds },
        isEnabled: true,
      },
      select: { id: true, publicId: true },
    });

    if (roles.length !== rolePublicIds.length) {
      const found = new Set(roles.map((r) => r.publicId));
      const missingIds = rolePublicIds.filter((id) => !found.has(id));
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: `Roles not found or disabled: ${missingIds.join(", ")}`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const auditCtx = getAuditContext();
    const grantedBy = auditCtx?.actorUserId;

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.userRole.deleteMany({ where: { userId: user.id } });
      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: user.id,
          roleId: role.id,
          grantedById: grantedBy,
        })),
      });
    });

    this.logger.debug(
      { userPublicId, roleCount: rolePublicIds.length },
      "[user] Roles replaced",
    );

    return { message: "Roles assigned successfully" };
  }

  /**
   * 移除用户的角色
   */
  async removeRole(userPublicId: string, rolePublicId: string) {
    const user = await this.getUserInternalOrThrow(userPublicId);

    const role = await this.prisma.soft.role.findUnique({
      where: { publicId: rolePublicId },
      select: { id: true, code: true },
    });

    if (!role) {
      throw new BusinessException({
        code: ApiErrorCode.ROLE_NOT_FOUND,
        message: "Role not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    const userRole = await this.prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
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
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    this.logger.debug(
      { userPublicId, rolePublicId, roleCode: role.code },
      "[user] Role removed",
    );

    return { message: "Role removed successfully" };
  }

  private async getUserInternalOrThrow(
    publicId: string,
  ): Promise<{ id: number }> {
    const user = await this.prisma.soft.user.findUnique({
      where: { publicId },
      select: { id: true },
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
}
