import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { CsrfGuard } from "./common/guards/csrf.guard";
import { CustomThrottlerGuard } from "./common/guards/custom-throttler.guard";
import { MaxLimitInterceptor } from "./common/interceptors/max-limit.interceptor";
import { RedisModule } from "./common/redis/redis.module";
import { AppConfigModule } from "./config/app-config.module";
import { AppConfigService } from "./config/app-config.service";
import { envSchema } from "./config/env.schema";
import { DatabaseModule } from "./database/database.module";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "./modules/auth/guards/permissions.guard";
import { ConfigCenterModule } from "./modules/config-center/config-center.module";
import { DictionaryModule } from "./modules/dictionary/dictionary.module";
import { HealthModule } from "./modules/health/health.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { PermissionModule } from "./modules/permission/permission.module";
import { RoleModule } from "./modules/role/role.module";
import { UserModule } from "./modules/user/user.module";
import { WsModule } from "./modules/ws/ws.module";

function isUuidV4(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        return {
          pinoHttp: {
            // Log format (Observability spec): timestamp/level/message/traceId/service
            messageKey: "message",
            formatters: {
              level: (label: string) => ({ level: label }),
            },
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
            base: {
              service: "server",
              environment: config.appEnv,
            },
            genReqId: (
              req: IncomingMessage,
              res: ServerResponse<IncomingMessage>,
            ) => {
              const incoming = req.headers["x-trace-id"];
              const traceId =
                typeof incoming === "string" && isUuidV4(incoming)
                  ? incoming
                  : randomUUID();
              res.setHeader("X-Trace-Id", traceId);
              return traceId;
            },
            customProps: (req: IncomingMessage) => {
              const id = (req as { id?: unknown }).id;
              return { traceId: typeof id === "string" ? id : undefined };
            },
            level: config.isProduction ? "info" : "debug",
            transport: config.isProduction
              ? undefined
              : {
                  target: "pino-pretty",
                  options: {
                    singleLine: true,
                  },
                },
          },
        };
      },
    }),
    PrometheusModule.register(),
    ConfigModule.forRoot({
      // env 文件仅用于本地开发（.env 不提交）；线上环境通过平台/容器注入 process.env
      envFilePath: ".env",
      validate: (config) => envSchema.parse(config),
      isGlobal: true,
    }),
    AppConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: "default",
            ttl: config.rateLimit.ttlMs,
            limit: config.rateLimit.max,
          },
        ],
      }),
    }),
    DatabaseModule,
    HealthModule,
    RedisModule, // Global
    AuthModule,
    IdentityModule,
    RoleModule,
    PermissionModule,
    UserModule,
    DictionaryModule,
    ConfigCenterModule,
    WsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtAuthGuard,
    PermissionsGuard,
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useExisting: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MaxLimitInterceptor,
    },
  ],
})
export class AppModule {}
