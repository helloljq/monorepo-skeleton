import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * 角色检查装饰器
 * 要求用户拥有任一指定角色
 *
 * @example
 * ```typescript
 * @RequireRoles('ADMIN', 'SUPER_ADMIN')
 * async adminOnly() { ... }
 * ```
 */
export const RequireRoles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
