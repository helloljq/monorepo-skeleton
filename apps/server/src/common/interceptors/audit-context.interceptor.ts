import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { Observable } from "rxjs";

import { runWithAuditContext } from "../audit/audit-context";
import { SKIP_AUDIT_KEY } from "../decorators/skip-audit.decorator";

type AuthedRequest = Request & {
  user?: { userId?: unknown };
  id?: unknown;
};

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    // 检查 @SkipAudit() 装饰器
    const skipAudit = this.reflector.getAllAndOverride<boolean>(
      SKIP_AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const headers = req?.headers ?? {};

    const forwardedFor = headers["x-forwarded-for"];
    const ip =
      (typeof forwardedFor === "string"
        ? forwardedFor.split(",")[0]?.trim()
        : undefined) ??
      req?.ip ??
      req?.socket?.remoteAddress;

    const userAgent =
      (typeof headers["user-agent"] === "string"
        ? headers["user-agent"]
        : undefined) ?? undefined;

    const requestId =
      (typeof headers["x-request-id"] === "string"
        ? headers["x-request-id"]
        : undefined) ??
      (typeof req?.id === "string" || typeof req?.id === "number"
        ? String(req.id)
        : undefined);

    const actorUserId =
      typeof req?.user?.userId === "number" ? req.user.userId : undefined;

    return runWithAuditContext(
      {
        actorUserId,
        ip,
        userAgent,
        requestId,
        disableAudit: skipAudit === true,
      },
      () => next.handle(),
    );
  }
}
