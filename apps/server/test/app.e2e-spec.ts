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

type RedisClient = import("ioredis").default;

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app =
      moduleFixture.createNestApplication() as unknown as INestApplication<App>;
    app.enableShutdownHooks();

    // keep test config aligned with src/main.ts
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

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("/v1 (GET)", () => {
    return request(app.getHttpServer())
      .get("/v1")
      .expect(200)
      .expect((res) => {
        // TransformInterceptor wraps it
        const body = res.body as {
          code: string;
          message: string;
          data: string;
        };
        if (body.code !== "SUCCESS") throw new Error("unexpected code");
        if (body.message !== "ok") throw new Error("unexpected message");
        if (body.data !== "Hello World!") throw new Error("unexpected data");
      });
  });
});
