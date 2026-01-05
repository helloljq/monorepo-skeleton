import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../common/redis/redis.module";
import { PrismaService } from "../../database/prisma/prisma.service";
import { Public } from "../auth/decorators/public.decorator";

@ApiTags("Health")
@Controller("health")
@SkipThrottle() // Health checks should not be rate limited
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  /**
   * Generic health check wrapper that handles success/failure pattern
   * @param name - The indicator name (e.g., 'database', 'redis')
   * @param checkFn - Async function that throws on failure
   */
  private async checkIndicator(
    name: string,
    checkFn: () => Promise<void>,
  ): Promise<HealthIndicatorResult> {
    try {
      await checkFn();
      return { [name]: { status: "up" } };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "unknown";
      throw new HealthCheckError(`${name} down`, {
        [name]: { status: "down", message },
      });
    }
  }

  @Get()
  @Public()
  @ApiOperation({ summary: "健康检查（数据库 + Redis）" })
  @ApiOkResponse({ description: "OK" })
  @HealthCheck()
  check() {
    return this.health.check([
      () =>
        this.checkIndicator("database", async () => {
          await this.prisma.$queryRaw`SELECT 1`;
        }),
      () =>
        this.checkIndicator("redis", async () => {
          const pong = await this.redis.ping();
          if (pong !== "PONG") throw new Error("Redis ping failed");
        }),
    ]);
  }
}
