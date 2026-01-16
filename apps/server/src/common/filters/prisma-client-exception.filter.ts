import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { Response } from "express";

import {
  ApiErrorCode,
  type ApiErrorCode as ApiErrorCodeType,
} from "../errors/error-codes";

@Catch(PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);
  catch(exception: PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let clientMessage = "Internal Database Error";
    let code: ApiErrorCodeType = ApiErrorCode.DATABASE_ERROR;

    // 安全地获取 meta 对象
    const meta: Record<string, unknown> | undefined = exception.meta;
    const errorCode: string = exception.code;

    switch (errorCode) {
      // P2000: Value too long for column
      case "P2000": {
        status = HttpStatus.BAD_REQUEST;
        const column = this.extractMetaField(meta?.column_name, "field");
        clientMessage = `Value too long for ${column}`;
        code = ApiErrorCode.VALIDATION_ERROR;
        break;
      }

      // P2002: Unique constraint violation
      case "P2002": {
        status = HttpStatus.CONFLICT;
        const target: unknown = meta?.target;
        const targetText = Array.isArray(target)
          ? target.map((x) => String(x)).join(", ")
          : typeof target === "string"
            ? target
            : target && typeof target === "object"
              ? JSON.stringify(target)
              : "fields";
        clientMessage = `Unique constraint failed on the ${targetText}`;
        code = ApiErrorCode.CONFLICT;
        break;
      }

      // P2003: Foreign key constraint failed
      case "P2003": {
        status = HttpStatus.BAD_REQUEST;
        const field = this.extractMetaField(meta?.field_name, "relation");
        clientMessage = `Foreign key constraint failed on ${field}`;
        code = ApiErrorCode.DB_FOREIGN_KEY_VIOLATION;
        break;
      }

      // P2006: Invalid value provided
      case "P2006": {
        status = HttpStatus.BAD_REQUEST;
        clientMessage = "Invalid value provided for field";
        code = ApiErrorCode.DB_INVALID_VALUE;
        break;
      }

      // P2014: Relation constraint violation
      case "P2014": {
        status = HttpStatus.BAD_REQUEST;
        const relation = this.extractMetaField(meta?.relation_name, "relation");
        clientMessage = `Required relation ${relation} would be violated`;
        code = ApiErrorCode.DB_RELATION_VIOLATION;
        break;
      }

      // P2019: Input error
      case "P2019": {
        status = HttpStatus.BAD_REQUEST;
        clientMessage = "Invalid input data";
        code = ApiErrorCode.DB_INPUT_ERROR;
        break;
      }

      // P2020: Value out of range
      case "P2020": {
        status = HttpStatus.BAD_REQUEST;
        clientMessage = "Value out of range for the type";
        code = ApiErrorCode.DB_VALUE_OUT_OF_RANGE;
        break;
      }

      // P2025: Record not found
      case "P2025": {
        status = HttpStatus.NOT_FOUND;
        clientMessage = "Record not found";
        code = ApiErrorCode.NOT_FOUND;
        break;
      }

      default:
        // Log unknown prisma errors for investigation
        this.logger.error({ code: errorCode, meta }, "Unhandled Prisma error");
        break;
    }

    response.status(status).json({
      code,
      message: clientMessage,
      data: null,
    });
  }

  /**
   * Safely extract a meta field value as string
   */
  private extractMetaField(value: unknown, fallback: string): string {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return fallback;
  }
}
