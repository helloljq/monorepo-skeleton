import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";
export const ANY_PERMISSION_KEY = "anyPermission";

/**
 * 权限检查装饰器
 * 要求用户拥有所有指定权限
 *
 * @example
 * ```typescript
 * @RequirePermissions('user:read', 'user:update')
 * async updateUser() { ... }
 * ```
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * 权限检查装饰器 (任一)
 * 要求用户拥有任一指定权限
 *
 * @example
 * ```typescript
 * @RequireAnyPermission('user:delete', 'user:delete:self')
 * async deleteUser() { ... }
 * ```
 */
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSION_KEY, permissions);
