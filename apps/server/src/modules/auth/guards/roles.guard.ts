import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { BusinessException } from "../../../common/errors/business.exception";
import { ApiErrorCode } from "../../../common/errors/error-codes";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { RequestUser } from "../dto/jwt-payload.schema";

/**
 * 超级管理员角色代码
 * 拥有此角色的用户跳过所有权限检查
 */
export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查是否为公开路由
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取路由要求的角色
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 没有角色要求，放行
    if (!requiredRoles?.length) {
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

    // 检查是否拥有任一要求的角色
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new BusinessException({
        code: ApiErrorCode.FORBIDDEN,
        message: "Forbidden",
        status: HttpStatus.FORBIDDEN,
      });
    }

    return true;
  }
}
