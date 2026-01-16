import Taro from "@tarojs/taro";

import { config } from "../config";

/**
 * HTTP 请求方法
 */
type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * 请求配置
 */
interface RequestOptions {
  url: string;
  method?: Method;
  data?: Record<string, unknown>;
  header?: Record<string, string>;
  showLoading?: boolean;
  loadingText?: string;
  timeout?: number;
}

/** 默认请求超时时间 (ms) */
const DEFAULT_TIMEOUT = 10000;

/**
 * API 响应结构（ADR-API-001）
 */
interface ApiResponse<T = unknown> {
  code: string;
  message: string;
  data: T;
}

// Token 存储 key
const TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

function createTraceId(): string {
  // https://stackoverflow.com/a/2117523 (adapted)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 获取存储的 Token
 */
export function getToken(): string | null {
  return Taro.getStorageSync(TOKEN_KEY) || null;
}

/**
 * 设置 Token
 */
export function setToken(token: string): void {
  Taro.setStorageSync(TOKEN_KEY, token);
}

/**
 * 获取 Refresh Token
 */
export function getRefreshToken(): string | null {
  return Taro.getStorageSync(REFRESH_TOKEN_KEY) || null;
}

/**
 * 设置 Refresh Token
 */
export function setRefreshToken(token: string): void {
  Taro.setStorageSync(REFRESH_TOKEN_KEY, token);
}

/**
 * 清除所有 Token
 */
export function clearTokens(): void {
  Taro.removeStorageSync(TOKEN_KEY);
  Taro.removeStorageSync(REFRESH_TOKEN_KEY);
}

/**
 * 封装的请求方法
 */
export async function request<T = unknown>(
  options: RequestOptions,
): Promise<ApiResponse<T>> {
  const {
    url,
    method = "GET",
    data,
    header = {},
    showLoading = false,
    loadingText = "加载中...",
    timeout = DEFAULT_TIMEOUT,
  } = options;

  // 显示 loading
  if (showLoading) {
    Taro.showLoading({ title: loadingText, mask: true });
  }

  // 添加 Authorization header
  const token = getToken();
  if (token) {
    header["Authorization"] = `Bearer ${token}`;
  }

  // 设置 Content-Type
  if (!header["Content-Type"]) {
    header["Content-Type"] = "application/json";
  }

  // Trace ID (ADR-API-001)
  header["X-Trace-Id"] = header["X-Trace-Id"] || createTraceId();

  try {
    const response = await Taro.request({
      url: `${config.apiBaseUrl}${url}`,
      method,
      data,
      header,
      timeout,
    });

    // 隐藏 loading
    if (showLoading) {
      Taro.hideLoading();
    }

    // 处理 HTTP 状态码（以 status 为准）
    if (response.statusCode === 401) {
      clearTokens();
      Taro.showToast({ title: "登录已过期，请重新登录", icon: "none" });
      throw new Error("Unauthorized");
    }

    if (response.statusCode >= 400) {
      const responseData = response.data;
      const errorMessage =
        responseData &&
        typeof responseData === "object" &&
        "message" in responseData
          ? String((responseData as { message?: unknown }).message)
          : "请求失败";
      Taro.showToast({ title: errorMessage, icon: "none" });
      throw new Error(errorMessage);
    }

    return response.data as ApiResponse<T>;
  } catch (error) {
    if (showLoading) {
      Taro.hideLoading();
    }

    if (error instanceof Error && error.message !== "Unauthorized") {
      Taro.showToast({ title: "网络请求失败", icon: "none" });
    }

    throw error;
  }
}

/**
 * GET 请求
 */
export function get<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return request<T>({ url, method: "GET", data, ...options });
}

/**
 * POST 请求
 */
export function post<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return request<T>({ url, method: "POST", data, ...options });
}

/**
 * PUT 请求
 */
export function put<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return request<T>({ url, method: "PUT", data, ...options });
}

/**
 * DELETE 请求
 */
export function del<T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  options?: Partial<RequestOptions>,
): Promise<ApiResponse<T>> {
  return request<T>({ url, method: "DELETE", data, ...options });
}

export default {
  request,
  get,
  post,
  put,
  del,
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  clearTokens,
};
