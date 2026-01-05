import { AsyncLocalStorage } from "node:async_hooks";

export interface AuditContext {
  actorUserId?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;

  /**
   * Optional action override for semantic operations (e.g. USER_SOFT_DELETE).
   * If not provided, Prisma action name will be used.
   */
  actionOverride?: string;

  /**
   * Internal flag to prevent audit recursion for reads/audit writes performed by audit middleware itself.
   */
  disableAudit?: boolean;
}

const auditAls = new AsyncLocalStorage<AuditContext>();

export function getAuditContext(): AuditContext | undefined {
  return auditAls.getStore();
}

export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return auditAls.run(ctx, fn);
}

export function runWithoutAudit<T>(fn: () => T): T {
  const current = getAuditContext();
  const next: AuditContext = { ...(current ?? {}), disableAudit: true };
  return runWithAuditContext(next, fn);
}
