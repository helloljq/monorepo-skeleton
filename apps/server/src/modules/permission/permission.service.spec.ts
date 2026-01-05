import { Test, TestingModule } from "@nestjs/testing";
import { RoleType } from "@prisma/client";

import { ApiErrorCode } from "../../common/errors/error-codes";
import { PrismaService } from "../../database/prisma/prisma.service";
import { PermissionCacheService } from "../auth/services/permission-cache.service";
import { PermissionService } from "./permission.service";

describe("PermissionService", () => {
  let service: PermissionService;
  let prismaService: jest.Mocked<PrismaService>;
  let permissionCacheService: jest.Mocked<PermissionCacheService>;

  const mockPermission = {
    id: 1,
    code: "user:read",
    name: "Read Users",
    description: "Permission to read users",
    resource: "user",
    action: "read",
    module: "system",
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    RolePermission: [],
  };

  const mockPermissionWithRoles = {
    ...mockPermission,
    RolePermission: [
      {
        Role: {
          id: 1,
          code: "ADMIN",
          name: "Administrator",
          type: RoleType.SYSTEM,
          isEnabled: true,
        },
      },
    ],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      permission: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockPermissionCacheService = {
      invalidateRoleCache: jest.fn(),
      invalidateRoleCaches: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: PermissionCacheService,
          useValue: mockPermissionCacheService,
        },
      ],
    }).compile();

    service = module.get<PermissionService>(PermissionService);
    prismaService = module.get(PrismaService);
    permissionCacheService = module.get(PermissionCacheService);
  });

  describe("findAll", () => {
    it("should return paginated permissions", async () => {
      prismaService.permission.findMany.mockResolvedValue([mockPermission]);
      prismaService.permission.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual([mockPermission]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it("should filter by module", async () => {
      prismaService.permission.findMany.mockResolvedValue([mockPermission]);
      prismaService.permission.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, module: "system" });

      expect(prismaService.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ module: "system" }),
        }),
      );
    });

    it("should filter by resource", async () => {
      prismaService.permission.findMany.mockResolvedValue([mockPermission]);
      prismaService.permission.count.mockResolvedValue(1);

      await service.findAll({ page: 1, limit: 10, resource: "user" });

      expect(prismaService.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ resource: "user" }),
        }),
      );
    });
  });

  describe("findOne", () => {
    it("should return permission with roles", async () => {
      prismaService.permission.findUnique.mockResolvedValue(
        mockPermissionWithRoles,
      );

      const result = await service.findOne(1);

      expect(result).toEqual(mockPermissionWithRoles);
    });

    it("should throw PERMISSION_NOT_FOUND if permission does not exist", async () => {
      prismaService.permission.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });
  });

  describe("findModules", () => {
    it("should return grouped modules", async () => {
      prismaService.permission.groupBy.mockResolvedValue([
        { module: "system", _count: { id: 5 } },
        { module: "business", _count: { id: 3 } },
      ]);

      const result = await service.findModules();

      expect(result.data).toEqual([
        { module: "system", count: 5 },
        { module: "business", count: 3 },
      ]);
    });
  });

  describe("create", () => {
    it("should create a new permission", async () => {
      prismaService.permission.findUnique.mockResolvedValue(null);
      prismaService.permission.create.mockResolvedValue(mockPermission);

      const result = await service.create({
        code: "user:read",
        name: "Read Users",
        resource: "user",
        action: "read",
        module: "system",
      });

      expect(result).toEqual(mockPermission);
    });

    it("should throw CONFLICT if permission code already exists", async () => {
      prismaService.permission.findUnique.mockResolvedValue(mockPermission);

      await expect(
        service.create({
          code: "user:read",
          name: "Read Users",
          resource: "user",
          action: "read",
        }),
      ).rejects.toMatchObject({
        businessCode: ApiErrorCode.CONFLICT,
      });
    });
  });

  describe("update", () => {
    it("should update a permission", async () => {
      prismaService.permission.findUnique.mockResolvedValue(
        mockPermissionWithRoles,
      );
      prismaService.permission.update.mockResolvedValue({
        ...mockPermission,
        name: "Updated Name",
      });

      const result = await service.update(1, { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
    });

    it("should invalidate cache when isEnabled changes", async () => {
      const permissionWithRoles = {
        ...mockPermission,
        isEnabled: true,
        RolePermission: [{ Role: { code: "ADMIN" } }],
      };
      prismaService.permission.findUnique.mockResolvedValue(
        permissionWithRoles,
      );
      prismaService.permission.update.mockResolvedValue({
        ...mockPermission,
        isEnabled: false,
      });

      await service.update(1, { isEnabled: false });

      expect(permissionCacheService.invalidateRoleCaches).toHaveBeenCalledWith([
        "ADMIN",
      ]);
    });

    it("should not invalidate cache when isEnabled does not change", async () => {
      prismaService.permission.findUnique.mockResolvedValue(
        mockPermissionWithRoles,
      );
      prismaService.permission.update.mockResolvedValue({
        ...mockPermission,
        name: "Updated Name",
      });

      await service.update(1, { name: "Updated Name" });

      expect(
        permissionCacheService.invalidateRoleCaches,
      ).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("should delete a permission and invalidate cache", async () => {
      prismaService.permission.findUnique.mockResolvedValue(
        mockPermissionWithRoles,
      );
      prismaService.permission.delete.mockResolvedValue(mockPermission);

      const result = await service.remove(1);

      expect(result.message).toBe("Permission deleted successfully");
      expect(permissionCacheService.invalidateRoleCaches).toHaveBeenCalledWith([
        "ADMIN",
      ]);
    });

    it("should throw PERMISSION_NOT_FOUND if permission does not exist", async () => {
      prismaService.permission.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toMatchObject({
        businessCode: ApiErrorCode.PERMISSION_NOT_FOUND,
      });
    });

    it("should not call invalidateRoleCaches if no roles are affected", async () => {
      const permissionWithNoRoles = {
        ...mockPermission,
        roles: [],
      };
      prismaService.permission.findUnique.mockResolvedValue(
        permissionWithNoRoles,
      );
      prismaService.permission.delete.mockResolvedValue(mockPermission);

      await service.remove(1);

      expect(
        permissionCacheService.invalidateRoleCaches,
      ).not.toHaveBeenCalled();
    });
  });
});
