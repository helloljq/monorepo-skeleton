import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrometheusModule } from "@willsoto/nestjs-prometheus";
import { LoggerModule } from "nestjs-pino";
import { ZodValidationPipe } from "nestjs-zod";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
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

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        return {
          pinoHttp: {
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
      // 本地开发使用 .env (Prisma CLI 要求)，其他环境使用 .env.{环境名}
      envFilePath:
        process.env.NODE_ENV === "production"
          ? ".env.production"
          : process.env.NODE_ENV === "staging"
            ? ".env.staging"
            : ".env",
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
