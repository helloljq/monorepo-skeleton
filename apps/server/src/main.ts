import { RequestMethod } from "@nestjs/common";
import { HttpAdapterHost, NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { json, urlencoded } from "express";
import helmet from "helmet";
import type Redis from "ioredis";

import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./common/adapters/redis-io.adapter";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { PrismaClientExceptionFilter } from "./common/filters/prisma-client-exception.filter";
import { AuditContextInterceptor } from "./common/interceptors/audit-context.interceptor";
import { IdempotencyInterceptor } from "./common/interceptors/idempotency.interceptor";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { REDIS_CLIENT } from "./common/redis/redis.module";
import { AppConfigService } from "./config/app-config.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Enable shutdown hooks
  app.enableShutdownHooks();

  // Get config service early for CORS and other settings
  const configService = app.get(AppConfigService);

  // Security headers (helmet)
  app.use(
    helmet({
      contentSecurityPolicy: configService.isProduction ? undefined : false, // Disable CSP in development for Swagger UI
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger
    }),
  );

  // CORS configuration with whitelist
  app.enableCors({
    origin: configService.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Idempotency-Key",
      "X-Request-ID",
      "X-Trace-Id",
      "X-CSRF-Token",
    ],
    maxAge: 3600,
  });

  // API versioning: keep /health and /metrics without prefix for probes/scraping
  app.setGlobalPrefix("v1", {
    exclude: [
      { path: "health", method: RequestMethod.ALL },
      { path: "metrics", method: RequestMethod.ALL },
      // keep swagger out of the version prefix
      { path: "api", method: RequestMethod.ALL },
      { path: "api-json", method: RequestMethod.ALL },
    ],
  });

  const httpAdapter = app.get(HttpAdapterHost);

  // Register Global Filters
  app.useGlobalFilters(
    new PrismaClientExceptionFilter(),
    new AllExceptionsFilter(httpAdapter),
  );

  // Body parser limits
  app.use(json({ limit: configService.bodyLimit }));
  app.use(urlencoded({ extended: true, limit: configService.bodyLimit }));

  // Cookie parser
  app.use(cookieParser());

  const reflector = app.get(Reflector);
  const redis = app.get<Redis>(REDIS_CLIENT);
  app.useGlobalInterceptors(
    new IdempotencyInterceptor(reflector, redis, configService),
    new AuditContextInterceptor(reflector),
    new TransformInterceptor(reflector),
  );

  // WebSocket adapter with Redis
  const redisIoAdapter = new RedisIoAdapter(app, configService);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Register shutdown handler for Redis adapter cleanup
  process.on("beforeExit", () => {
    void redisIoAdapter.close();
  });

  // Swagger
  const config = new DocumentBuilder()
    .setTitle("I 54KB API")
    .setDescription(
      "NestJS 企业级后端服务 API，基于 Prisma + PostgreSQL + Redis + Socket.io，提供用户认证、审计日志、幂等性控制等核心能力",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  await app.listen(configService.port);
}
void bootstrap();
