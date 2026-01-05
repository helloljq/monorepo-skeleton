import { SetMetadata } from "@nestjs/common";

export const MAX_LIMIT_KEY = "MAX_LIMIT_KEY";

/**
 * 默认分页 limit 上限
 */
export const DEFAULT_MAX_LIMIT = 100;

/**
 * 覆盖分页接口的默认 limit 上限
 *
 * 使用场景：
 * - 配置项、字典等数据量有限的接口
 * - 必须在代码注释中说明原因（如"配置项总量不超过 200 条"）
 * - 禁止用于常规业务数据导出
 *
 * @param maxLimit - 允许的最大 limit 值
 *
 * @example
 * ```typescript
 * // 配置项总量不超过 500 条
 * @Get('configs')
 * @MaxLimit(500)
 * async getAllConfigs(@Query() query: QueryConfigItemDto) { ... }
 * ```
 */
export const MaxLimit = (maxLimit: number) =>
  SetMetadata(MAX_LIMIT_KEY, maxLimit);
