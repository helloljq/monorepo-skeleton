import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { RAW_RESPONSE_KEY } from "../decorators/raw-response.decorator";
import { SUCCESS_CODE } from "../errors/error-codes";

export interface Response<T> {
  code: string;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T> | T
> {
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | T> {
    // Keep Prometheus metrics endpoint raw (must be text/plain, not JSON-wrapped)
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url;
    if (typeof path === "string" && path.startsWith("/metrics")) {
      return next.handle() as Observable<T>;
    }

    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isRaw) {
      return next.handle() as Observable<T>;
    }

    const handled$ = next.handle() as Observable<T>;
    return handled$.pipe(
      map((data: T) => {
        // Handle BigInt serialization here recursively
        const transformedData = this.transformBigInt(data);

        return {
          code: SUCCESS_CODE,
          message: "ok",
          data: transformedData as T,
        };
      }),
    );
  }

  private transformBigInt(data: unknown): unknown {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "bigint") {
      return data.toString();
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.transformBigInt(item));
    }

    if (typeof data === "object") {
      // Check if it's a plain object or Date, etc.
      // Date should be preserved.
      if (data instanceof Date) return data;

      const record = data as Record<string, unknown>;
      const newData: Record<string, unknown> = {};
      for (const key of Object.keys(record)) {
        newData[key] = this.transformBigInt(record[key]);
      }
      return newData as unknown;
    }

    return data;
  }
}
