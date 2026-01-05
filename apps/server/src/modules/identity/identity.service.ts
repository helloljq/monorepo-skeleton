import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { IdentityProvider } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";

/**
 * 用户身份信息（带角色）
 */
export interface UserWithRoles {
  id: number;
  email: string | null;
  name: string | null;
  status: string;
  avatar: string | null;
  roles: string[];
}

/**
 * 登录结果
 */
export interface LoginResult {
  user: UserWithRoles;
  isNewUser: boolean;
}

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 通过邮箱密码验证身份
   */
  async validateEmailPassword(
    email: string,
    password: string,
  ): Promise<LoginResult> {
    // 1. 查找邮箱身份
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: IdentityProvider.EMAIL,
          providerId: email.toLowerCase(),
        },
      },
      include: {
        User: {
          include: {
            UserRole_UserRole_userIdToUser: {
              where: {
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              include: {
                Role: {
                  select: { code: true, isEnabled: true, deletedAt: true },
                },
              },
            },
          },
        },
      },
    });

    if (!identity) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
        message: "Invalid credentials",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // 2. 检查用户状态
    if (identity.User.status === "DISABLED") {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_USER_DISABLED,
        message: "User account is disabled",
        status: HttpStatus.FORBIDDEN,
      });
    }

    // 3. 验证密码
    if (!identity.credential) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
        message: "Invalid credentials",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    const isMatch = await bcrypt.compare(password, identity.credential);
    if (!isMatch) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
        message: "Invalid credentials",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // 4. 提取有效角色
    const roles = identity.User.UserRole_UserRole_userIdToUser.filter(
      (ur) => ur.Role.isEnabled && !ur.Role.deletedAt,
    ).map((ur) => ur.Role.code);

    return {
      user: {
        id: identity.User.id,
        email: identity.User.email,
        name: identity.User.name,
        status: identity.User.status,
        avatar: identity.User.avatar,
        roles,
      },
      isNewUser: false,
    };
  }

  /**
   * 通过手机号验证码登录（自动注册）
   */
  async validatePhoneCode(phone: string): Promise<LoginResult> {
    // 1. 查找手机号身份
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: IdentityProvider.PHONE,
          providerId: phone,
        },
      },
      include: {
        User: {
          include: {
            UserRole_UserRole_userIdToUser: {
              where: {
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              include: {
                Role: {
                  select: { code: true, isEnabled: true, deletedAt: true },
                },
              },
            },
          },
        },
      },
    });

    // 2. 如果身份存在，直接返回
    if (identity) {
      // 检查用户状态
      if (identity.User.status === "DISABLED") {
        throw new BusinessException({
          code: ApiErrorCode.AUTH_USER_DISABLED,
          message: "User account is disabled",
          status: HttpStatus.FORBIDDEN,
        });
      }

      const roles = identity.User.UserRole_UserRole_userIdToUser.filter(
        (ur) => ur.Role.isEnabled && !ur.Role.deletedAt,
      ).map((ur) => ur.Role.code);

      return {
        user: {
          id: identity.User.id,
          email: identity.User.email,
          name: identity.User.name,
          status: identity.User.status,
          avatar: identity.User.avatar,
          roles,
        },
        isNewUser: false,
      };
    }

    // 3. 自动注册新用户
    const newUser = await this.createUserWithPhoneIdentity(phone);

    return {
      user: newUser,
      isNewUser: true,
    };
  }

  /**
   * 创建用户和手机号身份
   */
  private async createUserWithPhoneIdentity(
    phone: string,
  ): Promise<UserWithRoles> {
    // 查找默认 USER 角色
    const userRole = await this.prisma.role.findUnique({
      where: { code: "USER" },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 创建用户 (email/password 为兼容字段，手机用户使用占位值)
      const user = await tx.user.create({
        data: {
          email: `phone_${phone}@placeholder.local`,
          password: "", // 手机用户无密码
          status: "ACTIVE",
          // 分配默认角色
          ...(userRole && {
            UserRole_UserRole_userIdToUser: {
              create: {
                roleId: userRole.id,
              },
            },
          }),
        },
      });

      // 2. 创建手机号身份
      await tx.userIdentity.create({
        data: {
          userId: user.id,
          provider: IdentityProvider.PHONE,
          providerId: phone,
          verified: true,
        },
      });

      return user;
    });

    return {
      id: result.id,
      email: result.email,
      name: result.name,
      status: result.status,
      avatar: result.avatar,
      roles: userRole ? ["USER"] : [],
    };
  }

  /**
   * 为现有用户创建邮箱身份（注册时使用）
   *
   * 特殊逻辑：如果是系统中的第一个用户，自动分配 SUPER_ADMIN 角色
   */
  async createEmailIdentity(
    email: string,
    password: string,
    name?: string,
  ): Promise<UserWithRoles> {
    const normalizedEmail = email.toLowerCase();

    // 1. 检查邮箱是否已被使用
    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: IdentityProvider.EMAIL,
          providerId: normalizedEmail,
        },
      },
    });

    if (existingIdentity) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_EMAIL_EXISTS,
        message: "Email already exists",
        status: HttpStatus.CONFLICT,
      });
    }

    // 2. 哈希密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 检查是否是第一个用户（系统初始化）
    const userCount = await this.prisma.user.count();
    const isFirstUser = userCount === 0;

    // 4. 确定要分配的角色
    let targetRole: { id: number; code: string } | null = null;

    if (isFirstUser) {
      // 首个用户自动成为超管
      targetRole = await this.prisma.role.findUnique({
        where: { code: "SUPER_ADMIN" },
        select: { id: true, code: true },
      });

      if (targetRole) {
        this.logger.log(
          { email: normalizedEmail },
          "[identity] First user registration, assigning SUPER_ADMIN role",
        );
      }
    }

    // 如果不是首用户或超管角色不存在，使用普通 USER 角色
    if (!targetRole) {
      const userRole = await this.prisma.role.findUnique({
        where: { code: "USER" },
        select: { id: true, code: true },
      });
      targetRole = userRole;
    }

    // 5. 创建用户和邮箱身份
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashedPassword, // 兼容旧字段
          name,
          status: "ACTIVE",
          // 分配角色
          ...(targetRole && {
            UserRole_UserRole_userIdToUser: {
              create: {
                roleId: targetRole.id,
              },
            },
          }),
        },
      });

      await tx.userIdentity.create({
        data: {
          userId: user.id,
          provider: IdentityProvider.EMAIL,
          providerId: normalizedEmail,
          credential: hashedPassword,
          verified: false,
        },
      });

      return user;
    });

    return {
      id: result.id,
      email: result.email,
      name: result.name,
      status: result.status,
      avatar: result.avatar,
      roles: targetRole ? [targetRole.code] : [],
    };
  }

  /**
   * 获取用户的所有身份
   */
  async getUserIdentities(userId: number) {
    return this.prisma.userIdentity.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerId: true,
        verified: true,
        createdAt: true,
      },
    });
  }

  /**
   * 检查用户是否只有一个身份（用于解绑检查）
   */
  async isLastIdentity(userId: number): Promise<boolean> {
    const count = await this.prisma.userIdentity.count({
      where: { userId },
    });
    return count <= 1;
  }

  /**
   * 绑定邮箱身份
   */
  async bindEmail(
    userId: number,
    email: string,
    password: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();

    // 检查邮箱是否已被使用
    const existing = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: IdentityProvider.EMAIL,
          providerId: normalizedEmail,
        },
      },
    });

    if (existing) {
      if (existing.userId === userId) {
        throw new BusinessException({
          code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
          message: "Email already bound to your account",
          status: HttpStatus.CONFLICT,
        });
      }
      throw new BusinessException({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        message: "Email already bound to another account",
        status: HttpStatus.CONFLICT,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.userIdentity.create({
      data: {
        userId,
        provider: IdentityProvider.EMAIL,
        providerId: normalizedEmail,
        credential: hashedPassword,
        verified: true,
      },
    });

    this.logger.debug(
      { userId, email: normalizedEmail },
      "[identity] Email bound",
    );
  }

  /**
   * 绑定手机号身份
   */
  async bindPhone(userId: number, phone: string): Promise<void> {
    // 检查手机号是否已被使用
    const existing = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: IdentityProvider.PHONE,
          providerId: phone,
        },
      },
    });

    if (existing) {
      if (existing.userId === userId) {
        throw new BusinessException({
          code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
          message: "Phone already bound to your account",
          status: HttpStatus.CONFLICT,
        });
      }
      throw new BusinessException({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        message: "Phone already bound to another account",
        status: HttpStatus.CONFLICT,
      });
    }

    await this.prisma.userIdentity.create({
      data: {
        userId,
        provider: IdentityProvider.PHONE,
        providerId: phone,
        verified: true,
      },
    });

    this.logger.debug({ userId, phone }, "[identity] Phone bound");
  }

  /**
   * 绑定微信身份
   */
  async bindWechat(
    userId: number,
    provider: IdentityProvider,
    openId: string,
    unionId?: string,
  ): Promise<void> {
    // 检查该微信身份是否已被使用
    const existing = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId: openId,
        },
      },
    });

    if (existing) {
      if (existing.userId === userId) {
        throw new BusinessException({
          code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
          message: "WeChat account already bound to your account",
          status: HttpStatus.CONFLICT,
        });
      }
      throw new BusinessException({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        message: "WeChat account already bound to another account",
        status: HttpStatus.CONFLICT,
      });
    }

    // 如果有 unionId，检查是否通过 unionId 已经绑定过
    if (unionId) {
      const unionIdIdentity = await this.prisma.userIdentity.findFirst({
        where: {
          provider: {
            in: [
              IdentityProvider.WECHAT_MINI,
              IdentityProvider.WECHAT_MP,
              IdentityProvider.WECHAT_OPEN,
            ],
          },
          metadata: {
            path: ["unionId"],
            equals: unionId,
          },
        },
      });

      if (unionIdIdentity && unionIdIdentity.userId !== userId) {
        throw new BusinessException({
          code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
          message:
            "WeChat account already bound to another account via UnionID",
          status: HttpStatus.CONFLICT,
        });
      }
    }

    await this.prisma.userIdentity.create({
      data: {
        userId,
        provider,
        providerId: openId,
        verified: true,
        metadata: unionId ? { unionId } : undefined,
      },
    });

    this.logger.debug({ userId, provider, openId }, "[identity] WeChat bound");
  }

  /**
   * 解绑身份
   */
  async unbindIdentity(userId: number, identityId: number): Promise<void> {
    // 检查身份是否属于当前用户
    const identity = await this.prisma.userIdentity.findFirst({
      where: { id: identityId, userId },
    });

    if (!identity) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_IDENTITY_NOT_FOUND,
        message: "Identity not found",
        status: HttpStatus.NOT_FOUND,
      });
    }

    // 检查是否是最后一个身份
    const isLast = await this.isLastIdentity(userId);
    if (isLast) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_IDENTITY_LAST_ONE,
        message: "Cannot unbind the last identity",
        status: HttpStatus.BAD_REQUEST,
      });
    }

    await this.prisma.userIdentity.delete({
      where: { id: identityId },
    });

    this.logger.debug(
      { userId, identityId, provider: identity.provider },
      "[identity] Identity unbound",
    );
  }

  /**
   * 遮蔽敏感信息
   */
  maskProviderId(provider: IdentityProvider, providerId: string): string {
    switch (provider) {
      case IdentityProvider.EMAIL: {
        const [local, domain] = providerId.split("@");
        if (local.length <= 2) {
          return `${local[0]}***@${domain}`;
        }
        return `${local[0]}***${local.slice(-1)}@${domain}`;
      }
      case IdentityProvider.PHONE: {
        if (providerId.length === 11) {
          return `${providerId.slice(0, 3)}****${providerId.slice(-4)}`;
        }
        return `****${providerId.slice(-4)}`;
      }
      default:
        // 微信等 openid 只显示前几位
        return `${providerId.slice(0, 6)}***`;
    }
  }
}
