import { describe, expect, it } from "vitest";

import {
  ApiError,
  getApiErrorMessage,
  isApiError,
  type ValidationError,
} from "./api-error";

describe("ApiError", () => {
  const mockValidationErrors: ValidationError[] = [
    { path: ["email"], message: "邮箱格式不正确", code: "invalid_string" },
    { path: ["password"], message: "密码至少需要8个字符", code: "too_small" },
    { path: ["password"], message: "密码必须包含数字", code: "custom" },
  ];

  const mockApiResponse = {
    code: 40001,
    message: "参数校验失败",
    data: { errors: mockValidationErrors },
    timestamp: 1704067200000,
  };

  describe("constructor", () => {
    it("should create ApiError with correct properties", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.name).toBe("ApiError");
      expect(error.message).toBe("参数校验失败");
      expect(error.code).toBe(40001);
      expect(error.status).toBe(400);
      expect(error.timestamp).toBe(1704067200000);
      expect(error.data).toEqual({ errors: mockValidationErrors });
    });

    it("should work without validation errors", () => {
      const response = {
        code: 40101,
        message: "未授权",
      };
      const error = new ApiError(response, 401);

      expect(error.message).toBe("未授权");
      expect(error.code).toBe(40101);
      expect(error.data).toBeUndefined();
    });
  });

  describe("validationErrors", () => {
    it("should return validation errors array", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.validationErrors).toEqual(mockValidationErrors);
    });

    it("should return empty array when no validation errors", () => {
      const error = new ApiError({ code: 500, message: "服务器错误" }, 500);

      expect(error.validationErrors).toEqual([]);
    });
  });

  describe("hasValidationErrors", () => {
    it("should return true when has validation errors", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.hasValidationErrors).toBe(true);
    });

    it("should return false when no validation errors", () => {
      const error = new ApiError({ code: 500, message: "服务器错误" }, 500);

      expect(error.hasValidationErrors).toBe(false);
    });
  });

  describe("getFieldError", () => {
    it("should return first error message for specified field", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.getFieldError("email")).toBe("邮箱格式不正确");
      expect(error.getFieldError("password")).toBe("密码至少需要8个字符");
    });

    it("should return undefined for non-existent field", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.getFieldError("username")).toBeUndefined();
    });
  });

  describe("getFieldErrors", () => {
    it("should return all error messages for specified field", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.getFieldErrors("password")).toEqual([
        "密码至少需要8个字符",
        "密码必须包含数字",
      ]);
    });

    it("should return empty array for non-existent field", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.getFieldErrors("username")).toEqual([]);
    });
  });

  describe("getFieldErrorMap", () => {
    it("should return map of first errors for each field", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.getFieldErrorMap()).toEqual({
        email: "邮箱格式不正确",
        password: "密码至少需要8个字符",
      });
    });

    it("should return empty object when no validation errors", () => {
      const error = new ApiError({ code: 500, message: "服务器错误" }, 500);

      expect(error.getFieldErrorMap()).toEqual({});
    });
  });

  describe("getFormattedErrors", () => {
    it("should return formatted error messages", () => {
      const error = new ApiError(mockApiResponse, 400);

      expect(error.getFormattedErrors()).toEqual([
        "email: 邮箱格式不正确",
        "password: 密码至少需要8个字符",
        "password: 密码必须包含数字",
      ]);
    });
  });
});

describe("isApiError", () => {
  it("should return true for ApiError instance", () => {
    const error = new ApiError({ code: 500, message: "error" }, 500);

    expect(isApiError(error)).toBe(true);
  });

  it("should return false for regular Error", () => {
    const error = new Error("regular error");

    expect(isApiError(error)).toBe(false);
  });

  it("should return false for non-error values", () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError("string")).toBe(false);
    expect(isApiError({})).toBe(false);
  });
});

describe("getApiErrorMessage", () => {
  it("should return message from ApiError", () => {
    const error = new ApiError({ code: 40001, message: "API错误消息" }, 400);

    expect(getApiErrorMessage(error)).toBe("API错误消息");
  });

  it("should return first validation error message when available", () => {
    const error = new ApiError(
      {
        code: 40001,
        message: "参数校验失败",
        data: {
          errors: [
            { path: ["email"], message: "邮箱格式不正确", code: "invalid" },
          ],
        },
      },
      400,
    );

    expect(getApiErrorMessage(error)).toBe("邮箱格式不正确");
  });

  it("should return message from regular Error", () => {
    const error = new Error("普通错误");

    expect(getApiErrorMessage(error)).toBe("普通错误");
  });

  it("should return default message for unknown error types", () => {
    expect(getApiErrorMessage(null)).toBe("操作失败");
    expect(getApiErrorMessage(undefined)).toBe("操作失败");
    expect(getApiErrorMessage("string error")).toBe("操作失败");
  });

  it("should return custom default message", () => {
    expect(getApiErrorMessage(null, "自定义错误")).toBe("自定义错误");
  });
});
