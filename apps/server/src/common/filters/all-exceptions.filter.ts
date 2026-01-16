import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import type { Response } from "express";

import { BusinessException } from "../errors/business.exception";
import {
  ApiErrorCode,
  type ApiErrorCode as ApiErrorCodeType,
} from "../errors/error-codes";

interface ResponseBody {
  code: ApiErrorCodeType;
  message: string;
  data: unknown;
}

function defaultCodeFromHttpStatus(status: HttpStatus): ApiErrorCodeType {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ApiErrorCode.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ApiErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ApiErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ApiErrorCode.NOT_FOUND;
    case HttpStatus.CONFLICT:
      return ApiErrorCode.CONFLICT;
    case HttpStatus.TOO_MANY_REQUESTS:
      return ApiErrorCode.TOO_MANY_REQUESTS;
    default:
      return ApiErrorCode.INTERNAL_ERROR;
  }
}

/**
 * 提取验证错误的详细信息
 * 自定义 Zod 验证管道返回的格式：{ message: string, errors: Array<{field, message, code}> }
 */
interface ValidationErrorDetails {
  field: string;
  message: string;
}

function extractValidationErrors(
  exception: HttpException,
): ValidationErrorDetails[] | null {
  const resp: unknown = exception.getResponse();
  if (!resp || typeof resp !== "object") return null;

  // 检查是否包含 errors 数组（自定义 Zod 验证管道的格式）
  const maybeErrors: unknown = (resp as { errors?: unknown }).errors;
  if (Array.isArray(maybeErrors) && maybeErrors.length > 0) {
    const normalized = maybeErrors
      .map((e: unknown): ValidationErrorDetails | null => {
        if (!e || typeof e !== "object") return null;
        const record = e as Record<string, unknown>;
        const message =
          typeof record.message === "string" ? record.message : "Invalid value";
        const field =
          typeof record.field === "string"
            ? record.field
            : Array.isArray(record.path) && typeof record.path[0] === "string"
              ? record.path[0]
              : "unknown";
        return { field, message };
      })
      .filter((e): e is ValidationErrorDetails => e !== null);
    return normalized.length > 0 ? normalized : null;
  }

  // 兼容旧格式：message 数组
  const maybeMessage: unknown = (resp as { message?: unknown }).message;
  if (Array.isArray(maybeMessage)) {
    return maybeMessage.map((msg) => ({
      field: "unknown",
      message: String(msg),
    }));
  }

  return null;
}

function extractHttpExceptionMessage(exception: HttpException): string {
  const resp: unknown = exception.getResponse();
  if (typeof resp === "string") return resp;
  if (resp && typeof resp === "object") {
    const maybeMessage: unknown = (resp as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;
    if (Array.isArray(maybeMessage)) {
      return maybeMessage.map((x) => String(x)).join("; ");
    }
  }
  return exception.message || "Error";
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain edge cases, httpAdapterHost may not be available.
    // However, for standard HTTP apps, it works.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const httpStatus: HttpStatus =
      exception instanceof HttpException
        ? (exception.getStatus() as HttpStatus)
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let code: ApiErrorCodeType = defaultCodeFromHttpStatus(httpStatus);
    let message = "Internal Server Error";
    let data: unknown = null;

    if (exception instanceof BusinessException) {
      code = exception.code;
      message = extractHttpExceptionMessage(exception);
      const resp: unknown = exception.getResponse();
      if (resp && typeof resp === "object") {
        data = (resp as { data?: unknown }).data ?? null;
      }
    } else if (exception instanceof HttpException) {
      message = extractHttpExceptionMessage(exception);

      // 特殊处理验证错误：提取详细的字段错误信息
      if (httpStatus === HttpStatus.BAD_REQUEST) {
        const validationErrors = extractValidationErrors(exception);
        if (validationErrors && validationErrors.length > 0) {
          code = ApiErrorCode.VALIDATION_ERROR;
          data = {
            errors: validationErrors.map((e) => ({
              field: e.field,
              message: e.message,
            })),
          };
          message = "参数校验失败";
        }
      }
    }

    // Log non-http exceptions for debugging
    if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
      const errorToLog =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error({ err: errorToLog }, "Unknown Exception");
    }

    const responseBody: ResponseBody = {
      code,
      message: message || "Error",
      data,
    };

    httpAdapter.reply(response, responseBody, httpStatus);
  }
}
