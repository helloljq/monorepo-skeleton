import { Test, TestingModule } from "@nestjs/testing";
import { IdentityProvider } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { IdentityService } from "./identity.service";

describe("IdentityService", () => {
  let service: IdentityService;
  let prisma: jest.Mocked<PrismaService>;

  const now = new Date();
  const userInternalId = 1;
  const userPublicId = "550e8400-e29b-41d4-a716-446655440600";

  beforeEach(async () => {
    const mockPrisma: Partial<jest.Mocked<PrismaService>> = {
      userIdentity: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
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
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(IdentityService);
    prisma = module.get(PrismaService);
  });

  describe("validateEmailPassword", () => {
    it("should validate email password successfully", async () => {
      const hashedPassword = await bcrypt.hash("Password123", 10);
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: hashedPassword,
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "test@example.com",
          name: "Test User",
          status: "ACTIVE",
          avatar: null,
          userRoles: [
            {
              role: { code: "USER", isEnabled: true, deletedAt: null },
            },
          ],
        },
      } as never);

      const result = await service.validateEmailPassword(
        "test@example.com",
        "Password123",
      );

      expect(result).toEqual({
        user: {
          id: userPublicId,
          email: "test@example.com",
          name: "Test User",
          status: "ACTIVE",
          avatar: null,
          roles: ["USER"],
        },
        internalUserId: userInternalId,
        isNewUser: false,
      });
    });

    it("should throw AUTH_INVALID_CREDENTIALS when identity not found", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);

      await expect(
        service.validateEmailPassword("notfound@example.com", "Password123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    });

    it("should throw AUTH_USER_DISABLED when user is disabled", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: "$2b$10$hashedpassword",
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "test@example.com",
          name: "Test User",
          status: "DISABLED",
          avatar: null,
          userRoles: [],
        },
      } as never);

      await expect(
        service.validateEmailPassword("test@example.com", "Password123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_USER_DISABLED,
      });
    });

    it("should throw AUTH_INVALID_CREDENTIALS when password does not match", async () => {
      const hashedPassword = await bcrypt.hash("CorrectPassword123", 10);
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: hashedPassword,
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "test@example.com",
          name: "Test User",
          status: "ACTIVE",
          avatar: null,
          userRoles: [],
        },
      } as never);

      await expect(
        service.validateEmailPassword("test@example.com", "WrongPassword123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    });

    it("should throw AUTH_INVALID_CREDENTIALS when credential is null", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: null,
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "test@example.com",
          name: "Test User",
          status: "ACTIVE",
          avatar: null,
          userRoles: [],
        },
      } as never);

      await expect(
        service.validateEmailPassword("test@example.com", "Password123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_INVALID_CREDENTIALS,
      });
    });

    it("should filter out disabled/deleted roles", async () => {
      const hashedPassword = await bcrypt.hash("Password123", 10);
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: hashedPassword,
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "test@example.com",
          name: "Test User",
          status: "ACTIVE",
          avatar: null,
          userRoles: [
            { role: { code: "USER", isEnabled: true, deletedAt: null } },
            { role: { code: "DISABLED", isEnabled: false, deletedAt: null } },
            { role: { code: "DELETED", isEnabled: true, deletedAt: now } },
          ],
        },
      } as never);

      const result = await service.validateEmailPassword(
        "test@example.com",
        "Password123",
      );

      expect(result.user.roles).toEqual(["USER"]);
    });
  });

  describe("validatePhoneCode", () => {
    it("should return existing user when phone identity exists", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: null,
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "phone_13812345678@placeholder.local",
          name: null,
          status: "ACTIVE",
          avatar: null,
          userRoles: [
            { role: { code: "USER", isEnabled: true, deletedAt: null } },
          ],
        },
      } as never);

      const result = await service.validatePhoneCode("13812345678");

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe(userPublicId);
      expect(result.internalUserId).toBe(userInternalId);
    });

    it("should throw AUTH_USER_DISABLED when existing user is disabled", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        credential: null,
        user: {
          id: userInternalId,
          publicId: userPublicId,
          email: "phone_13812345678@placeholder.local",
          name: null,
          status: "DISABLED",
          avatar: null,
          userRoles: [],
        },
      } as never);

      await expect(
        service.validatePhoneCode("13812345678"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_USER_DISABLED,
      });
    });

    it("should create new user when phone identity does not exist", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.role.findUnique.mockResolvedValue({
        id: 10,
        code: "USER",
      } as never);

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 2,
              publicId: "550e8400-e29b-41d4-a716-446655440601",
              email: "phone_13800000000@placeholder.local",
              name: null,
              status: "ACTIVE",
              avatar: null,
            }),
          },
          userIdentity: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx as never);
      });

      const result = await service.validatePhoneCode("13800000000");

      expect(result.isNewUser).toBe(true);
      expect(result.user.id).toBe("550e8400-e29b-41d4-a716-446655440601");
      expect(result.internalUserId).toBe(2);
      expect(result.user.roles).toEqual(["USER"]);
    });
  });

  describe("createEmailIdentity", () => {
    it("should throw AUTH_EMAIL_EXISTS when email already exists", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({ id: 1 } as never);

      await expect(
        service.createEmailIdentity("test@example.com", "Password123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_EMAIL_EXISTS,
      });
    });

    it("should create email identity successfully (non-first user)", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(1);
      prisma.role.findUnique.mockResolvedValue({
        id: 10,
        code: "USER",
      } as never);

      prisma.$transaction.mockImplementation(async (fn) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({
              id: 3,
              publicId: "550e8400-e29b-41d4-a716-446655440602",
              email: "new@example.com",
              name: "New User",
              status: "ACTIVE",
              avatar: null,
            }),
          },
          userIdentity: {
            create: jest.fn().mockResolvedValue({}),
          },
        };
        return fn(tx as never);
      });

      const result = await service.createEmailIdentity(
        "new@example.com",
        "Password123",
        "New User",
      );

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440602",
        email: "new@example.com",
        name: "New User",
        status: "ACTIVE",
        avatar: null,
        roles: ["USER"],
        internalUserId: 3,
      });
    });
  });

  describe("getUserIdentities", () => {
    it("should return user identities", async () => {
      const identities = [
        {
          publicId: "550e8400-e29b-41d4-a716-446655440610",
          provider: IdentityProvider.EMAIL,
          providerId: "test@example.com",
          verified: true,
          createdAt: now,
        },
      ];
      prisma.userIdentity.findMany.mockResolvedValue(identities as never);

      const result = await service.getUserIdentities(userInternalId);

      expect(result).toEqual(identities);
      expect(prisma.userIdentity.findMany).toHaveBeenCalledWith({
        where: { userId: userInternalId },
        select: {
          publicId: true,
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
      prisma.userIdentity.count.mockResolvedValue(1);

      await expect(service.isLastIdentity(userInternalId)).resolves.toBe(true);
    });

    it("should return false when user has multiple identities", async () => {
      prisma.userIdentity.count.mockResolvedValue(2);

      await expect(service.isLastIdentity(userInternalId)).resolves.toBe(false);
    });
  });

  describe("bindEmail", () => {
    it("should bind email successfully", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.userIdentity.create.mockResolvedValue({} as never);

      await expect(
        service.bindEmail(userInternalId, "new@example.com", "Password123"),
      ).resolves.not.toThrow();
      expect(prisma.userIdentity.create).toHaveBeenCalled();
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when email belongs to same user", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        userId: userInternalId,
      } as never);

      await expect(
        service.bindEmail(userInternalId, "test@example.com", "Password123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
      });
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when email belongs to another user", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        userId: 999,
      } as never);

      await expect(
        service.bindEmail(userInternalId, "test@example.com", "Password123"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
      });
    });
  });

  describe("bindPhone", () => {
    it("should bind phone successfully", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.userIdentity.create.mockResolvedValue({} as never);

      await expect(
        service.bindPhone(userInternalId, "13800000000"),
      ).resolves.not.toThrow();
      expect(prisma.userIdentity.create).toHaveBeenCalled();
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when phone belongs to same user", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        userId: userInternalId,
      } as never);

      await expect(
        service.bindPhone(userInternalId, "13800000000"),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
      });
    });
  });

  describe("bindWechat", () => {
    it("should bind wechat successfully", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.userIdentity.findFirst.mockResolvedValue(null);
      prisma.userIdentity.create.mockResolvedValue({} as never);

      await expect(
        service.bindWechat(
          userInternalId,
          IdentityProvider.WECHAT_MINI,
          "openid123",
          "unionid123",
        ),
      ).resolves.not.toThrow();
      expect(prisma.userIdentity.create).toHaveBeenCalled();
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when openId belongs to same user", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue({
        userId: userInternalId,
      } as never);

      await expect(
        service.bindWechat(
          userInternalId,
          IdentityProvider.WECHAT_MINI,
          "openid123",
        ),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
      });
    });

    it("should throw AUTH_IDENTITY_ALREADY_BOUND when unionId belongs to another user", async () => {
      prisma.userIdentity.findUnique.mockResolvedValue(null);
      prisma.userIdentity.findFirst.mockResolvedValue({
        userId: 999,
      } as never);

      await expect(
        service.bindWechat(
          userInternalId,
          IdentityProvider.WECHAT_MINI,
          "openid123",
          "unionid123",
        ),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_ALREADY_BOUND,
      });
    });
  });

  describe("unbindIdentity", () => {
    it("should unbind identity successfully", async () => {
      const identityPublicId = "550e8400-e29b-41d4-a716-446655440699";
      prisma.userIdentity.findFirst.mockResolvedValue({
        publicId: identityPublicId,
        userId: userInternalId,
        provider: IdentityProvider.EMAIL,
      } as never);
      prisma.userIdentity.count.mockResolvedValue(2);
      prisma.userIdentity.delete.mockResolvedValue({} as never);

      await expect(
        service.unbindIdentity(userInternalId, identityPublicId),
      ).resolves.not.toThrow();
      expect(prisma.userIdentity.delete).toHaveBeenCalledWith({
        where: { publicId: identityPublicId },
      });
    });

    it("should throw AUTH_IDENTITY_NOT_FOUND when identity does not exist", async () => {
      prisma.userIdentity.findFirst.mockResolvedValue(null);

      await expect(
        service.unbindIdentity(
          userInternalId,
          "550e8400-e29b-41d4-a716-446655440699",
        ),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_NOT_FOUND,
      });
    });

    it("should throw AUTH_IDENTITY_LAST_ONE when trying to unbind last identity", async () => {
      const identityPublicId = "550e8400-e29b-41d4-a716-446655440699";
      prisma.userIdentity.findFirst.mockResolvedValue({
        publicId: identityPublicId,
        userId: userInternalId,
        provider: IdentityProvider.EMAIL,
      } as never);
      prisma.userIdentity.count.mockResolvedValue(1);

      await expect(
        service.unbindIdentity(userInternalId, identityPublicId),
      ).rejects.toMatchObject({
        code: ApiErrorCode.AUTH_IDENTITY_LAST_ONE,
      });
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
