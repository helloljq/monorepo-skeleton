import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import Redis from "ioredis";
import { from, Observable, of, throwError } from "rxjs";
import { catchError, finalize, mergeMap } from "rxjs/operators";

import { AppConfigService } from "../../config/app-config.service";
import { runWithoutAudit } from "../audit/audit-context";
import {
  IDEMPOTENT_KEY,
  IdempotentOptions,
} from "../decorators/idempotent.decorator";
import { BusinessException } from "../errors/business.exception";
import { ApiErrorCode } from "../errors/error-codes";
import { acquireRedisLock, releaseRedisLock } from "../redis/redis-lock";
import { hashSha256 } from "../utils/crypto.util";

type AuthedRequest = Request & { user?: { userId?: unknown } };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly redis: Redis,
    private readonly config: AppConfigService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle() as Observable<unknown>;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const method = String(req.method || "").toUpperCase();

    const options = this.reflector.getAllAndOverride<IdempotentOptions>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // opt-in only
    if (!options) {
      return next.handle() as Observable<unknown>;
    }

    // only protect mutating requests
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next.handle() as Observable<unknown>;
    }

    const rawKey =
      req.header("idempotency-key") ?? req.header("Idempotency-Key");
    const idempotencyKey = typeof rawKey === "string" ? rawKey.trim() : "";
    if (!idempotencyKey) {
      return throwError(
        () =>
          new BusinessException({
            code: ApiErrorCode.IDEMPOTENCY_KEY_MISSING,
            status: HttpStatus.BAD_REQUEST,
            message: "Idempotency-Key is required",
          }),
      );
    }

    // Check authentication requirement
    const requireAuth = options.requireAuth !== false; // default true
    const userIdRaw = req.user?.userId;
    const isAuthenticated = typeof userIdRaw === "number";

    if (requireAuth && !isAuthenticated) {
      this.logger.warn(
        { path: req.path, idempotencyKey },
        "[idempotency] Rejected unauthenticated request to idempotent endpoint",
      );
      return throwError(
        () =>
          new BusinessException({
            code: ApiErrorCode.IDEMPOTENCY_REQUIRES_AUTH,
            status: HttpStatus.UNAUTHORIZED,
            message: "Authentication required for idempotent operations",
          }),
      );
    }

    const userId = isAuthenticated ? String(userIdRaw) : "anon";
    const path = req.path ?? req.url ?? "";
    const signature = `${userId}:${method}:${path}:${idempotencyKey}`;
    const hash = hashSha256(signature);

    const resKey = `idempotency:res:${hash}`;
    const lockKey = `idempotency:lock:${hash}`;

    const ttlSeconds = options.ttlSeconds ?? this.config.idempotencyTtlSeconds;
    const lockTtlMs = options.lockTtlMs ?? 30_000;

    const loadCached = async (): Promise<unknown> => {
      const cached = await this.redis.get(resKey);
      if (!cached) return undefined;
      try {
        return JSON.parse(cached) as unknown;
      } catch {
        return undefined;
      }
    };

    const storeResult = async (result: unknown): Promise<void> => {
      // avoid writing an audit record for internal caching side effect
      await runWithoutAudit(async () => {
        await this.redis.set(resKey, JSON.stringify(result), "EX", ttlSeconds);
      });
    };

    return from(loadCached()).pipe(
      mergeMap((cached) => {
        if (cached !== undefined) {
          this.logger.debug(
            { userId, path, idempotencyKey },
            "[idempotency] Cache hit - returning cached response",
          );
          return of(cached);
        }

        return from(
          acquireRedisLock(this.redis, lockKey, {
            ttlMs: lockTtlMs,
            retries: 0,
          }),
        ).pipe(
          mergeMap((lock) => {
            if (!lock) {
              return from(loadCached()).pipe(
                mergeMap((cached2) => {
                  if (cached2 !== undefined) return of(cached2);
                  return throwError(
                    () =>
                      new BusinessException({
                        code: ApiErrorCode.IDEMPOTENCY_IN_PROGRESS,
                        status: HttpStatus.CONFLICT,
                        message:
                          "Request is being processed, please retry later",
                      }),
                  );
                }),
              );
            }

            // run the request, then store the final response body before returning
            const handled$ = next.handle() as Observable<unknown>;
            return handled$.pipe(
              mergeMap((data) =>
                from(storeResult(data)).pipe(mergeMap(() => of(data))),
              ),
              catchError((err: unknown) => throwError(() => err)),
              finalize(() => {
                void releaseRedisLock(this.redis, lock);
              }),
            );
          }),
        );
      }),
    );
  }
}
