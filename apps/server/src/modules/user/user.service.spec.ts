import { Test, TestingModule } from "@nestjs/testing";
import { RoleType } from "@prisma/client";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { UserService } from "./user.service";

describe("UserService", () => {
  let service: UserService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUser = {
    id: 1,
    email: "test@example.com",
    name: "Test User",
    status: "ACTIVE",
    avatar: null,
    password: "hashed",
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
          id: 1,
          code: "USER",
          name: "User",
          type: RoleType.SYSTEM,
          isEnabled: true,
        },
      },
    ],
  };

  const mockRole = {
    id: 2,
    code: "ADMIN",
    name: "Administrator",
    description: "Admin role",
    type: RoleType.SYSTEM,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  const mockUserRole = {
    id: 1,
    userId: 1,
    roleId: 2,
    grantedBy: null,
    grantedAt: new Date(),
    expiresAt: null,
    Role: {
      id: 2,
      code: "ADMIN",
      name: "Administrator",
      type: RoleType.SYSTEM,
      isEnabled: true,
      deletedAt: null,
    },
    User_UserRole_grantedByToUser: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      soft: {
        user: {
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
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
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          userRole: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prismaService = module.get(PrismaService);
  });

  describe("findAll", () => {
    const mockUserList = [
      {
        id: 1,
        name: "Test User",
        avatar: null,
        email: "test@example.com",
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { UserRole_UserRole_userIdToUser: 1 },
      },
    ];

    it("should return paginated users", async () => {
      prismaService.soft.user.findMany.mockResolvedValue(mockUserList);
      prismaService.soft.user.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockUserList);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should filter by id when provided", async () => {
      prismaService.soft.user.findMany.mockResolvedValue(mockUserList);
      prismaService.soft.user.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, id: 1 });

      expect(prismaService.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 1 }),
        }),
      );
    });

    it("should filter by email when provided", async () => {
      prismaService.soft.user.findMany.mockResolvedValue(mockUserList);
      prismaService.soft.user.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, email: "test" });

      expect(prismaService.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: { contains: "test", mode: "insensitive" },
          }),
        }),
      );
    });

    it("should filter by name when provided", async () => {
      prismaService.soft.user.findMany.mockResolvedValue(mockUserList);
      prismaService.soft.user.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, name: "Test" });

      expect(prismaService.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: "Test", mode: "insensitive" },
          }),
        }),
      );
    });

    it("should filter by roleId when provided", async () => {
      prismaService.soft.user.findMany.mockResolvedValue(mockUserList);
      prismaService.soft.user.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, roleId: 2 });

      expect(prismaService.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: expect.objectContaining({
              some: expect.objectContaining({ roleId: 2 }),
            }),
          }),
        }),
      );
    });

    it("should filter by status when provided", async () => {
      prismaService.soft.user.findMany.mockResolvedValue(mockUserList);
      prismaService.soft.user.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, status: "ACTIVE" });

      expect(prismaService.soft.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return user with roles", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne(1);

      expect(result).toEqual(mockUser);
      expect(prismaService.soft.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
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
    });

    it("should throw USER_NOT_FOUND if user does not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe("findUserRoles", () => {
    it("should return filtered user roles", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.userRole.findMany.mockResolvedValue([mockUserRole]);

      const result = await service.findUserRoles(1);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: mockUserRole.id,
        roleId: mockUserRole.Role.id,
        roleCode: mockUserRole.Role.code,
        roleName: mockUserRole.Role.name,
        roleType: mockUserRole.Role.type,
        grantedAt: mockUserRole.grantedAt,
        expiresAt: mockUserRole.expiresAt,
        grantedBy: mockUserRole.User_UserRole_grantedByToUser,
      });
    });

    it("should filter out disabled roles", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.userRole.findMany.mockResolvedValue([
        mockUserRole,
        {
          ...mockUserRole,
          id: 2,
          Role: { ...mockUserRole.Role, isEnabled: false },
        },
      ]);

      const result = await service.findUserRoles(1);

      expect(result.data).toHaveLength(1);
    });

    it("should filter out deleted roles", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.userRole.findMany.mockResolvedValue([
        mockUserRole,
        {
          ...mockUserRole,
          id: 2,
          Role: { ...mockUserRole.Role, deletedAt: new Date() },
        },
      ]);

      const result = await service.findUserRoles(1);

      expect(result.data).toHaveLength(1);
    });

    it("should throw USER_NOT_FOUND if user does not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.findUserRoles(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe("assignRole", () => {
    it("should assign role to user", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findUnique.mockResolvedValue(mockRole);
      prismaService.userRole.findUnique.mockResolvedValue(null);
      prismaService.userRole.create.mockResolvedValue({
        id: 1,
        userId: 1,
        roleId: 2,
        grantedBy: null,
        grantedAt: new Date(),
        expiresAt: null,
        Role: {
          id: 2,
          code: "ADMIN",
          name: "Administrator",
        },
      });

      const result = await service.assignRole(1, { roleId: 2 });

      expect(result.message).toBe("Role assigned successfully");
      expect(result.userRole.roleCode).toBe("ADMIN");
    });

    it("should assign role with expiration", async () => {
      const expiresAt = "2025-12-31T23:59:59.000Z";
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findUnique.mockResolvedValue(mockRole);
      prismaService.userRole.findUnique.mockResolvedValue(null);
      prismaService.userRole.create.mockResolvedValue({
        id: 1,
        userId: 1,
        roleId: 2,
        grantedBy: null,
        grantedAt: new Date(),
        expiresAt: new Date(expiresAt),
        Role: {
          id: 2,
          code: "ADMIN",
          name: "Administrator",
        },
      });

      const result = await service.assignRole(1, { roleId: 2, expiresAt });

      expect(result.message).toBe("Role assigned successfully");
      expect(prismaService.userRole.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: new Date(expiresAt),
          }),
        }),
      );
    });

    it("should throw USER_NOT_FOUND if user does not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRole(999, { roleId: 2 }),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.USER_NOT_FOUND,
      });
    });

    it("should throw ROLE_NOT_FOUND if role does not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRole(1, { roleId: 999 }),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });

    it("should throw ROLE_NOT_FOUND if role is disabled", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findUnique.mockResolvedValue({
        ...mockRole,
        isEnabled: false,
      });

      await expect(service.assignRole(1, { roleId: 2 })).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });

    it("should throw ROLE_ALREADY_ASSIGNED if role already assigned", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findUnique.mockResolvedValue(mockRole);
      prismaService.userRole.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        roleId: 2,
        grantedBy: null,
        grantedAt: new Date(),
        expiresAt: null,
      });

      await expect(service.assignRole(1, { roleId: 2 })).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_ALREADY_ASSIGNED,
      });
    });
  });

  describe("assignRoles", () => {
    it("should replace all roles for user", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findMany.mockResolvedValue([
        mockRole,
        { ...mockRole, id: 3, code: "MANAGER" },
      ]);

      const result = await service.assignRoles(1, [2, 3]);

      expect(result.message).toBe("Roles assigned successfully");
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw USER_NOT_FOUND if user does not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.assignRoles(999, [2, 3])).rejects.toMatchObject({
        businessCode: ApiErrorCode.USER_NOT_FOUND,
      });
    });

    it("should throw ROLE_NOT_FOUND if some roles do not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.soft.role.findMany.mockResolvedValue([mockRole]);

      await expect(service.assignRoles(1, [2, 999])).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });

    it("should throw ROLE_NOT_FOUND if some roles are disabled", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      // findMany only returns enabled roles, so disabled ones won't be found
      prismaService.soft.role.findMany.mockResolvedValue([mockRole]);

      await expect(service.assignRoles(1, [2, 3])).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });
  });

  describe("removeRole", () => {
    it("should remove role from user", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.userRole.findUnique.mockResolvedValue({
        id: 1,
        userId: 1,
        roleId: 2,
        grantedBy: null,
        grantedAt: new Date(),
        expiresAt: null,
        Role: { code: "ADMIN" },
      });
      prismaService.userRole.delete.mockResolvedValue({
        id: 1,
        userId: 1,
        roleId: 2,
        grantedBy: null,
        grantedAt: new Date(),
        expiresAt: null,
      });

      const result = await service.removeRole(1, 2);

      expect(result.message).toBe("Role removed successfully");
      expect(prismaService.userRole.delete).toHaveBeenCalledWith({
        where: {
          userId_roleId: {
            userId: 1,
            roleId: 2,
          },
        },
      });
    });

    it("should throw USER_NOT_FOUND if user does not exist", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(null);

      await expect(service.removeRole(999, 2)).rejects.toMatchObject({
        businessCode: ApiErrorCode.USER_NOT_FOUND,
      });
    });

    it("should throw ROLE_NOT_FOUND if role not assigned to user", async () => {
      prismaService.soft.user.findUnique.mockResolvedValue(mockUser);
      prismaService.userRole.findUnique.mockResolvedValue(null);

      await expect(service.removeRole(1, 999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });
  });
});
