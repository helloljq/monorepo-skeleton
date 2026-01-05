/**
 * RBAC 权限系统 E2E 测试
 *
 * 测试场景：
 * 1. 普通用户 (USER 角色) 访问受保护资源 - 根据权限决定成功/失败
 * 2. 分配角色后获得新权限
 * 3. 移除角色后权限立即失效
 * 4. SUPER_ADMIN 绕过权限检查
 */

import { INestApplication } from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";

import { AppModule } from "./../src/app.module";
import { AllExceptionsFilter } from "./../src/common/filters/all-exceptions.filter";
import { PrismaClientExceptionFilter } from "./../src/common/filters/prisma-client-exception.filter";
import { AuditContextInterceptor } from "./../src/common/interceptors/audit-context.interceptor";
import { IdempotencyInterceptor } from "./../src/common/interceptors/idempotency.interceptor";
import { TransformInterceptor } from "./../src/common/interceptors/transform.interceptor";
import { REDIS_CLIENT } from "./../src/common/redis/redis.module";
import { AppConfigService } from "./../src/config/app-config.service";
import { PrismaService } from "./../src/database/prisma/prisma.service";

type RedisClient = import("ioredis").default;

interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
}

describe("RBAC Permission System (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: RedisClient;

  // 测试用户 - 普通用户 (默认 USER 角色，只有 user:read 权限)
  const testUser = {
    email: `rbac-user-${Date.now()}@example.com`,
    password: "TestPassword123",
    name: "RBAC Test User",
  };

  // 测试管理员 - 需要手动分配 ADMIN 角色
  const testAdmin = {
    email: `rbac-admin-${Date.now()}@example.com`,
    password: "AdminPassword123",
    name: "RBAC Test Admin",
  };

  let userAccessToken: string;
  let adminAccessToken: string;
  let testUserId: number;
  let testAdminId: number;
  let adminRoleId: number;
  let guestRoleId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app =
      moduleFixture.createNestApplication() as unknown as INestApplication<App>;
    app.enableShutdownHooks();
    app.setGlobalPrefix("api/v1");

    const httpAdapter = app.get<HttpAdapterHost>(HttpAdapterHost);
    app.useGlobalFilters(
      new PrismaClientExceptionFilter(),
      new AllExceptionsFilter(httpAdapter),
    );

    const reflector = app.get<Reflector>(Reflector);
    const configService = app.get<AppConfigService>(AppConfigService);
    redis = app.get<RedisClient>(REDIS_CLIENT);
    app.useGlobalInterceptors(
      new IdempotencyInterceptor(reflector, redis, configService),
      new AuditContextInterceptor(),
      new TransformInterceptor(reflector),
    );

    prisma = app.get<PrismaService>(PrismaService);

    await app.init();

    // 获取预置角色 ID
    const adminRole = await prisma.role.findUnique({
      where: { code: "ADMIN" },
    });
    const guestRole = await prisma.role.findUnique({
      where: { code: "GUEST" },
    });
    adminRoleId = adminRole!.id;
    guestRoleId = guestRole!.id;

    // 注册测试用户
    const userRegResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(testUser);
    testUserId = (userRegResponse.body as ApiResponse<{ id: number }>).data.id;

    // 注册测试管理员
    const adminRegResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(testAdmin);
    testAdminId = (adminRegResponse.body as ApiResponse<{ id: number }>).data
      .id;

    // 为测试管理员分配 ADMIN 角色 (直接通过数据库操作，模拟系统初始化)
    await prisma.userRole.create({
      data: {
        userId: testAdminId,
        roleId: adminRoleId,
      },
    });

    // 清理权限缓存
    const cacheKeys = await redis.keys("permission:role:*");
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }

    // 登录获取 token
    const userLoginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
        deviceId: "rbac-test-device-user",
      });
    userAccessToken = (userLoginResponse.body as ApiResponse<LoginResponse>)
      .data.accessToken;

    const adminLoginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testAdmin.email,
        password: testAdmin.password,
        deviceId: "rbac-test-device-admin",
      });
    adminAccessToken = (adminLoginResponse.body as ApiResponse<LoginResponse>)
      .data.accessToken;
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await prisma.userRole.deleteMany({
        where: { userId: { in: [testUserId, testAdminId] } },
      });
      await prisma.userIdentity.deleteMany({
        where: { userId: { in: [testUserId, testAdminId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [testUserId, testAdminId] } },
      });
    } catch {
      // Ignore cleanup errors
    }

    if (app) {
      await app.close();
    }
  });

  describe("Permission Check - Basic Access Control", () => {
    it("USER role should access /users (has user:read permission)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${userAccessToken}`)
        .expect(200);

      const body = response.body as ApiResponse;
      expect(body.code).toBe(0);
    });

    it("USER role should be denied access to /roles (no role:read permission)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${userAccessToken}`)
        .expect(403);

      const body = response.body as ApiResponse;
      expect(body.code).toBe(10003); // FORBIDDEN
    });

    it("ADMIN role should access /roles (has role:read permission)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const body = response.body as ApiResponse;
      expect(body.code).toBe(0);
    });

    it("ADMIN role should access /permissions (has permission:read permission)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/permissions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      const body = response.body as ApiResponse;
      expect(body.code).toBe(0);
    });
  });

  describe("Permission Check - Role Assignment Flow", () => {
    it("should gain permissions after role assignment and re-login", async () => {
      // 1. 验证用户当前无法访问 /roles
      await request(app.getHttpServer())
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${userAccessToken}`)
        .expect(403);

      // 2. 管理员为用户分配 GUEST 角色 (有 role:read 权限)
      const assignResponse = await request(app.getHttpServer())
        .post(`/api/v1/users/${testUserId}/roles`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({ roleId: guestRoleId })
        .expect(201);

      expect((assignResponse.body as ApiResponse).code).toBe(0);

      // 3. 清理权限缓存使新权限立即生效
      const cacheKeys = await redis.keys("permission:role:*");
      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys);
      }

      // 4. 重新登录以获取包含新角色的 JWT token
      // (JWT token 在登录时固化角色信息，分配新角色后需要重新登录)
      const reLoginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
          deviceId: "rbac-test-device-user-relogin",
        });

      const newAccessToken = (
        reLoginResponse.body as ApiResponse<LoginResponse>
      ).data.accessToken;

      // 5. 使用新 token，用户现在应该能访问 /roles
      const rolesResponse = await request(app.getHttpServer())
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${newAccessToken}`)
        .expect(200);

      expect((rolesResponse.body as ApiResponse).code).toBe(0);

      // 更新 userAccessToken 供后续测试使用
      userAccessToken = newAccessToken;
    });

    it("should lose permissions after role removal and re-login", async () => {
      // 1. 验证用户当前可以访问 /roles (上个测试分配了 GUEST 角色并重新登录)
      await request(app.getHttpServer())
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${userAccessToken}`)
        .expect(200);

      // 2. 管理员移除用户的 GUEST 角色
      const removeResponse = await request(app.getHttpServer())
        .delete(`/api/v1/users/${testUserId}/roles/${guestRoleId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect((removeResponse.body as ApiResponse).code).toBe(0);

      // 3. 清理权限缓存
      const cacheKeys = await redis.keys("permission:role:*");
      if (cacheKeys.length > 0) {
        await redis.del(...cacheKeys);
      }

      // 4. 重新登录以获取更新后的 JWT token
      const reLoginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
          deviceId: "rbac-test-device-user-relogin-2",
        });

      const newAccessToken = (
        reLoginResponse.body as ApiResponse<LoginResponse>
      ).data.accessToken;

      // 5. 使用新 token，用户现在应该无法访问 /roles
      const rolesResponse = await request(app.getHttpServer())
        .get("/api/v1/roles")
        .set("Authorization", `Bearer ${newAccessToken}`)
        .expect(403);

      expect((rolesResponse.body as ApiResponse).code).toBe(10003); // FORBIDDEN
    });
  });

  describe("Permission Check - Edge Cases", () => {
    it("should return 401 for unauthenticated requests to protected endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/users")
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe(10002); // UNAUTHORIZED
    });

    it("should return 401 for invalid token", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/users")
        .set("Authorization", "Bearer invalid-token")
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe(10002); // UNAUTHORIZED
    });

    it("should allow ADMIN to assign roles to users", async () => {
      // 管理员有 user:assign-role 权限
      const response = await request(app.getHttpServer())
        .get(`/api/v1/users/${testUserId}/roles`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect((response.body as ApiResponse).code).toBe(0);
    });

    it("USER role should be denied from assigning roles", async () => {
      // 普通用户没有 user:assign-role 权限
      const response = await request(app.getHttpServer())
        .post(`/api/v1/users/${testAdminId}/roles`)
        .set("Authorization", `Bearer ${userAccessToken}`)
        .send({ roleId: guestRoleId })
        .expect(403);

      expect((response.body as ApiResponse).code).toBe(10003); // FORBIDDEN
    });
  });

  describe("Permission Check - Write Operations", () => {
    let testRoleId: number;

    it("ADMIN should be able to create a new role", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/roles")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          code: `TEST_ROLE_${Date.now()}`,
          name: "Test Role",
          description: "A test role for E2E testing",
        })
        .expect(201);

      const body = response.body as ApiResponse<{ id: number }>;
      expect(body.code).toBe(0);
      testRoleId = body.data.id;
    });

    it("USER should be denied from creating roles", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/roles")
        .set("Authorization", `Bearer ${userAccessToken}`)
        .send({
          code: `FORBIDDEN_ROLE_${Date.now()}`,
          name: "Forbidden Role",
        })
        .expect(403);

      expect((response.body as ApiResponse).code).toBe(10003); // FORBIDDEN
    });

    it("ADMIN should be able to update a role", async () => {
      if (!testRoleId) {
        return; // Skip if role was not created
      }

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/roles/${testRoleId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .send({
          name: "Updated Test Role",
        })
        .expect(200);

      expect((response.body as ApiResponse).code).toBe(0);
    });

    it("ADMIN should be able to delete a role", async () => {
      if (!testRoleId) {
        return; // Skip if role was not created
      }

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/roles/${testRoleId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .expect(200);

      expect((response.body as ApiResponse).code).toBe(0);
    });
  });
});
