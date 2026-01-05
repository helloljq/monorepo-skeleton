import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import {
  ANY_PERMISSION_KEY,
  PERMISSIONS_KEY,
} from "../decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { RequestUser } from "../dto/jwt-payload.schema";
import { PermissionCacheService } from "../services/permission-cache.service";
import { SUPER_ADMIN_ROLE } from "./roles.guard";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取路由要求的权限
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有权限要求，放行
    if (!requiredPermissions?.length && !anyPermissions?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as RequestUser | undefined;

    // 未登录
    if (!user?.roles) {
      throw new BusinessException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: "Unauthorized",
        status: HttpStatus.UNAUTHORIZED,
      });
    }

    // 超级管理员跳过检查
    if (user.roles.includes(SUPER_ADMIN_ROLE)) {
      return true;
    }

    // 获取用户权限 (基于角色缓存)
    const userPermissions = await this.permissionCache.getUserPermissions(
      user.roles,
    );

    // 缓存到请求上下文，避免后续重复查询
    user.permissions = userPermissions;

    // 检查是否拥有所有必需权限 (@RequirePermissions)
    if (requiredPermissions?.length) {
      const hasAll = requiredPermissions.every((p) =>
        userPermissions.includes(p),
      );
      if (!hasAll) {
        throw new BusinessException({
          code: ApiErrorCode.FORBIDDEN,
          message: "Forbidden",
          status: HttpStatus.FORBIDDEN,
        });
      }
    }

    // 检查是否拥有任一必需权限 (@RequireAnyPermission)
    if (anyPermissions?.length) {
      const hasAny = anyPermissions.some((p) => userPermissions.includes(p));
      if (!hasAny) {
        throw new BusinessException({
          code: ApiErrorCode.FORBIDDEN,
          message: "Forbidden",
          status: HttpStatus.FORBIDDEN,
        });
      }
    }

    return true;
  }
}
