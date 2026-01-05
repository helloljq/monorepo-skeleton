import { Global, Module, Provider } from "@nestjs/common";
import Redis from "ioredis";

import { AppConfigService } from "../../config/app-config.service";
import { REDIS_CLIENT } from "./redis.constants";
import { RedisShutdownService } from "./redis-shutdown.service";

export { REDIS_CLIENT } from "./redis.constants";

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (config: AppConfigService) => {
    return new Redis(config.redisUrl);
  },
  inject: [AppConfigService],
};

@Global()
@Module({
  providers: [redisProvider, RedisShutdownService],
  exports: [redisProvider],
})
export class RedisModule {}
