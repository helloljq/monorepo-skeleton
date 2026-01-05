import { Test, TestingModule } from "@nestjs/testing";
import { IdentityProvider } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { BusinessException } from "../../common/errors/business.exception";
import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { IdentityService } from "./identity.service";

describe("IdentityService", () => {
  let service: IdentityService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserWithRoles = {
    id: 1,
    email: "test@example.com",
    name: "Test User",
    status: "ACTIVE",
    avatar: null,
    password: "$2b$10$hashedpassword",
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    UserRole_UserRole_userIdToUser: [
      {
        id: 1,
        userId: 1,
        roleId: 1,
        grantedBy: null,
        grantedAt: new Date(),
        expiresAt: null,
        Role: {
          code: "USER",
          isEnabled: true,
          deletedAt: null,
        },
      },
    ],
  };

  const mockIdentity = {
    id: 1,
    userId: 1,
    provider: "EMAIL",
    providerId: "test@example.com",
    credential: "$2b$10$hashedpassword",
    verified: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    User: mockUserWithRoles,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      userIdentity: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      user: {
        create: jest.fn(),
        count: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<IdentityService>(IdentityService);
    prismaService = module.get(PrismaService);
  });

  describe("validateEmailPassword", () => {
    it("should validate email password successfully", async () => {
      const hashedPassword = await bcrypt.hash("Password123", 10);
      const identityWithHash = {
        ...mockIdentity,
        credential: hashedPassword,
      };

      prismaService.userIdentity.findUnique.mockResolvedValue(identityWithHash);

      const result = await service.validateEmailPassword(
        "test@example.com",
        "Password123",
      );

      expect(result.user.id).toBe(1);
      expect(result.user.email).toBe("test@example.com");
      expect(result.isNewUser).toBe(false);
    });

    it("should throw AUTH_INVALID_CREDENTIALS when identity not found", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);

      try {
        await service.validateEmailPassword(
          "notfound@example.com",
          "Password123",
        );
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_INVALID_CREDENTIALS,
        );
      }
    });

    it("should throw AUTH_USER_DISABLED when user is disabled", async () => {
      const disabledUserIdentity = {
        ...mockIdentity,
        User: { ...mockUserWithRoles, status: "DISABLED" },
      };
      prismaService.userIdentity.findUnique.mockResolvedValue(
        disabledUserIdentity,
      );

      try {
        await service.validateEmailPassword("test@example.com", "Password123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_USER_DISABLED,
        );
      }
    });

    it("should throw AUTH_INVALID_CREDENTIALS when password does not match", async () => {
      const hashedPassword = await bcrypt.hash("CorrectPassword123", 10);
      const identityWithHash = {
        ...mockIdentity,
        credential: hashedPassword,
      };
      prismaService.userIdentity.findUnique.mockResolvedValue(identityWithHash);

      try {
        await service.validateEmailPassword(
          "test@example.com",
          "WrongPassword123",
        );
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_INVALID_CREDENTIALS,
        );
      }
    });

    it("should throw AUTH_INVALID_CREDENTIALS when credential is null", async () => {
      const identityWithoutCredential = {
        ...mockIdentity,
        credential: null,
      };
      prismaService.userIdentity.findUnique.mockResolvedValue(
        identityWithoutCredential,
      );

      try {
        await service.validateEmailPassword("test@example.com", "Password123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_INVALID_CREDENTIALS,
        );
      }
    });
  });

  describe("validatePhoneCode", () => {
    it("should return existing user when phone identity exists", async () => {
      const phoneIdentity = {
        ...mockIdentity,
        provider: "PHONE",
        providerId: "13812345678",
      };
      prismaService.userIdentity.findUnique.mockResolvedValue(phoneIdentity);

      const result = await service.validatePhoneCode("13812345678");

      expect(result.user.id).toBe(1);
      expect(result.isNewUser).toBe(false);
    });

    it("should throw AUTH_USER_DISABLED when existing user is disabled", async () => {
      const disabledPhoneIdentity = {
        ...mockIdentity,
        provider: "PHONE",
        providerId: "13812345678",
        User: { ...mockUserWithRoles, status: "DISABLED" },
      };
      prismaService.userIdentity.findUnique.mockResolvedValue(
        disabledPhoneIdentity,
      );

      try {
        await service.validatePhoneCode("13812345678");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_USER_DISABLED,
        );
      }
    });

    it("should create new user when phone identity does not exist", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);
      prismaService.role.findUnique.mockResolvedValue({ id: 1, code: "USER" });

      const newUser = {
        id: 2,
        email: null,
        name: null,
        status: "ACTIVE",
        avatar: null,
      };
      prismaService.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            user: { create: jest.fn().mockResolvedValue(newUser) },
            userIdentity: { create: jest.fn().mockResolvedValue({}) },
          };
          return callback(tx);
        },
      );

      const result = await service.validatePhoneCode("13800000000");

      expect(result.user.id).toBe(2);
      expect(result.isNewUser).toBe(true);
      expect(result.user.roles).toEqual(["USER"]);
    });
  });

  describe("createEmailIdentity", () => {
    it("should throw AUTH_EMAIL_EXISTS when email already exists", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(mockIdentity);

      try {
        await service.createEmailIdentity("test@example.com", "Password123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_EMAIL_EXISTS,
        );
      }
    });

    it("should create email identity successfully", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);
      prismaService.role.findUnique.mockResolvedValue({ id: 1, code: "USER" });

      const newUser = {
        id: 3,
        email: "new@example.com",
        name: "New User",
        status: "ACTIVE",
        avatar: null,
      };
      prismaService.user.count.mockResolvedValue(1); // Not first user
      prismaService.$transaction.mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            user: { create: jest.fn().mockResolvedValue(newUser) },
            userIdentity: { create: jest.fn().mockResolvedValue({}) },
          };
          return callback(tx);
        },
      );

      const result = await service.createEmailIdentity(
        "new@example.com",
        "Password123",
        "New User",
      );

      expect(result.id).toBe(3);
      expect(result.email).toBe("new@example.com");
      expect(result.roles).toEqual(["USER"]);
    });
  });

  describe("getUserIdentities", () => {
    it("should return user identities", async () => {
      const identities = [
        {
          id: 1,
          provider: "EMAIL",
          providerId: "test@example.com",
          verified: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          provider: "PHONE",
          providerId: "13812345678",
          verified: true,
          createdAt: new Date(),
        },
      ];
      prismaService.userIdentity.findMany.mockResolvedValue(identities);

      const result = await service.getUserIdentities(1);

      expect(result).toHaveLength(2);
      expect(prismaService.userIdentity.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        select: {
          id: true,
          provider: true,
          providerId: true,
          verified: true,
          createdAt: true,
        },
      });
    });
  });

  describe("isLastIdentity", () => {
    it("should return true when user has only one identity", async () => {
      prismaService.userIdentity.count.mockResolvedValue(1);

      const result = await service.isLastIdentity(1);

      expect(result).toBe(true);
    });

    it("should return false when user has multiple identities", async () => {
      prismaService.userIdentity.count.mockResolvedValue(2);

      const result = await service.isLastIdentity(1);

      expect(result).toBe(false);
    });
  });

  describe("bindEmail", () => {
    it("should bind email successfully", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);
      prismaService.userIdentity.create.mockResolvedValue({} as never);

      await expect(
        service.bindEmail(1, "new@example.com", "Password123"),
      ).resolves.not.toThrow();

      expect(prismaService.userIdentity.create).toHaveBeenCalled();
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when email belongs to same user", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue({
        ...mockIdentity,
        userId: 1,
      });

      try {
        await service.bindEmail(1, "test@example.com", "Password123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
      }
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when email belongs to another user", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue({
        ...mockIdentity,
        userId: 999,
      });

      try {
        await service.bindEmail(1, "test@example.com", "Password123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
      }
    });
  });

  describe("bindPhone", () => {
    it("should bind phone successfully", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);
      prismaService.userIdentity.create.mockResolvedValue({} as never);

      await expect(service.bindPhone(1, "13800000000")).resolves.not.toThrow();

      expect(prismaService.userIdentity.create).toHaveBeenCalled();
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when phone already bound to same user", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue({
        ...mockIdentity,
        provider: "PHONE",
        providerId: "13800000000",
        userId: 1, // same user
      });

      try {
        await service.bindPhone(1, "13800000000");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
      }
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when phone belongs to another user", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue({
        ...mockIdentity,
        provider: "PHONE",
        providerId: "13800000000",
        userId: 999,
      });

      try {
        await service.bindPhone(1, "13800000000");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
      }
    });
  });

  describe("bindWechat", () => {
    beforeEach(() => {
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst = jest.fn();
    });

    it("should bind wechat successfully", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst.mockResolvedValue(null);
      prismaService.userIdentity.create.mockResolvedValue({} as never);

      await expect(
        service.bindWechat(
          1,
          IdentityProvider.WECHAT_MINI,
          "openid123",
          "unionid123",
        ),
      ).resolves.not.toThrow();

      expect(prismaService.userIdentity.create).toHaveBeenCalled();
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when wechat belongs to same user", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue({
        ...mockIdentity,
        provider: IdentityProvider.WECHAT_MINI,
        providerId: "openid123",
        userId: 1,
      });

      try {
        await service.bindWechat(1, IdentityProvider.WECHAT_MINI, "openid123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
      }
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when wechat belongs to another user via OpenID", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue({
        ...mockIdentity,
        provider: IdentityProvider.WECHAT_MINI,
        providerId: "openid123",
        userId: 999, // different user
      });

      try {
        await service.bindWechat(1, IdentityProvider.WECHAT_MINI, "openid123");
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
        expect((e as BusinessException).message).toContain("another account");
      }
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when wechat belongs to another user via UnionID", async () => {
      prismaService.userIdentity.findUnique.mockResolvedValue(null);
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst.mockResolvedValue({
        ...mockIdentity,
        userId: 999,
        unionId: "unionid123",
      });

      try {
        await service.bindWechat(
          1,
          IdentityProvider.WECHAT_MINI,
          "openid123",
          "unionid123",
        );
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
        );
      }
    });
  });

  describe("unbindIdentity", () => {
    beforeEach(() => {
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst = jest.fn();
      (prismaService.userIdentity as unknown as { delete: jest.Mock }).delete =
        jest.fn();
    });

    it("should unbind identity successfully", async () => {
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        provider: "EMAIL",
      });
      prismaService.userIdentity.count.mockResolvedValue(2);
      (
        prismaService.userIdentity as unknown as { delete: jest.Mock }
      ).delete.mockResolvedValue({});

      await expect(service.unbindIdentity(1, 1)).resolves.not.toThrow();
    });

    it("should throw AUTH_IDENTITY_NOT_FOUND when identity does not exist", async () => {
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst.mockResolvedValue(null);

      try {
        await service.unbindIdentity(1, 999);
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_NOT_FOUND,
        );
      }
    });

    it("should throw AUTH_IDENTITY_LAST_ONE when trying to unbind last identity", async () => {
      (
        prismaService.userIdentity as unknown as { findFirst: jest.Mock }
      ).findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        provider: "EMAIL",
      });
      prismaService.userIdentity.count.mockResolvedValue(1);

      try {
        await service.unbindIdentity(1, 1);
        fail("Expected BusinessException to be thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(BusinessException);
        expect((e as BusinessException).businessCode).toBe(
          ApiErrorCode.AUTH_IDENTITY_LAST_ONE,
        );
      }
    });
  });

  describe("maskProviderId", () => {
    it("should mask email correctly", () => {
      expect(
        service.maskProviderId(IdentityProvider.EMAIL, "test@example.com"),
      ).toBe("t***t@example.com");
      expect(
        service.maskProviderId(IdentityProvider.EMAIL, "ab@example.com"),
      ).toBe("a***@example.com");
    });

    it("should mask phone correctly", () => {
      expect(
        service.maskProviderId(IdentityProvider.PHONE, "13812345678"),
      ).toBe("138****5678");
      expect(
        service.maskProviderId(IdentityProvider.PHONE, "+8613812345678"),
      ).toBe("****5678");
    });

    it("should mask wechat openid correctly", () => {
      expect(
        service.maskProviderId(IdentityProvider.WECHAT_MINI, "oABCDE12345678"),
      ).toBe("oABCDE***");
    });
  });
});
