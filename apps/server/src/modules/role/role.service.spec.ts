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

  const now = new Date();

  const rolePublicId = "550e8400-e29b-41d4-a716-446655440100";
  const roleInternalId = 1;

  const systemRolePublicId = "550e8400-e29b-41d4-a716-446655440101";
  const systemRoleInternalId = 2;

  const permissionPublicId1 = "550e8400-e29b-41d4-a716-446655440200";
  const permissionPublicId2 = "550e8400-e29b-41d4-a716-446655440201";
  const permissionInternalId1 = 11;
  const permissionInternalId2 = 12;

  const mockRole = {
    id: roleInternalId,
    publicId: rolePublicId,
    code: "CUSTOM_ROLE",
    name: "Custom Role",
    description: "A custom role",
    type: RoleType.CUSTOM,
    isEnabled: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedById: null,
    deleteReason: null,
    _count: { userRoles: 0, rolePermissions: 0 },
  };

  const mockSystemRole = {
    ...mockRole,
    id: systemRoleInternalId,
    publicId: systemRolePublicId,
    code: "ADMIN",
    name: "Administrator",
    type: RoleType.SYSTEM,
  };

  const mockPermission = {
    id: permissionInternalId1,
    publicId: permissionPublicId1,
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

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result).toEqual({
        items: [
          {
            id: rolePublicId,
            code: "CUSTOM_ROLE",
            name: "Custom Role",
            description: "A custom role",
            type: RoleType.CUSTOM,
            isEnabled: true,
            createdAt: now,
            updatedAt: now,
            userCount: 0,
            permissionCount: 0,
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 10 },
      });
    });
  });

  describe("findOne", () => {
    it("should return role with permissions", async () => {
      const roleWithPermissions = {
        ...mockRole,
        rolePermissions: [{ permission: mockPermission }],
        _count: { userRoles: 5 },
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);

      const result = await service.findOne(rolePublicId);

      expect(result).toEqual({
        id: rolePublicId,
        code: "CUSTOM_ROLE",
        name: "Custom Role",
        description: "A custom role",
        type: RoleType.CUSTOM,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
        userCount: 5,
        permissions: [
          {
            id: permissionPublicId1,
            code: "user:read",
            name: "Read Users",
            resource: "user",
            action: "read",
            module: "system",
            isEnabled: true,
          },
        ],
      });
    });

    it("should throw ROLE_NOT_FOUND if role does not exist", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue(null);

      await expect(service.findOne(rolePublicId)).rejects.toMatchObject({
        code: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });
  });

  describe("create", () => {
    it("should create a new role", async () => {
      prismaService.role.findUnique.mockResolvedValue(null);
      prismaService.role.create.mockResolvedValue(mockRole as never);

      const result = await service.create({
        code: "CUSTOM_ROLE",
        name: "Custom Role",
        description: "A custom role",
      });

      expect(result).toEqual({
        id: rolePublicId,
        code: "CUSTOM_ROLE",
        name: "Custom Role",
        description: "A custom role",
        type: RoleType.CUSTOM,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      });
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
        code: ApiErrorCode.CONFLICT,
      });
    });
  });

  describe("update", () => {
    it("should update a custom role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.role.update.mockResolvedValue({
        ...mockRole,
        name: "Updated Name",
      });

      const result = await service.update(rolePublicId, {
        name: "Updated Name",
      });

      expect(result.name).toBe("Updated Name");
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw ROLE_SYSTEM_IMMUTABLE when updating system role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: systemRoleInternalId,
        publicId: systemRolePublicId,
        code: "ADMIN",
        type: RoleType.SYSTEM,
      } as never);

      await expect(
        service.update(systemRolePublicId, { name: "New Name" }),
      ).rejects.toMatchObject({
        code: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
      });
    });
  });

  describe("remove", () => {
    it("should soft delete a custom role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.genericSoftDelete.mockResolvedValue(mockRole as never);

      await service.remove(rolePublicId);

      expect(prismaService.genericSoftDelete).toHaveBeenCalledWith(
        "Role",
        roleInternalId,
        expect.objectContaining({
          reason: "Deleted by admin",
        }),
      );
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw ROLE_SYSTEM_IMMUTABLE when deleting system role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: systemRoleInternalId,
        publicId: systemRolePublicId,
        code: "ADMIN",
        type: RoleType.SYSTEM,
      } as never);

      await expect(service.remove(systemRolePublicId)).rejects.toMatchObject({
        code: ApiErrorCode.ROLE_SYSTEM_IMMUTABLE,
      });
    });
  });

  describe("assignPermissions", () => {
    it("should assign permissions to role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findMany.mockResolvedValue([
        { id: permissionInternalId1, publicId: permissionPublicId1 },
        { id: permissionInternalId2, publicId: permissionPublicId2 },
      ]);

      const result = await service.assignPermissions(rolePublicId, [
        permissionPublicId1,
        permissionPublicId2,
      ]);

      expect(result.message).toBe("Permissions assigned successfully");
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw PERMISSION_NOT_FOUND if some permissions do not exist", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findMany.mockResolvedValue([mockPermission]);

      await expect(
        service.assignPermissions(rolePublicId, [
          permissionPublicId1,
          "550e8400-e29b-41d4-a716-446655440299",
        ]),
      ).rejects.toMatchObject({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("addPermission", () => {
    it("should add a permission to role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findUnique.mockResolvedValue({
        id: permissionInternalId1,
      } as never);
      prismaService.rolePermission.findUnique.mockResolvedValue(null);
      prismaService.rolePermission.create.mockResolvedValue({
        id: 1,
        roleId: roleInternalId,
        permissionId: permissionInternalId1,
        grantedBy: null,
        grantedAt: new Date(),
      });

      const result = await service.addPermission(
        rolePublicId,
        permissionPublicId1,
      );

      expect(result.message).toBe("Permission added successfully");
    });

    it("should throw PERMISSION_ALREADY_ASSIGNED if already assigned", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findUnique.mockResolvedValue({
        id: permissionInternalId1,
      } as never);
      prismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        roleId: roleInternalId,
        permissionId: permissionInternalId1,
        grantedBy: null,
        grantedAt: new Date(),
      });

      await expect(
        service.addPermission(rolePublicId, permissionPublicId1),
      ).rejects.toMatchObject({
        code: ApiErrorCode.PERMISSION_ALREADY_ASSIGNED,
      });
    });

    it("should throw PERMISSION_NOT_FOUND if permission does not exist", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findUnique.mockResolvedValue(null);

      await expect(
        service.addPermission(rolePublicId, permissionPublicId1),
      ).rejects.toMatchObject({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("removePermission", () => {
    it("should remove a permission from role", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findUnique.mockResolvedValue({
        id: permissionInternalId1,
      } as never);
      prismaService.rolePermission.findUnique.mockResolvedValue({
        id: 1,
        roleId: roleInternalId,
        permissionId: permissionInternalId1,
        grantedBy: null,
        grantedAt: new Date(),
      });
      prismaService.rolePermission.delete.mockResolvedValue({
        id: 1,
        roleId: roleInternalId,
        permissionId: permissionInternalId1,
        grantedBy: null,
        grantedAt: new Date(),
      });

      const result = await service.removePermission(
        rolePublicId,
        permissionPublicId1,
      );

      expect(result.message).toBe("Permission removed successfully");
      expect(permissionCacheService.invalidateRoleCache).toHaveBeenCalledWith(
        "CUSTOM_ROLE",
      );
    });

    it("should throw PERMISSION_NOT_FOUND if permission not assigned", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue({
        id: roleInternalId,
        publicId: rolePublicId,
        code: "CUSTOM_ROLE",
        type: RoleType.CUSTOM,
      } as never);
      prismaService.permission.findUnique.mockResolvedValue({
        id: permissionInternalId1,
      } as never);
      prismaService.rolePermission.findUnique.mockResolvedValue(null);

      await expect(
        service.removePermission(rolePublicId, permissionPublicId1),
      ).rejects.toMatchObject({
        code: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("findRolePermissions", () => {
    it("should return role permissions", async () => {
      const roleWithPermissions = {
        ...mockRole,
        rolePermissions: [
          {
            permission: mockPermission,
          },
        ],
      };
      prismaService.soft.role.findUnique.mockResolvedValue(roleWithPermissions);

      const result = await service.findRolePermissions(rolePublicId);

      expect(result).toEqual({
        items: [
          {
            id: permissionPublicId1,
            code: "user:read",
            name: "Read Users",
            resource: "user",
            action: "read",
            module: "system",
            isEnabled: true,
          },
        ],
        pagination: { total: 1, page: 1, pageSize: 1 },
      });
    });

    it("should throw ROLE_NOT_FOUND if role does not exist", async () => {
      prismaService.soft.role.findUnique.mockResolvedValue(null);

      await expect(
        service.findRolePermissions(rolePublicId),
      ).rejects.toMatchObject({
        code: ApiErrorCode.ROLE_NOT_FOUND,
      });
    });

    it("should return empty array when role has no permissions", async () => {
      const roleWithoutPermissions = {
        ...mockRole,
        rolePermissions: [],
      };
      prismaService.soft.role.findUnique.mockResolvedValue(
        roleWithoutPermissions,
      );

      const result = await service.findRolePermissions(rolePublicId);

      expect(result).toEqual({
        items: [],
        pagination: { total: 0, page: 1, pageSize: 0 },
      });
    });
  });
});
