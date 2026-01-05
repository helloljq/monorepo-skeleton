import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { RedisModule } from "../../common/redis/redis.module";
import { AppConfigModule } from "../../config/app-config.module";
import { DatabaseModule } from "../../database/database.module";
import { ConfigItemController } from "./controllers/config-item.controller";
// Controllers
import { NamespaceController } from "./controllers/namespace.controller";
// Gateways
import { ConfigCenterGateway } from "./gateways/config-center.gateway";
// Services
import { ConfigCacheService } from "./services/config-cache.service";
import { ConfigEncryptionService } from "./services/config-encryption.service";
import { ConfigItemService } from "./services/config-item.service";
import { ConfigSchemaValidatorService } from "./services/config-schema-validator.service";
import { NamespaceService } from "./services/namespace.service";

/**
 * 配置中心模块
 *
 * 提供配置命名空间和配置项的管理功能
 * - 命名空间管理：隔离不同业务域的配置
 * - 配置项管理：支持加密、版本控制、JSON Schema 校验
 * - 版本历史：记录变更历史，支持回滚
 * - 缓存策略：Redis 缓存 + 分布式锁防击穿
 * - WebSocket 推送：配置变更实时通知
 */
@Module({
  imports: [DatabaseModule, AppConfigModule, RedisModule, JwtModule],
  controllers: [NamespaceController, ConfigItemController],
  providers: [
    // Core services
    ConfigEncryptionService,
    ConfigSchemaValidatorService,
    ConfigCacheService,
    NamespaceService,
    ConfigItemService,
    // Gateways
    ConfigCenterGateway,
  ],
  exports: [
    ConfigEncryptionService,
    ConfigSchemaValidatorService,
    ConfigCacheService,
    NamespaceService,
    ConfigItemService,
    ConfigCenterGateway,
  ],
})
export class ConfigCenterModule {}
