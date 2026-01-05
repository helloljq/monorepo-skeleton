import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_CLIENT } from "./redis.constants";

@Injectable()
export class RedisShutdownService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy() {
    try {
      await this.redis.quit();
    } catch {
      // ignore
    }
  }
}
