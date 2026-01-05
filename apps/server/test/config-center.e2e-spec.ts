import { HttpStatus, INestApplication } from "@nestjs/common";
import { HttpAdapterHost, Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";

import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";
import { PrismaClientExceptionFilter } from "../src/common/filters/prisma-client-exception.filter";
import { AuditContextInterceptor } from "../src/common/interceptors/audit-context.interceptor";
import { IdempotencyInterceptor } from "../src/common/interceptors/idempotency.interceptor";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { REDIS_CLIENT } from "../src/common/redis/redis.module";
import { AppConfigService } from "../src/config/app-config.service";
import { PrismaService } from "../src/database/prisma/prisma.service";

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

/**
 * 配置中心 E2E 测试
 *
 * 测试核心功能：
 * 1. 命名空间管理
 * 2. 配置项 CRUD
 * 3. 加密配置
 * 4. JSON Schema 校验
 * 5. 版本历史与回滚
 * 6. 批量操作
 */
describe("Config Center (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: RedisClient;
  let authToken: string;
  let testUserId: number;

  const testUser = {
    email: `config-test-${Date.now()}@example.com`,
    password: "TestPassword123",
    name: "Config Test User",
  };

  const TEST_NAMESPACE = {
    name: "test_namespace_e2e",
    displayName: "测试命名空间",
    description: "E2E 测试用命名空间",
    isEnabled: true,
  };

  const TEST_CONFIG = {
    key: "test_config",
    value: { feature: "enabled", threshold: 100 },
    valueType: "JSON",
    description: "测试配置",
    isEncrypted: false,
    isEnabled: true,
  };

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

    // 清理之前可能存在的测试数据
    try {
      // 先删除配置项（包括软删除的）
      const existingNamespace = await prisma.configNamespace.findFirst({
        where: { name: TEST_NAMESPACE.name },
      });

      if (existingNamespace) {
        // 先获取所有配置项 ID
        const configs = await prisma.configItem.findMany({
          where: { namespaceId: existingNamespace.id },
          select: { id: true },
        });
        const configIds = configs.map((c) => c.id);

        // 1. 先删除历史记录（外键依赖）
        if (configIds.length > 0) {
          await prisma.configHistory.deleteMany({
            where: { configId: { in: configIds } },
          });
        }

        // 2. 删除配置项
        await prisma.configItem.deleteMany({
          where: { namespaceId: existingNamespace.id },
        });

        // 3. 删除命名空间
        await prisma.configNamespace.delete({
          where: { id: existingNamespace.id },
        });
      }
    } catch {
      // Ignore cleanup errors
    }

    // 注册测试用户
    const registerResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/register")
      .send(testUser);
    testUserId = (registerResponse.body as ApiResponse<{ id: number }>).data.id;

    // 登录获取 token
    const loginResponse = await request(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({
        email: testUser.email,
        password: testUser.password,
        deviceId: "config-test-device",
      });
    authToken = (loginResponse.body as ApiResponse<LoginResponse>).data
      .accessToken;
  });

  afterAll(async () => {
    // 清理测试数据
    try {
      await prisma.userIdentity.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.deleteMany({
        where: { id: testUserId },
      });
    } catch {
      // Ignore cleanup errors
    }

    if (app) {
      await app.close();
    }
  });

  describe("命名空间管理", () => {
    it("POST /api/v1/config/namespaces - 创建命名空间", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/config/namespaces")
        .set("Authorization", `Bearer ${authToken}`)
        .send(TEST_NAMESPACE)
        .expect(HttpStatus.CREATED);

      expect((response.body as ApiResponse).data).toHaveProperty("id");
      expect((response.body as ApiResponse).data.name).toBe(
        TEST_NAMESPACE.name,
      );
      expect((response.body as ApiResponse).data.displayName).toBe(
        TEST_NAMESPACE.displayName,
      );
    });

    it("GET /api/v1/config/namespaces - 查询命名空间列表", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/config/namespaces")
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect((response.body as ApiResponse).data).toHaveProperty("data");
      expect((response.body as ApiResponse).data).toHaveProperty("meta");
      expect(Array.isArray((response.body as ApiResponse).data.data)).toBe(
        true,
      );
    });

    it("GET /api/v1/config/namespaces/:name - 获取命名空间详情", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/config/namespaces/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect((response.body as ApiResponse).data.name).toBe(
        TEST_NAMESPACE.name,
      );
    });
  });

  describe("配置项 CRUD", () => {
    it("POST /api/v1/config/:namespace - 创建配置项", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/config/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(TEST_CONFIG)
        .expect(HttpStatus.CREATED);

      expect((response.body as ApiResponse).data).toHaveProperty("id");
      expect((response.body as ApiResponse).data.key).toBe(TEST_CONFIG.key);
      expect((response.body as ApiResponse).data.value).toEqual(
        TEST_CONFIG.value,
      );
      expect((response.body as ApiResponse).data.version).toBe(1);
      expect((response.body as ApiResponse).data).toHaveProperty("configHash");
    });

    it("GET /api/v1/config/:namespace/:key - 获取单个配置", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/config/${TEST_NAMESPACE.name}/${TEST_CONFIG.key}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect((response.body as ApiResponse).data.key).toBe(TEST_CONFIG.key);
      expect((response.body as ApiResponse).data.value).toEqual(
        TEST_CONFIG.value,
      );
    });

    it("GET /api/v1/config/:namespace - 获取命名空间所有配置", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/config/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray((response.body as ApiResponse).data)).toBe(true);
      expect((response.body as ApiResponse).data.length).toBeGreaterThan(0);
    });

    it("PUT /api/v1/config/:namespace/:key - 更新配置", async () => {
      const updatedValue = { feature: "disabled", threshold: 200 };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/config/${TEST_NAMESPACE.name}/${TEST_CONFIG.key}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send({ value: updatedValue })
        .expect(HttpStatus.OK);

      expect((response.body as ApiResponse).data.value).toEqual(updatedValue);
      expect((response.body as ApiResponse).data.version).toBe(2);
    });

    it("GET /api/v1/config/:namespace/:key/meta - 获取配置元数据", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/config/${TEST_NAMESPACE.name}/${TEST_CONFIG.key}/meta`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect((response.body as ApiResponse).data).toHaveProperty("key");
      expect((response.body as ApiResponse).data).toHaveProperty("version");
      expect((response.body as ApiResponse).data).toHaveProperty("configHash");
      expect((response.body as ApiResponse).data).not.toHaveProperty("value"); // 元数据不包含值
    });
  });

  describe("加密配置", () => {
    const ENCRYPTED_CONFIG = {
      key: "encrypted_secret",
      value: "my-secret-api-key",
      valueType: "STRING",
      description: "加密的敏感配置",
      isEncrypted: true,
      isEnabled: true,
    };

    // 跳过加密测试如果没有配置加密密钥
    const skipIfNoEncryption = !process.env.CONFIG_ENCRYPTION_KEY;

    (skipIfNoEncryption ? it.skip : it)(
      "POST /api/v1/config/:namespace - 创建加密配置",
      async () => {
        const response = await request(app.getHttpServer())
          .post(`/api/v1/config/${TEST_NAMESPACE.name}`)
          .set("Authorization", `Bearer ${authToken}`)
          .send(ENCRYPTED_CONFIG)
          .expect(HttpStatus.CREATED);

        expect((response.body as ApiResponse).data.isEncrypted).toBe(true);
        // 返回时应该是解密后的值
        expect((response.body as ApiResponse).data.value).toBe(
          ENCRYPTED_CONFIG.value,
        );
      },
    );

    (skipIfNoEncryption ? it.skip : it)(
      "GET /api/v1/config/:namespace/:key - 获取加密配置应返回解密值",
      async () => {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/config/${TEST_NAMESPACE.name}/${ENCRYPTED_CONFIG.key}`)
          .set("Authorization", `Bearer ${authToken}`)
          .expect(HttpStatus.OK);

        expect((response.body as ApiResponse).data.isEncrypted).toBe(true);
        expect((response.body as ApiResponse).data.value).toBe(
          ENCRYPTED_CONFIG.value,
        );
      },
    );
  });

  describe("JSON Schema 校验", () => {
    const CONFIG_WITH_SCHEMA = {
      key: "user_profile",
      value: {
        name: "John",
        age: 30,
        email: "john@example.com",
      },
      valueType: "JSON",
      description: "用户配置（带 Schema 校验）",
      isEncrypted: false,
      isEnabled: true,
      jsonSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number", minimum: 0 },
          email: { type: "string", format: "email" },
        },
        required: ["name", "email"],
      },
    };

    it("POST /api/v1/config/:namespace - 创建带 Schema 的配置应成功", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/config/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(CONFIG_WITH_SCHEMA)
        .expect(HttpStatus.CREATED);

      expect((response.body as ApiResponse).data.jsonSchema).toBeDefined();
    });

    it("POST /api/v1/config/:namespace - 创建不符合 Schema 的配置应失败", async () => {
      const invalidConfig = {
        ...CONFIG_WITH_SCHEMA,
        key: "invalid_user",
        value: {
          name: "Jane",
          age: -5, // 违反 minimum: 0
          email: "not-an-email", // 违反 email 格式
        },
      };

      await request(app.getHttpServer())
        .post(`/api/v1/config/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(invalidConfig)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe("版本历史与回滚", () => {
    it("GET /api/v1/config/:namespace/:key/history - 获取配置历史", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/config/${TEST_NAMESPACE.name}/${TEST_CONFIG.key}/history`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray((response.body as ApiResponse).data)).toBe(true);
      expect((response.body as ApiResponse).data.length).toBeGreaterThanOrEqual(
        2,
      ); // 至少有创建和更新两个版本
      expect((response.body as ApiResponse).data[0]).toHaveProperty("version");
      expect((response.body as ApiResponse).data[0]).toHaveProperty(
        "changeType",
      );
    });

    it("POST /api/v1/config/:namespace/:key/rollback/:version - 回滚配置", async () => {
      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/config/${TEST_NAMESPACE.name}/${TEST_CONFIG.key}/rollback/1`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .send({ changeNote: "E2E 测试回滚" })
        .expect(HttpStatus.CREATED);

      expect((response.body as ApiResponse).data.version).toBe(3); // 回滚创建新版本
      expect((response.body as ApiResponse).data.value).toEqual(
        TEST_CONFIG.value,
      ); // 值应该恢复为版本1的值
    });
  });

  describe("批量操作", () => {
    it("GET /api/v1/config/:namespace/batch?keys=a,b - 批量获取配置", async () => {
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/config/${TEST_NAMESPACE.name}/batch?keys=${TEST_CONFIG.key},user_profile`,
        )
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray((response.body as ApiResponse).data)).toBe(true);
      expect((response.body as ApiResponse).data.length).toBe(2); // 应该返回2个配置
    });

    it("POST /api/v1/config/:namespace/batch - 批量创建/更新配置", async () => {
      const batchData = {
        items: [
          {
            key: "batch_config_1",
            value: { enabled: true },
            valueType: "JSON",
            description: "批量配置1",
            isEncrypted: false,
            isEnabled: true,
          },
          {
            key: "batch_config_2",
            value: { enabled: false },
            valueType: "JSON",
            description: "批量配置2",
            isEncrypted: false,
            isEnabled: true,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/config/${TEST_NAMESPACE.name}/batch`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(batchData)
        .expect(HttpStatus.OK);

      expect((response.body as ApiResponse).data).toHaveProperty("total");
      expect((response.body as ApiResponse).data).toHaveProperty("successful");
      expect((response.body as ApiResponse).data).toHaveProperty("failed");
      expect((response.body as ApiResponse).data).toHaveProperty("results");
      expect((response.body as ApiResponse).data.total).toBe(2);
      expect((response.body as ApiResponse).data.successful).toBe(2);
    });
  });

  describe("错误处理", () => {
    it("GET /api/v1/config/nonexistent/:key - 获取不存在的配置应返回 404", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/config/nonexistent/test_key`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it("POST /api/v1/config/:namespace - 创建重复配置应失败", async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/config/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(TEST_CONFIG)
        .expect(HttpStatus.CONFLICT);
    });

    it("POST /api/v1/config/namespaces - 使用保留字创建命名空间应失败", async () => {
      await request(app.getHttpServer())
        .post("/api/v1/config/namespaces")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          name: "batch", // 保留字
          displayName: "批量",
          isEnabled: true,
        })
        .expect(HttpStatus.BAD_REQUEST);
    });
  });

  describe("清理测试数据", () => {
    it("DELETE /api/v1/config/:namespace/:key - 删除配置项", async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/config/${TEST_NAMESPACE.name}/${TEST_CONFIG.key}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });

    it("DELETE /api/v1/config/namespaces/:name - 删除命名空间", async () => {
      // 先删除所有配置项
      const configsResponse = await request(app.getHttpServer())
        .get(`/api/v1/config/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`);

      for (const config of (
        configsResponse.body as ApiResponse<Array<{ key: string }>>
      ).data) {
        await request(app.getHttpServer())
          .delete(`/api/v1/config/${TEST_NAMESPACE.name}/${config.key}`)
          .set("Authorization", `Bearer ${authToken}`);
      }

      // 删除命名空间
      await request(app.getHttpServer())
        .delete(`/api/v1/config/namespaces/${TEST_NAMESPACE.name}`)
        .set("Authorization", `Bearer ${authToken}`)
        .expect(HttpStatus.NO_CONTENT);
    });
  });
});
