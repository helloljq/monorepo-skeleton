import { randomUUID } from "node:crypto";

import { AuditContext, runWithAuditContext } from "./audit-context";

export interface SystemAuditOptions {
  /**
   * 语义化审计动作名（建议使用 JOB_/SYSTEM_ 前缀）
   */
  actionOverride?: string;

  /**
   * 外部传入的 requestId（若不传则自动生成）
   */
  requestId?: string;
}

/**
 * 非 HTTP 场景的默认审计上下文。
 *
 * 注意：AuditLog.actorUserId 是外键关联 User.id。
 * - 不要使用 actorUserId=0 这类“伪用户”，会触发外键约束失败。
 * - 系统任务/定时任务默认 actorUserId 置空，通过 userAgent/ip 标记来源。
 */
export function runWithSystemAuditContext<T>(
  fn: () => T,
  options?: SystemAuditOptions,
): T {
  const ctx: AuditContext = {
    actorUserId: undefined,
    ip: "system",
    userAgent: "system",
    requestId: options?.requestId ?? randomUUID(),
    actionOverride: options?.actionOverride,
  };
  return runWithAuditContext(ctx, fn);
}
