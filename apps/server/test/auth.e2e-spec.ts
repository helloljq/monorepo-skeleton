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
  code: string;
  message: string;
  data: T;
}

describe("Auth (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: "TestPassword123",
    name: "Test User",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app =
      moduleFixture.createNestApplication() as unknown as INestApplication<App>;
    app.enableShutdownHooks();
    app.setGlobalPrefix("v1");

    const httpAdapter = app.get<HttpAdapterHost>(HttpAdapterHost);
    app.useGlobalFilters(
      new PrismaClientExceptionFilter(),
      new AllExceptionsFilter(httpAdapter),
    );

    const reflector = app.get<Reflector>(Reflector);
    const configService = app.get<AppConfigService>(AppConfigService);
    const redis = app.get<RedisClient>(REDIS_CLIENT);
    app.useGlobalInterceptors(
      new IdempotencyInterceptor(reflector, redis, configService),
      new AuditContextInterceptor(reflector),
      new TransformInterceptor(reflector),
    );

    prisma = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  afterAll(async () => {
    // Cleanup test user
    try {
      await prisma.user.deleteMany({
        where: { email: testUser.email },
      });
    } catch {
      // Ignore cleanup errors
    }

    if (app) {
      await app.close();
    }
  });

  describe("POST /v1/auth/register", () => {
    it("should register a new user successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/register")
        .send(testUser)
        .expect(201);

      const body = response.body as ApiResponse<{
        id: number;
        email: string;
        name: string;
      }>;
      expect(body.code).toBe("SUCCESS");
      expect(body.data.email).toBe(testUser.email);
      expect(body.data.name).toBe(testUser.name);
    });

    it("should return 409 for duplicate email", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/register")
        .send(testUser)
        .expect(409);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("AUTH_EMAIL_EXISTS");
    });

    it("should return 400 for invalid email format", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/register")
        .send({
          email: "invalid-email",
          password: "TestPassword123",
        })
        .expect(400);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for weak password", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/register")
        .send({
          email: "weak@example.com",
          password: "weak", // Too short, no uppercase, no digit
        })
        .expect(400);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /v1/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
          deviceId: "test-device-1",
        })
        .expect(200);

      const body = response.body as ApiResponse<{
        accessToken: string;
        refreshToken: string;
        accessExpiresInSeconds: number;
      }>;
      expect(body.code).toBe("SUCCESS");
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
      expect(body.data.accessExpiresInSeconds).toBeGreaterThan(0);
    });

    it("should return 401 for invalid email", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: "nonexistent@example.com",
          password: "TestPassword123",
          deviceId: "test-device-1",
        })
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("AUTH_INVALID_CREDENTIALS");
    });

    it("should return 401 for wrong password", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: testUser.email,
          password: "WrongPassword123",
          deviceId: "test-device-1",
        })
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("AUTH_INVALID_CREDENTIALS");
    });

    it("should return 400 for missing deviceId", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(400);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /v1/auth/refresh", () => {
    let validRefreshToken: string;

    beforeAll(async () => {
      // Login to get a valid refresh token
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
          deviceId: "refresh-test-device",
        });

      validRefreshToken = (
        response.body as ApiResponse<{ refreshToken: string }>
      ).data.refreshToken;
    });

    it("should refresh tokens successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({
          refreshToken: validRefreshToken,
          deviceId: "refresh-test-device",
        })
        .expect(200);

      const body = response.body as ApiResponse<{
        accessToken: string;
        refreshToken: string;
      }>;
      expect(body.code).toBe("SUCCESS");
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.refreshToken).toBeDefined();
    });

    it("should return 401 for invalid refresh token", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({
          refreshToken: "invalid-token",
          deviceId: "test-device-1",
        })
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("AUTH_REFRESH_TOKEN_INVALID");
    });

    it("should return 401 for wrong deviceId", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/refresh")
        .send({
          refreshToken: validRefreshToken,
          deviceId: "wrong-device-id",
        })
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("AUTH_REFRESH_TOKEN_INVALID");
    });
  });

  describe("POST /v1/auth/logout", () => {
    let accessToken: string;

    beforeAll(async () => {
      // Login to get access token
      const response = await request(app.getHttpServer())
        .post("/v1/auth/login")
        .send({
          email: testUser.email,
          password: testUser.password,
          deviceId: "logout-test-device",
        });

      accessToken = (response.body as ApiResponse<{ accessToken: string }>).data
        .accessToken;
    });

    it("should logout successfully", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/logout")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          deviceId: "logout-test-device",
        })
        .expect(200);

      const body = response.body as ApiResponse<{ message: string }>;
      expect(body.code).toBe("SUCCESS");
      expect(body.data.message).toBe("Logged out successfully");
    });

    it("should return 401 without auth token", async () => {
      const response = await request(app.getHttpServer())
        .post("/v1/auth/logout")
        .send({
          deviceId: "test-device-1",
        })
        .expect(401);

      const body = response.body as ApiResponse;
      expect(body.code).toBe("UNAUTHORIZED");
    });
  });
});
