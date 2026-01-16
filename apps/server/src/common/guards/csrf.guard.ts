import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { AppConfigService } from "../../config/app-config.service";
import { IS_PUBLIC_KEY } from "../../modules/auth/decorators/public.decorator";
import { BusinessException } from "../errors/business.exception";
import { ApiErrorCode } from "../errors/error-codes";

type RequestWithCookies = Request & {
  cookies?: Record<string, unknown>;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isBearerAuthHeader(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.toLowerCase().startsWith("bearer ");
}

/**
 * Minimal CSRF protection for cookie-auth requests (ADR-AUTH-001 / Security spec).
 *
 * Strategy (R4.1 same-site): SameSite=Lax/Strict + server-side Origin/Referer validation.
 * - Only enforced for state-changing methods.
 * - Only enforced when using cookie auth (access_token cookie present) AND no Bearer token.
 * - Public routes are skipped.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;

    const req = context.switchToHttp().getRequest<RequestWithCookies>();
    const method = (req.method ?? "GET").toUpperCase();
    if (SAFE_METHODS.has(method)) return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Bearer is explicit and not vulnerable to CSRF (Cookie is implicit).
    if (isBearerAuthHeader(req.headers["authorization"])) return true;

    const cookieAccessToken = req.cookies?.["access_token"];
    // If cookie auth isn't being used, CSRF check isn't applicable.
    if (
      typeof cookieAccessToken !== "string" ||
      cookieAccessToken.length === 0
    ) {
      return true;
    }

    const allowedOrigins = new Set(this.config.corsOrigins);
    const origin = req.headers["origin"];
    const referer = req.headers["referer"];

    // Prefer Origin header (best signal).
    if (typeof origin === "string" && origin.length > 0) {
      if (allowedOrigins.has(origin)) return true;
      throw new BusinessException({
        code: ApiErrorCode.CSRF_FAILED,
        status: HttpStatus.FORBIDDEN,
        message: "CSRF validation failed",
      });
    }

    // Fallback to Referer when Origin is missing.
    if (typeof referer === "string" && referer.length > 0) {
      const ok = Array.from(allowedOrigins).some((allowed) => {
        if (referer === allowed) return true;
        return referer.startsWith(`${allowed}/`);
      });
      if (ok) return true;
      throw new BusinessException({
        code: ApiErrorCode.CSRF_FAILED,
        status: HttpStatus.FORBIDDEN,
        message: "CSRF validation failed",
      });
    }

    // No Origin/Referer: reject cookie-auth write requests by default.
    throw new BusinessException({
      code: ApiErrorCode.CSRF_FAILED,
      status: HttpStatus.FORBIDDEN,
      message: "CSRF validation failed",
    });
  }
}
