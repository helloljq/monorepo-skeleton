import { SetMetadata } from "@nestjs/common";

export const SKIP_AUDIT_KEY = "SKIP_AUDIT_KEY";

/**
 * 跳过审计日志记录的装饰器。
 *
 * 使用场景：
 * - 高频低敏感操作（如消息已读状态、用户在线心跳）
 * - 内部健康检查或指标端点
 * - 批量数据同步等性能敏感场景
 *
 * 注意事项：
 * - 默认情况下所有写操作都会被审计，此装饰器是 opt-out 机制
 * - 敏感操作（如用户删除、权限变更、资金操作）禁止使用此装饰器
 * - 使用前需在 PR 中说明跳过审计的理由
 *
 * @example
 * ```typescript
 * @Post('read-status')
 * @SkipAudit() // 消息已读状态变更频繁，无需审计
 * async markAsRead(@Body() dto: MarkAsReadDto) { ... }
 * ```
 */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
