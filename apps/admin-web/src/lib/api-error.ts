/**
 * API 错误响应的类型定义
 */

/** 单个验证错误 */
export interface ValidationError {
  field: string;
  message: string;
}

/** API 错误响应体 */
export interface ApiErrorResponse {
  code: string;
  message: string;
  data?: {
    errors?: ValidationError[];
  };
}

/** 自定义 API 错误类，携带完整的后端错误信息 */
export class ApiError extends Error {
  public readonly code: string;
  public readonly data?: ApiErrorResponse["data"];
  public readonly status: number;

  constructor(response: ApiErrorResponse, status: number) {
    super(response.message);
    this.name = "ApiError";
    this.code = response.code;
    this.data = response.data;
    this.status = status;
  }

  /** 获取所有验证错误 */
  get validationErrors(): ValidationError[] {
    return this.data?.errors ?? [];
  }

  /** 检查是否有验证错误 */
  get hasValidationErrors(): boolean {
    return this.validationErrors.length > 0;
  }

  /** 获取指定字段的第一个错误消息 */
  getFieldError(fieldName: string): string | undefined {
    return this.validationErrors.find((e) => e.field === fieldName)?.message;
  }

  /** 获取指定字段的所有错误消息 */
  getFieldErrors(fieldName: string): string[] {
    return this.validationErrors
      .filter((e) => e.field === fieldName)
      .map((e) => e.message);
  }

  /** 获取所有字段的错误映射（每个字段取第一个错误） */
  getFieldErrorMap(): Record<string, string> {
    const errors: Record<string, string> = {};
    this.validationErrors.forEach((err) => {
      if (err.field && !errors[err.field]) {
        errors[err.field] = err.message;
      }
    });
    return errors;
  }

  /** 获取格式化的错误消息列表 */
  getFormattedErrors(): string[] {
    return this.validationErrors.map((e) => `${e.field}: ${e.message}`);
  }
}

/** 类型守卫：判断是否为 ApiError */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * 从错误对象中提取用户友好的错误消息
 * @param error - 错误对象（可能是 ApiError、Error 或其他类型）
 * @param defaultMessage - 默认错误消息，当无法提取有效消息时使用
 * @returns 格式化的错误消息字符串
 */
export function getApiErrorMessage(
  error: unknown,
  defaultMessage = "操作失败",
): string {
  // 如果是 ApiError，优先返回后端的错误消息
  if (isApiError(error)) {
    // 如果有验证错误，返回第一个验证错误的消息
    if (error.hasValidationErrors) {
      return error.validationErrors[0]?.message ?? error.message;
    }
    // 返回后端的错误消息
    return error.message;
  }

  // 如果是普通 Error 对象
  if (error instanceof Error) {
    return error.message;
  }

  // 其他类型的错误，返回默认消息
  return defaultMessage;
}
