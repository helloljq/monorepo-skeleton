import { Test, TestingModule } from "@nestjs/testing";
import { RoleType } from "@prisma/client";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { PermissionCacheService } from "../auth/services/permission-cache.service";
import { RoleService } from "./role.service";

describe("RoleService", () => {
  let service: RoleService;
  let prismaService: jest.Mocked<PrismaService>;
  let permissionCacheService: jest.Mocked<PermissionCacheService>;

  const mockRole = {
    id: 1,
    code: "CUSTOM_ROLE",
    name: "Custom Role",
    description: "A custom role",
    type: RoleType.CUSTOM,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
  };

  const mockSystemRole = {
    ...mockRole,
    id: 2,
    code: "ADMIN",
    name: "Administrator",
    type: RoleType.SYSTEM,
  };

  const mockPermission = {
    id: 1,
    code: "user:read",
    name: "Read Users",
    resource: "user",
    action: "read",
    module: "system",
    isEnabled: true,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      soft: {
        role: {
          findMany: jest.fn(),
          findUnique: jest.fn(),
          count: jest.fn(),
        },
      },
      role: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      rolePermission: {
        findUnique: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          rolePermission: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
          },
        }),
      ),
      genericSoftDelete: jest.fn(),
    };

    const mockPermissionCacheService = {
      invalidateRoleCache: jest.fn(),
      invalidateRoleCaches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: PermissionCacheService,
          useValue: mockPermissionCacheService,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    prismaService = module.get(PrismaService);
    permissionCacheService = module.get(PermissionCacheService);
  });

  describe("findAll", () => {
    it("should return paginated roles", async () => {
      const mockRoles = [mockRole];
      prismaService.soft.role.findMany.mockResolvedValue(mockRoles);
      prismaService.soft.role.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockRoles);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe("findOne", () => {
    it("should return role with permissions", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [{ permission: mockPermission }],
        _count: { users: 5 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);

      const result = await service.findOne(1);

      expect(result).toEqual(roleWithPermissions);
    });

    it("should throw ROLE_NOT_FOUND if role does not exist", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });
  });

  describe("create", () => {
    it("should create a new role", async () => {
      prismaService.role.findUnique.mockResolvedValue(null);
      prismaService.role.create.mockResolvedValue(mockRole);

      const result = await service.create({
        code: "CUSTOM_ROLE",
        name: "Custom Role",
        description: "A custom role",
      });

      expect(result).toEqual(mockRole);
      expect(prismaService.role.create).toHaveBeenCalledWith({
        data: {
          code: "CUSTOM_ROLE",
          name: "Custom Role",
          description: "A custom role",
          type: RoleType.CUSTOM,
        },
      });
    });

    it("should throw CONFLICT if role code already exists", async () => {
      prismaService.role.findUnique.mockResolvedValue(mockRole);

      await expect(
        service.create({
          code: "CUSTOM_ROLE",
          name: "Custom Role",
        }),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFLICT,
      });
    });
  });

  describe("update", () => {
    it("should update a custom role", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.role.update.mockResolvedValue({
        ...mockRole,
        name: "Updated Name",
      });

      const result = await service.update(1, { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw ROLE_SYSTEM_IMMUTABLE when updating system role", async () => {
      const systemRoleWithPermissions = {
        ...mockSystemRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(
        systemRoleWithPermissions,
      );

      await expect(
        service.update(2, { name: "New Name" }),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
      });
    });
  });

  describe("remove", () => {
    it("should soft delete a custom role", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.genericSoftDelete.mockResolvedValue(mockRole);

      await service.remove(1);

      expect(prismaService.genericSoftDelete).toHaveBeenCalledWith(
        "Role",
        1,
        expect.any(Object),
      );
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw ROLE_SYSTEM_IMMUTABLE when deleting system role", async () => {
      const systemRoleWithPermissions = {
        ...mockSystemRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(
        systemRoleWithPermissions,
      );

      await expect(service.remove(2)).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
      });
    });
  });

  describe("assignPermissions", () => {
    it("should assign permissions to role", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.permission.findMany.mockResolvedValue([
        mockPermission,
        { ...mockPermission, id: 2, code: "user:create" },
      ]);

      const result = await service.assignPermissions(1, [1, 2]);

      expect(result.message).toBe("Permissions assigned successfully");
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw PERMISSION_NOT_FOUND if some permissions do not exist", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.permission.findMany.mockResolvedValue([mockPermission]);

      await expect(
        service.assignPermissions(1, [1, 999]),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("addPermission", () => {
    it("should add a permission to role", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.permission.findUnique.mockResolvedValue(mockPermission);
      prismaService.rolePermission.findUnique.mockResolvedValue(null);
      prismaService.rolePermission.create.mockResolvedValue({
        id: 1,
        roleId: 1,
        permissionId: 1,
        grantedBy: null,
        grantedAt: new Date(),
      });

      const result = await service.addPermission(1, 1);

      expect(result.message).toBe("Permission added successfully");
    });

    it("should throw PERMISSION_ALREADY_ASSIGNED if already assigned", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.permission.findUnique.mockResolvedValue(mockPermission);
      prismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        roleId: 1,
        permissionId: 1,
        grantedBy: null,
        grantedAt: new Date(),
      });

      await expect(service.addPermission(1, 1)).rejects.toMatchObject({
        businessCode: ApiErrorCode.PERMISSION_ALREADY_ASSIGNED,
      });
    });

    it("should throw PERMISSION_NOT_FOUND if permission does not exist", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.permission.findUnique.mockResolvedValue(null);

      await expect(service.addPermission(1, 999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("removePermission", () => {
    it("should remove a permission from role", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        roleId: 1,
        permissionId: 1,
        grantedBy: null,
        grantedAt: new Date(),
      });
      prismaService.rolePermission.delete.mockResolvedValue({
        id: 1,
        roleId: 1,
        permissionId: 1,
        grantedBy: null,
        grantedAt: new Date(),
      });

      const result = await service.removePermission(1, 1);

      expect(result.message).toBe("Permission removed successfully");
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw PERMISSION_NOT_FOUND if permission not assigned", async () => {
      const roleWithPermissions = {
        ...mockRole,
        permissions: [],
        _count: { users: 0 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);
      prismaService.rolePermission.findUnique.mockResolvedValue(null);

      await expect(service.removePermission(1, 999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("findRolePermissions", () => {
    it("should return role permissions", async () => {
      const roleWithPermissions = {
        ...mockRole,
        RolePermission: [
          {
            Permission: mockPermission,
          },
        ],
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);

      const result = await service.findRolePermissions(1);

      expect(result.data).toEqual([mockPermission]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1,
      });
    });

    it("should throw ROLE_NOT_FOUND if role does not exist", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue(null);

      await expect(service.findRolePermissions(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });

    it("should return empty array when role has no permissions", async () => {
      const roleWithoutPermissions = {
        ...mockRole,
        RolePermission: [],
      };
      prismaService.soft.role.findUnique.mockResolvedValue(
        roleWithoutPermissions,
      );

      const result = await service.findRolePermissions(1);

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 0,
        totalPages: 1,
      });
    });
  });
});
