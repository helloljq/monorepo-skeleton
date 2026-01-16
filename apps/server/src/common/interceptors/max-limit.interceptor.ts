import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { Observable } from "rxjs";

import {
  DEFAULT_MAX_LIMIT,
  MAX_LIMIT_KEY,
} from "../decorators/max-limit.decorator";

/**
 * 验证分页 limit 参数的拦截器
 *
 * 工作原理：
 * 1. 从 @MaxLimit() 装饰器读取自定义上限，若无则使用默认值 100
 * 2. 检查请求中的 limit 参数是否超出上限
 * 3. 超出则返回 400 错误
 *
 * 注意：此拦截器应在 Zod 验证之后执行，用于执行更严格的业务限制
 */
@Injectable()
export class MaxLimitInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const maxLimit = this.reflector.getAllAndOverride<number>(MAX_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 使用装饰器指定的值，或默认值
    const effectiveMaxLimit = maxLimit ?? DEFAULT_MAX_LIMIT;

    const request = context.switchToHttp().getRequest<Request>();
    const limit = this.extractLimit(request);

    if (limit !== undefined && limit > effectiveMaxLimit) {
      throw new BadRequestException(
        `每页数量不能超过 ${effectiveMaxLimit}，当前值: ${limit}`,
      );
    }

    return next.handle();
  }

  private extractLimit(request: Request): number | undefined {
    // 优先从 query 获取（GET 请求）
    const queryPageSize = request.query?.pageSize;
    if (queryPageSize !== undefined) {
      const parsed = Number(queryPageSize);
      return isNaN(parsed) ? undefined : parsed;
    }
    const queryLimit = request.query?.limit;
    if (queryLimit !== undefined) {
      const parsed = Number(queryLimit);
      return isNaN(parsed) ? undefined : parsed;
    }

    // 从 body 获取（POST/PATCH 请求）
    const bodyPageSize = request.body?.pageSize;
    if (bodyPageSize !== undefined) {
      const parsed = Number(bodyPageSize);
      return isNaN(parsed) ? undefined : parsed;
    }
    const bodyLimit = request.body?.limit;
    if (bodyLimit !== undefined) {
      const parsed = Number(bodyLimit);
      return isNaN(parsed) ? undefined : parsed;
    }

    return undefined;
  }
}
