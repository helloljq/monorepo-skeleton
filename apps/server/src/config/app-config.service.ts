import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { JwtSignOptions } from "@nestjs/jwt";

import { Env } from "./env.schema";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  get appEnv(): Env["APP_ENV"] {
    return this.configService.get("APP_ENV");
  }

  /** staging/prod 视为生产态（关闭 pretty log、Cookie Secure 等） */
  get isProduction(): boolean {
    return this.appEnv !== "dev";
  }

  get isProd(): boolean {
    return this.appEnv === "prod";
  }

  get port(): number {
    return this.configService.get("PORT");
  }

  get bodyLimit(): string {
    return this.configService.get("BODY_LIMIT");
  }

  get databaseUrl(): string {
    return this.configService.get("DATABASE_URL");
  }

  get redisUrl(): string {
    return this.configService.get("REDIS_URL");
  }

  get auth(): {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: Exclude<JwtSignOptions["expiresIn"], undefined>;
    refreshTtl: Exclude<JwtSignOptions["expiresIn"], undefined>;
  } {
    return {
      accessSecret: this.configService.get("JWT_ACCESS_SECRET"),
      refreshSecret: this.configService.get("JWT_REFRESH_SECRET"),
      accessTtl: this.configService.get("JWT_ACCESS_TTL"),
      refreshTtl: this.configService.get("JWT_REFRESH_TTL"),
    };
  }

  get idempotencyTtlSeconds(): number {
    return this.configService.get("IDEMPOTENCY_TTL_SECONDS");
  }

  get prismaSlowQueryMs(): number {
    return this.configService.get("PRISMA_SLOW_QUERY_MS");
  }

  get corsOrigins(): string[] {
    const origins: string = this.configService.get("CORS_ORIGINS");
    return origins.split(",").map((o) => o.trim());
  }

  get rateLimit(): {
    ttlMs: number;
    max: number;
  } {
    return {
      ttlMs: this.configService.get("RATE_LIMIT_TTL_MS"),
      max: this.configService.get("RATE_LIMIT_MAX"),
    };
  }

  get wechat(): {
    openAppId: string | undefined;
    openAppSecret: string | undefined;
    mpAppId: string | undefined;
    mpAppSecret: string | undefined;
    miniAppId: string | undefined;
    miniAppSecret: string | undefined;
    stateSecret: string | undefined;
    openEnabled: boolean;
    mpEnabled: boolean;
    miniEnabled: boolean;
  } {
    const openAppId: string | undefined =
      this.configService.get("WECHAT_OPEN_APP_ID");
    const openAppSecret: string | undefined = this.configService.get(
      "WECHAT_OPEN_APP_SECRET",
    );
    const mpAppId: string | undefined =
      this.configService.get("WECHAT_MP_APP_ID");
    const mpAppSecret: string | undefined = this.configService.get(
      "WECHAT_MP_APP_SECRET",
    );
    const miniAppId: string | undefined =
      this.configService.get("WECHAT_MINI_APP_ID");
    const miniAppSecret: string | undefined = this.configService.get(
      "WECHAT_MINI_APP_SECRET",
    );

    return {
      openAppId,
      openAppSecret,
      mpAppId,
      mpAppSecret,
      miniAppId,
      miniAppSecret,
      stateSecret: this.configService.get("WECHAT_STATE_SECRET"),
      openEnabled: !!(openAppId && openAppSecret),
      mpEnabled: !!(mpAppId && mpAppSecret),
      miniEnabled: !!(miniAppId && miniAppSecret),
    };
  }

  get permissionCacheTtl(): number {
    return this.configService.get("PERMISSION_CACHE_TTL");
  }

  get configEncryptionKey(): string | undefined {
    return this.configService.get("CONFIG_ENCRYPTION_KEY");
  }

  get configCacheTtlSeconds(): number {
    return this.configService.get("CONFIG_CACHE_TTL_SECONDS");
  }

  get scriptUploadToken(): string | undefined {
    return this.configService.get("SCRIPT_UPLOAD_TOKEN");
  }
}
