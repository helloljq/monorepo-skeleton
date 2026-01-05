import { HttpStatus, Inject, Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis";

import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { hashSha256 } from "../../common/utils/crypto.util";
import { parseDurationToSeconds } from "../../common/utils/time.util";
import { AppConfigService } from "../../config/app-config.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { IdentityService } from "../identity/identity.service";
import {
  LoginDto,
  PhoneLoginDto,
  RefreshTokenDto,
  RegisterDto,
} from "./dto/auth.dto";
import { JwtPayload, JwtPayloadSchema } from "./dto/jwt-payload.schema";
import { SmsService } from "./services/sms.service";

/**
 * 二维码登录场景的设备 ID（由于扫码登录无法获取真实设备 ID）
 */
export const QRCODE_LOGIN_DEVICE_ID = "qrcode-login";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: AppConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private smsService: SmsService,
    private identityService: IdentityService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.identityService.createEmailIdentity(
      dto.email,
      dto.password,
      dto.name,
    );

    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  async login(dto: LoginDto) {
    const result = await this.identityService.validateEmailPassword(
      dto.email,
      dto.password,
    );

    return this.generateTokens(
      result.user.id,
      result.user.email,
      result.user.roles,
      dto.deviceId,
    );
  }

  /**
   * 发送手机验证码
   */
  async sendSmsCode(phone: string): Promise<{ message: string }> {
    await this.smsService.sendCode(phone);
    return { message: "Verification code sent" };
  }

  /**
   * 手机号验证码登录（自动注册）
   */
  async loginWithPhone(dto: PhoneLoginDto) {
    // 1. 验证验证码
    await this.smsService.verifyCode(dto.phone, dto.code);

    // 2. 查找或创建用户
    const identity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: "PHONE",
          providerId: dto.phone,
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

    let userId: number;
    let email: string | null;
    let roles: string[];

    if (identity) {
      // 检查用户状态
      if (identity.User.status === "DISABLED") {
        throw new BusinessException({
          code: ApiErrorCode.AUTH_USER_DISABLED,
          message: "User account is disabled",
          status: HttpStatus.FORBIDDEN,
        });
      }

      userId = identity.User.id;
      email = identity.User.email;
      roles = identity.User.UserRole_UserRole_userIdToUser.filter(
        (ur) => ur.Role.isEnabled && !ur.Role.deletedAt,
      ).map((ur) => ur.Role.code);
    } else {
      // 自动注册新用户
      const newUser = await this.createPhoneUser(dto.phone);
      userId = newUser.id;
      email = newUser.email;
      roles = newUser.roles;
    }

    return this.generateTokens(userId, email, roles, dto.deviceId);
  }

  /**
   * 创建手机号用户（自动注册）
   */
  private async createPhoneUser(
    phone: string,
  ): Promise<{ id: number; email: string | null; roles: string[] }> {
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
          provider: "PHONE",
          providerId: phone,
          verified: true,
        },
      });

      return user;
    });

    return {
      id: result.id,
      email: result.email,
      roles: userRole ? ["USER"] : [],
    };
  }

  async refresh(dto: RefreshTokenDto) {
    // Verify JWT token
    const payload = this.verifyRefreshToken(dto.refreshToken);

    // Validate token in Redis
    await this.validateStoredToken(payload.sub, dto.deviceId, dto.refreshToken);

    // Check if user still exists/active and load roles
    const user = await this.prisma.soft.user.findUnique({
      where: { id: payload.sub },
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
    });

    if (!user) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_USER_NOT_FOUND,
        message: "User not found",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // 检查用户状态
    if (user.status === "DISABLED") {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_USER_DISABLED,
        message: "User account is disabled",
        status: HttpStatus.FORBIDDEN,
      });
    }

    // 提取有效的角色代码
    const roles = user.UserRole_UserRole_userIdToUser.filter(
      (ur) => ur.Role.isEnabled && !ur.Role.deletedAt,
    ).map((ur) => ur.Role.code);

    return this.generateTokens(payload.sub, payload.email, roles, dto.deviceId);
  }

  async logout(userId: number, deviceId: string) {
    await this.redis.del(`refresh_token:${userId}:${deviceId}`);
    return { message: "Logged out successfully" };
  }

  /**
   * Verify refresh token and extract payload
   */
  private verifyRefreshToken(token: string): JwtPayload {
    try {
      const decoded: unknown = this.jwtService.verify(token, {
        secret: this.config.auth.refreshSecret,
      });
      return JwtPayloadSchema.parse(decoded) as JwtPayload;
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "UnknownError";
      this.logger.warn({ errName: name }, "[auth.refresh] jwt verify failed");

      throw new BusinessException({
        code: ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID,
        message: "Invalid refresh token",
        status: HttpStatus.UNAUTHORIZED,
      });
    }
  }

  /**
   * Validate token against stored hash in Redis
   */
  private async validateStoredToken(
    userId: number,
    deviceId: string,
    token: string,
  ): Promise<void> {
    const key = `refresh_token:${userId}:${deviceId}`;

    let storedToken: string | null;
    try {
      storedToken = await this.redis.get(key);
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "UnknownError";
      this.logger.warn({ errName: name }, "[auth.refresh] redis get failed");

      throw new BusinessException({
        code: ApiErrorCode.REDIS_ERROR,
        message: "Service temporarily unavailable",
        status: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }

    if (!storedToken) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID,
        message: "Invalid refresh token",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // Compare hash values
    const incomingHash = hashSha256(token);
    if (storedToken !== incomingHash) {
      throw new BusinessException({
        code: ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID,
        message: "Invalid refresh token",
        status: HttpStatus.UNAUTHORIZED,
      });
    }
  }

  /**
   * 为微信登录生成 Tokens (公开方法供 WechatController 调用)
   */
  async generateTokensForWechat(
    userId: number,
    email: string | null,
    roles: string[],
    deviceId: string,
  ) {
    return this.generateTokens(userId, email, roles, deviceId);
  }

  private async generateTokens(
    userId: number,
    email: string | null,
    roles: string[],
    deviceId: string,
  ) {
    const payload: JwtPayload = { sub: userId, email: email ?? "", roles };

    const accessTtlSeconds = parseDurationToSeconds(this.config.auth.accessTtl);
    const refreshTtlSeconds = parseDurationToSeconds(
      this.config.auth.refreshTtl,
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.auth.accessSecret,
        expiresIn: this.config.auth.accessTtl,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.auth.refreshSecret,
        expiresIn: this.config.auth.refreshTtl,
      }),
    ]);

    // Store refresh token hash in Redis
    const refreshTokenHash = hashSha256(refreshToken);
    await this.redis.set(
      `refresh_token:${userId}:${deviceId}`,
      refreshTokenHash,
      "EX",
      refreshTtlSeconds,
    );

    return {
      accessToken,
      refreshToken,
      accessExpiresInSeconds: accessTtlSeconds,
    };
  }
}
