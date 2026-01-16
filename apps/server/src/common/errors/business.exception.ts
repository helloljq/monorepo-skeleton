import { HttpException, HttpStatus } from "@nestjs/common";

import type { ApiErrorCode } from "./error-codes";

export interface BusinessExceptionOptions {
  /**
   * 业务错误码（与 HTTP Status 解耦）
   */
  code: ApiErrorCode;

  /**
   * 对外可读的错误信息（生产环境也会透出）
   */
  message: string;

  /**
   * HTTP Status（保持语义正确）
   */
  status?: HttpStatus;

  /**
   * 可选：业务错误携带的上下文数据（谨慎使用，禁止包含敏感信息）
   */
  data?: unknown;
}

export class BusinessException extends HttpException {
  readonly code: ApiErrorCode;
  readonly data?: unknown;

  constructor(options: BusinessExceptionOptions) {
    const status = options.status ?? HttpStatus.BAD_REQUEST;
    super(
      {
        code: options.code,
        message: options.message,
        data: options.data ?? null,
      },
      status,
    );
    this.code = options.code;
    this.data = options.data;
  }
}
