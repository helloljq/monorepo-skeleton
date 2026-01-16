import { Test, TestingModule } from "@nestjs/testing";
import { RoleType } from "@prisma/client";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UserService } from "./user.service";

describe("UserService", () => {
  let service: UserService;
  let prisma: jest.Mocked<PrismaService>;

  const userPublicId = "550e8400-e29b-41d4-a716-446655440000";
  const userInternalId = 1;

  const rolePublicId = "550e8400-e29b-41d4-a716-446655440001";
  const roleInternalId = 10;

  const grantedByPublicId = "550e8400-e29b-41d4-a716-446655440002";

  beforeEach(async () => {
    const mockPrisma: Partial<jest.Mocked<PrismaService>> = {
      soft: {
        user: {
          findMany: jest.fn(),
          count: jest.fn(),
          findUnique: jest.fn(),
        },
        role: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
        },
      },
      userRole: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(UserService);
    prisma = module.get(PrismaService);
  });

  describe("findAll", () => {
    it("should return items and pagination", async () => {
      const now = new Date();
      prisma.soft.user.findMany.mockResolvedValue([
        {
          publicId: userPublicId,
          name: "Test User",
          avatar: null,
          email: "test@example.com",
          status: "ACTIVE",
          createdAt: now,
          updatedAt: now,
          _count: { userRoles: 2 },
        },
      ]);
      prisma.soft.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: [
          {
            id: userPublicId,
            name: "Test User",
            avatar: null,
            email: "test@example.com",
            status: "ACTIVE",
            createdAt: now,
            updatedAt: now,
            roleCount: 2,
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 10 },
      });
    });

    it("should filter by public id when provided", async () => {
      prisma.soft.user.findMany.mockResolvedValue([]);
      prisma.soft.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 10, id: userPublicId });

      expect(prisma.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ publicId: userPublicId }),
        }),
      );
    });

    it("should filter by role public id when provided", async () => {
      prisma.soft.user.findMany.mockResolvedValue([]);
      prisma.soft.user.count.mockResolvedValue(0);

      await service.findAll({ page: 1, pageSize: 10, roleId: rolePublicId });

      expect(prisma.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userRoles: expect.objectContaining({
              some: expect.objectContaining({
                role: expect.objectContaining({ publicId: rolePublicId }),
              }),
            }),
          }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return user and enabled roles", async () => {
      const now = new Date();
      prisma.soft.user.findUnique.mockResolvedValue({
        id: userInternalId,
        publicId: userPublicId,
        email: "test@example.com",
        name: "Test User",
        avatar: null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        userRoles: [
          {
            role: {
              publicId: rolePublicId,
              code: "ADMIN",
              name: "Administrator",
              type: RoleType.SYSTEM,
              isEnabled: true,
              deletedAt: null,
            },
          },
          {
            role: {
              publicId: "550e8400-e29b-41d4-a716-446655440003",
              code: "DISABLED",
              name: "Disabled",
              type: RoleType.CUSTOM,
              isEnabled: false,
              deletedAt: null,
            },
          },
          {
            role: {
              publicId: "550e8400-e29b-41d4-a716-446655440004",
              code: "DELETED",
              name: "Deleted",
              type: RoleType.CUSTOM,
              isEnabled: true,
              deletedAt: new Date(),
            },
          },
        ],
      });

      const result = await service.findOne(userPublicId);

      expect(result).toEqual({
        id: userPublicId,
        email: "test@example.com",
        name: "Test User",
        avatar: null,
        status: "ACTIVE",
        createdAt: now,
        updatedAt: now,
        roles: [
          {
            id: rolePublicId,
            code: "ADMIN",
            name: "Administrator",
            type: RoleType.SYSTEM,
            isEnabled: true,
          },
        ],
      });
    });

    it("should throw USER_NOT_FOUND when missing", async () => {
      prisma.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userPublicId)).rejects.toMatchObject({
        code: ApiErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe("findUserRoles", () => {
    it("should return items with role info", async () => {
      const grantedAt = new Date();
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.userRole.findMany.mockResolvedValue([
        {
          grantedAt,
          expiresAt: null,
          role: {
            publicId: rolePublicId,
            code: "ADMIN",
            name: "Administrator",
            type: RoleType.SYSTEM,
            isEnabled: true,
            deletedAt: null,
          },
          grantedBy: { publicId: grantedByPublicId, name: "Grantor" },
        },
      ]);

      const result = await service.findUserRoles(userPublicId);

      expect(result).toEqual({
        items: [
          {
            role: {
              id: rolePublicId,
              code: "ADMIN",
              name: "Administrator",
              type: RoleType.SYSTEM,
              isEnabled: true,
            },
            grantedAt,
            expiresAt: null,
            grantedBy: { id: grantedByPublicId, name: "Grantor" },
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 1 },
      });
    });

    it("should filter out disabled/deleted roles", async () => {
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.userRole.findMany.mockResolvedValue([
        {
          grantedAt: new Date(),
          expiresAt: null,
          role: {
            publicId: rolePublicId,
            code: "ADMIN",
            name: "Administrator",
            type: RoleType.SYSTEM,
            isEnabled: true,
            deletedAt: null,
          },
          grantedBy: null,
        },
        {
          grantedAt: new Date(),
          expiresAt: null,
          role: {
            publicId: "550e8400-e29b-41d4-a716-446655440005",
            code: "DISABLED",
            name: "Disabled",
            type: RoleType.CUSTOM,
            isEnabled: false,
            deletedAt: null,
          },
          grantedBy: null,
        },
        {
          grantedAt: new Date(),
          expiresAt: null,
          role: {
            publicId: "550e8400-e29b-41d4-a716-446655440006",
            code: "DELETED",
            name: "Deleted",
            type: RoleType.CUSTOM,
            isEnabled: true,
            deletedAt: new Date(),
          },
          grantedBy: null,
        },
      ]);

      const result = await service.findUserRoles(userPublicId);
      expect(result.items).toHaveLength(1);
    });

    it("should throw USER_NOT_FOUND when missing", async () => {
      prisma.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserRoles(userPublicId)).rejects.toMatchObject({
        code: ApiErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe("assignRole", () => {
    it("should assign role and return message", async () => {
      const grantedAt = new Date();
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "ADMIN",
        name: "Administrator",
        isEnabled: true,
      });
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.userRole.create.mockResolvedValue({ grantedAt, expiresAt: null });

      const result = await service.assignRole(userPublicId, {
        roleId: rolePublicId,
      });

      expect(result).toEqual({
        message: "Role assigned successfully",
        userRole: {
          roleId: rolePublicId,
          roleCode: "ADMIN",
          roleName: "Administrator",
          grantedAt,
          expiresAt: null,
        },
      });
    });

    it("should throw ROLE_ALREADY_ASSIGNED when exists", async () => {
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "ADMIN",
        name: "Administrator",
        isEnabled: true,
      });
      prisma.userRole.findUnique.mockResolvedValue({ id: 999 });

      await expect(
        service.assignRole(userPublicId, { roleId: rolePublicId }),
      ).rejects.toMatchObject({ code: ApiErrorCode.ROLE_ALREADY_ASSIGNED });
    });
  });

  describe("assignRoles", () => {
    it("should replace all roles for user", async () => {
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.soft.role.findMany.mockResolvedValue([
        { id: 10, publicId: "550e8400-e29b-41d4-a716-446655440010" },
        { id: 11, publicId: "550e8400-e29b-41d4-a716-446655440011" },
      ]);

      const tx = {
        userRole: {
          deleteMany: jest.fn(),
          createMany: jest.fn(),
        },
      };
      prisma.$transaction.mockImplementation(async (fn) => fn(tx as never));

      const result = await service.assignRoles(userPublicId, [
        "550e8400-e29b-41d4-a716-446655440010",
        "550e8400-e29b-41d4-a716-446655440011",
      ]);

      expect(result).toEqual({ message: "Roles assigned successfully" });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
        where: { userId: userInternalId },
      });
      expect(tx.userRole.createMany).toHaveBeenCalled();
    });

    it("should throw ROLE_NOT_FOUND when some roles are missing/disabled", async () => {
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.soft.role.findMany.mockResolvedValue([
        { id: 10, publicId: "550e8400-e29b-41d4-a716-446655440010" },
      ]);

      await expect(
        service.assignRoles(userPublicId, [
          "550e8400-e29b-41d4-a716-446655440010",
          "550e8400-e29b-41d4-a716-446655440011",
        ]),
      ).rejects.toMatchObject({ code: ApiErrorCode.ROLE_NOT_FOUND });
    });
  });

  describe("removeRole", () => {
    it("should remove role and return message", async () => {
      prisma.soft.user.findUnique.mockResolvedValue({ id: userInternalId });
      prisma.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        code: "ADMIN",
      });
      prisma.userRole.findUnique.mockResolvedValue({ id: 123 });
      prisma.userRole.delete.mockResolvedValue({ id: 123 });

      const result = await service.removeRole(userPublicId, rolePublicId);

      expect(result).toEqual({ message: "Role removed successfully" });
      expect(prisma.userRole.delete).toHaveBeenCalledWith({
        where: {
          userId_roleId: {
            userId: userInternalId,
            roleId: roleInternalId,
          },
        },
      });
    });
  });
});
