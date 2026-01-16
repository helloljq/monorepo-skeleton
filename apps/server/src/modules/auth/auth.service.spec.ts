import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";

import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { hashSha256 } from "../../common/utils/crypto.util";
import { AppConfigService } from "../../config/app-config.service";
import { PrismaService } from "../../database/prisma/prisma.service";
import { IdentityService } from "../identity/identity.service";
import { AuthService } from "./auth.service";
import { SmsService } from "./services/sms.service";

describe("AuthService", () => {
  let service: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;
  let identityService: jest.Mocked<IdentityService>;
  let smsService: jest.Mocked<SmsService>;
  let redisClient: jest.Mocked<{
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  }>;

  const mockUser = {
    id: 1,
    publicId: "550e8400-e29b-41d4-a716-446655440000",
    email: "test@example.com",
    password: "$2b$10$hashedpassword",
    name: "Test User",
    status: "ACTIVE",
    avatar: null,
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    userRoles: [
      {
        id: 1,
        userId: 1,
        roleId: 1,
        grantedById: null,
        grantedAt: new Date(),
        expiresAt: null,
        role: {
          code: "USER",
          isEnabled: true,
          deletedAt: null,
        },
      },
    ],
  };

  const mockUserWithRoles = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "test@example.com",
    name: "Test User",
    status: "ACTIVE",
    avatar: null,
    roles: ["USER"],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      soft: {
        user: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
        },
      },
    };

    const mockJwtService = {
      verify: jest.fn(),
      signAsync: jest.fn(),
    };

    const mockConfigService = {
      auth: {
        accessSecret: "test-access-secret-32-chars-long!",
        refreshSecret: "test-refresh-secret-32-chars-long",
        accessTtl: "15m",
        refreshTtl: "7d",
      },
    };

    const mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const mockSmsService = {
      sendCode: jest.fn(),
      verifyCode: jest.fn(),
    };

    const mockIdentityService = {
      createEmailIdentity: jest.fn(),
      validateEmailPassword: jest.fn(),
      validatePhoneCode: jest.fn(),
      getUserIdentities: jest.fn(),
      isLastIdentity: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
        { provide: SmsService, useValue: mockSmsService },
        { provide: IdentityService, useValue: mockIdentityService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    jwtService = module.get(JwtService);
    identityService = module.get(IdentityService);
    smsService = module.get(SmsService);
    redisClient = module.get(REDIS_CLIENT);
  });

  describe("register", () => {
    it("should register a new user successfully", async () => {
      identityService.createEmailIdentity.mockResolvedValue(mockUserWithRoles);

      const result = await service.register({
        email: "new@example.com",
        password: "Password123",
        name: "New User",
      });

      expect(result).toEqual({
        id: mockUserWithRoles.id,
        email: mockUserWithRoles.email,
        name: mockUserWithRoles.name,
      });
      expect(identityService.createEmailIdentity).toHaveBeenCalledWith(
        "new@example.com",
        "Password123",
        "New User",
      );
    });

    it("should throw AUTH_EMAIL_EXISTS if email already exists", async () => {
      identityService.createEmailIdentity.mockRejectedValue(
        new BusinessException({
          code: ApiErrorCode.AUTH_EMAIL_EXISTS,
          message: "Email already exists",
          status: 409,
        }),
      );

      await expect(
        service.register({
          email: "test@example.com",
          password: "Password123",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_EMAIL_EXISTS,
      });
    });
  });

  describe("login", () => {
    it("should login successfully with valid credentials", async () => {
      identityService.validateEmailPassword.mockResolvedValue({
        user: mockUserWithRoles,
        internalUserId: 1,
        isNewUser: false,
      });
      jwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");
      redisClient.set.mockResolvedValue("OK");

      const result = await service.login({
        email: "test@example.com",
        password: "Password123",
        deviceId: "device-1",
      });

      expect(result).toHaveProperty("accessToken", "access-token");
      expect(result).toHaveProperty("refreshToken", "refresh-token");
      expect(result).toHaveProperty("accessExpiresInSeconds");
      expect(identityService.validateEmailPassword).toHaveBeenCalledWith(
        "test@example.com",
        "Password123",
      );
    });

    it("should throw AUTH_INVALID_CREDENTIALS if user not found", async () => {
      identityService.validateEmailPassword.mockRejectedValue(
        new BusinessException({
          code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
          message: "Invalid credentials",
          status: 401,
        }),
      );

      await expect(
        service.login({
          email: "nonexistent@example.com",
          password: "Password123",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    });

    it("should throw AUTH_INVALID_CREDENTIALS if password is wrong", async () => {
      identityService.validateEmailPassword.mockRejectedValue(
        new BusinessException({
          code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
          message: "Invalid credentials",
          status: 401,
        }),
      );

      await expect(
        service.login({
          email: "test@example.com",
          password: "WrongPassword123",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    });
  });

  describe("logout", () => {
    it("should logout successfully", async () => {
      redisClient.del.mockResolvedValue(1);

      const result = await service.logout(1, "device-1");

      expect(result).toEqual({ message: "Logged out successfully" });
      expect(redisClient.del).toHaveBeenCalledWith("refresh_token:1:device-1");
    });
  });

  describe("refresh", () => {
    it("should throw AUTH_REFRESH_TOKEN_INVALID if token verification fails", async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await expect(
        service.refresh({
          refreshToken: "invalid-token",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID,
      });
    });

    it("should throw AUTH_REFRESH_TOKEN_INVALID if token not found in Redis", async () => {
      jwtService.verify.mockReturnValue({ sub: 1, email: "test@example.com" });
      redisClient.get.mockResolvedValue(null);

      await expect(
        service.refresh({
          refreshToken: "valid-token",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID,
      });
    });

    it("should throw AUTH_USER_NOT_FOUND if user no longer exists", async () => {
      const validToken = "valid-refresh-token";
      const tokenHash = hashSha256(validToken);

      jwtService.verify.mockReturnValue({ sub: 1, email: "test@example.com" });
      redisClient.get.mockResolvedValue(tokenHash);
      prismaService.soft.user.findUnique.mockResolvedValue(null);

      await expect(
        service.refresh({
          refreshToken: validToken,
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_USER_NOT_FOUND,
      });
    });

    it("should refresh tokens successfully", async () => {
      const validToken = "valid-refresh-token";
      const tokenHash = hashSha256(validToken);

      jwtService.verify.mockReturnValue({ sub: 1, email: "test@example.com" });
      redisClient.get.mockResolvedValue(tokenHash);
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      jwtService.signAsync
        .mockResolvedValueOnce("new-access-token")
        .mockResolvedValueOnce("new-refresh-token");
      redisClient.set.mockResolvedValue("OK");

      const result = await service.refresh({
        refreshToken: validToken,
        deviceId: "device-1",
      });

      expect(result).toHaveProperty("accessToken", "new-access-token");
      expect(result).toHaveProperty("refreshToken", "new-refresh-token");
    });

    it("should throw AUTH_USER_DISABLED if user is disabled", async () => {
      const validToken = "valid-refresh-token";
      const tokenHash = hashSha256(validToken);
      const disabledUser = { ...mockUser, status: "DISABLED" };

      jwtService.verify.mockReturnValue({ sub: 1, email: "test@example.com" });
      redisClient.get.mockResolvedValue(tokenHash);
      prismaService.soft.user.findUnique.mockResolvedValue(disabledUser);

      await expect(
        service.refresh({
          refreshToken: validToken,
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_USER_DISABLED,
      });
    });

    it("should throw REDIS_ERROR if Redis fails", async () => {
      jwtService.verify.mockReturnValue({ sub: 1, email: "test@example.com" });
      redisClient.get.mockRejectedValue(new Error("Redis connection failed"));

      await expect(
        service.refresh({
          refreshToken: "some-token",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.REDIS_ERROR,
      });
    });

    it("should throw AUTH_REFRESH_TOKEN_INVALID if hash does not match", async () => {
      jwtService.verify.mockReturnValue({ sub: 1, email: "test@example.com" });
      redisClient.get.mockResolvedValue("different-hash-value");

      await expect(
        service.refresh({
          refreshToken: "some-token",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_REFRESH_TOKEN_INVALID,
      });
    });
  });

  describe("sendSmsCode", () => {
    it("should send SMS code successfully", async () => {
      smsService.sendCode.mockResolvedValue(undefined);

      const result = await service.sendSmsCode("13800138000");

      expect(result).toEqual({ message: "Verification code sent" });
      expect(smsService.sendCode).toHaveBeenCalledWith("13800138000");
    });
  });

  describe("loginWithPhone", () => {
    it("should login existing user with phone successfully", async () => {
      smsService.verifyCode.mockResolvedValue(undefined);
      identityService.validatePhoneCode.mockResolvedValue({
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "test@example.com",
          name: "Test User",
          status: "ACTIVE",
          avatar: null,
          roles: ["USER"],
        },
        internalUserId: 1,
        isNewUser: false,
      });
      jwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");
      redisClient.set.mockResolvedValue("OK");

      const result = await service.loginWithPhone({
        phone: "13800138000",
        code: "123456",
        deviceId: "device-1",
      });

      expect(result).toHaveProperty("accessToken", "access-token");
      expect(result).toHaveProperty("refreshToken", "refresh-token");
      expect(smsService.verifyCode).toHaveBeenCalledWith(
        "13800138000",
        "123456",
      );
      expect(identityService.validatePhoneCode).toHaveBeenCalledWith(
        "13800138000",
      );
    });

    it("should throw AUTH_USER_DISABLED if phone user is disabled", async () => {
      smsService.verifyCode.mockResolvedValue(undefined);
      identityService.validatePhoneCode.mockRejectedValue(
        new BusinessException({
          code: ApiErrorCode.AUTH_USER_DISABLED,
          message: "User account is disabled",
          status: 403,
        }),
      );

      await expect(
        service.loginWithPhone({
          phone: "13800138000",
          code: "123456",
          deviceId: "device-1",
        }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_USER_DISABLED,
      });
    });

    it("should auto-register new user if phone identity not found", async () => {
      smsService.verifyCode.mockResolvedValue(undefined);
      identityService.validatePhoneCode.mockResolvedValue({
        user: {
          id: "550e8400-e29b-41d4-a716-446655440001",
          email: "phone_13800138000@placeholder.local",
          name: null,
          status: "ACTIVE",
          avatar: null,
          roles: ["USER"],
        },
        internalUserId: 2,
        isNewUser: true,
      });
      jwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");
      redisClient.set.mockResolvedValue("OK");

      const result = await service.loginWithPhone({
        phone: "13800138000",
        code: "123456",
        deviceId: "device-1",
      });

      expect(result).toHaveProperty("accessToken", "access-token");
    });
  });

  describe("generateTokensForWechat", () => {
    it("should generate tokens for wechat login", async () => {
      jwtService.signAsync
        .mockResolvedValueOnce("wechat-access-token")
        .mockResolvedValueOnce("wechat-refresh-token");
      redisClient.set.mockResolvedValue("OK");

      const result = await service.generateTokensForWechat(
        1,
        "test@example.com",
        ["USER"],
        "device-1",
      );

      expect(result).toHaveProperty("accessToken", "wechat-access-token");
      expect(result).toHaveProperty("refreshToken", "wechat-refresh-token");
      expect(result).toHaveProperty("accessExpiresInSeconds");
    });

    it("should handle null email", async () => {
      jwtService.signAsync
        .mockResolvedValueOnce("access-token")
        .mockResolvedValueOnce("refresh-token");
      redisClient.set.mockResolvedValue("OK");

      const result = await service.generateTokensForWechat(
        1,
        null,
        ["USER"],
        "device-1",
      );

      expect(result).toHaveProperty("accessToken", "access-token");
    });
  });
});
