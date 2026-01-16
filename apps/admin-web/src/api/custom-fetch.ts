import { toast } from "sonner";

import { API_BASE_URL } from "@/config/env";
import { ApiError, type ApiErrorResponse } from "@/lib/api-error";
import { createLogger } from "@/lib/logger";
import { useAuthStore } from "@/stores/auth-store";

// 创建 Token Refresh 专用 logger
const refreshLogger = createLogger("[Token Refresh]");

const BASE_URL = API_BASE_URL;

function createTraceId(): string {
  // crypto.randomUUID() is available in modern browsers; fallback keeps UUID v4 shape.
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // https://stackoverflow.com/a/2117523 (adapted)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function defaultErrorCodeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "TOO_MANY_REQUESTS";
    default:
      return "INTERNAL_ERROR";
  }
}

/**
 * 刷新锁：防止并发请求同时触发刷新
 *
 * 设计说明：
 * - isRefreshing 是模块级变量，在整个应用生命周期内共享
 * - 这是有意的设计：多个组件同时触发 401 时应该共享同一个刷新流程
 * - 即使组件卸载，也不应中断正在进行的刷新（其他组件可能在等待）
 * - 刷新成功/失败后会自动重置状态，不会产生泄漏
 */
let isRefreshing = false;
let refreshSubscribers: ((ok: boolean) => void)[] = [];

// 性能监控：刷新统计
const refreshStats = {
  totalAttempts: 0,
  successCount: 0,
  failureCount: 0,
  totalDuration: 0,
};

// 导出性能统计（用于调试）
export const getRefreshStats = () => {
  const avgDuration =
    refreshStats.successCount > 0
      ? refreshStats.totalDuration / refreshStats.successCount
      : 0;
  const successRate =
    refreshStats.totalAttempts > 0
      ? (refreshStats.successCount / refreshStats.totalAttempts) * 100
      : 0;

  return {
    ...refreshStats,
    avgDuration: parseFloat(avgDuration.toFixed(2)),
    successRate: parseFloat(successRate.toFixed(2)),
  };
};

// 重置性能统计（用于调试）
export const resetRefreshStats = () => {
  refreshStats.totalAttempts = 0;
  refreshStats.successCount = 0;
  refreshStats.failureCount = 0;
  refreshStats.totalDuration = 0;
};

// 在全局暴露调试函数（仅开发环境）
if (import.meta.env.DEV) {
  // @ts-expect-error - 开发环境调试工具
  window.__debugRefreshStats = {
    get: getRefreshStats,
    reset: resetRefreshStats,
  };
}

// 订阅刷新结果
function subscribeToRefresh(callback: (ok: boolean) => void) {
  refreshSubscribers.push(callback);
}

// 通知所有订阅者刷新结果
function onRefreshed(ok: boolean) {
  refreshSubscribers.forEach((callback) => callback(ok));
  refreshSubscribers = [];
}

// Web Cookie 模式刷新（带重试机制、性能监控、友好提示）
async function doRefreshCookieSession(retryCount = 0): Promise<boolean> {
  const startTime = performance.now();
  refreshStats.totalAttempts++;

  try {
    const state = useAuthStore.getState();
    const deviceId = state.deviceId;

    if (!deviceId) {
      refreshStats.failureCount++;
      return false;
    }

    const traceId = createTraceId();
    const response = await fetch(`${BASE_URL}/v1/auth/web/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Trace-Id": traceId },
      credentials: "include",
      body: JSON.stringify({
        deviceId,
      }),
    });

    // 刷新成功
    if (response.ok) {
      // Cookie 已由服务端刷新并写入，无需在 JS 侧读取 Token

      // 性能监控：记录成功
      const duration = performance.now() - startTime;
      refreshStats.successCount++;
      refreshStats.totalDuration += duration;

      refreshLogger.log(
        `成功 (耗时: ${duration.toFixed(2)}ms, 重试次数: ${retryCount})`,
      );

      return true;
    }

    // 401 错误：refreshToken 已过期，不重试
    if (response.status === 401) {
      refreshStats.failureCount++;
      refreshLogger.warn("RefreshToken 已过期，需要重新登录");
      return false;
    }

    // 其他错误：可能是网络问题，尝试重试
    if (retryCount < 3) {
      const delay = 1000 * Math.pow(2, retryCount); // exponential backoff: 1s, 2s, 4s
      refreshLogger.warn(
        `失败 (状态码: ${response.status})，${delay}ms 后重试 (${retryCount + 1}/3)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return doRefreshCookieSession(retryCount + 1);
    }

    // 重试耗尽
    refreshStats.failureCount++;
    refreshLogger.error("刷新失败，重试次数已耗尽");
    return false;
  } catch (error) {
    // 网络异常：尝试重试
    if (retryCount < 3) {
      const delay = 1000 * Math.pow(2, retryCount); // exponential backoff
      refreshLogger.warn(
        `网络异常，${delay}ms 后重试 (${retryCount + 1}/3)`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return doRefreshCookieSession(retryCount + 1);
    }

    // 重试耗尽
    refreshStats.failureCount++;
    refreshLogger.error("刷新失败（网络异常），重试次数已耗尽", error);
    return false;
  }
}

interface RequestConfig {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
}

export const customFetch = async <T>(
  config: RequestConfig,
  _options?: RequestInit,
): Promise<T> => {
  const { url, method, headers = {}, data, params, signal } = config;
  const traceId = createTraceId();

  // 构建 URL（带查询参数）
  let fullUrl = `${BASE_URL}${url}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  // 跳过 auth 相关接口的 401 刷新逻辑，避免死循环/无意义刷新
  const isAuthRequest = url.startsWith("/v1/auth/");

  const response = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Trace-Id": traceId,
      ...headers,
    },
    credentials: "include",
    body: data ? JSON.stringify(data) : undefined,
    signal,
  });

  // 401 处理：尝试刷新 Cookie Session（排除 auth 接口本身）
  if (response.status === 401 && !isAuthRequest) {
    // 如果当前正在刷新，等待刷新结果
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeToRefresh((ok) => {
          if (ok) {
            // 刷新成功，重试原始请求
            customFetch<T>(config, _options).then(resolve).catch(reject);
          } else {
            // 刷新失败，跳转登录
            toast.error("登录已过期，请重新登录");
            useAuthStore.getState().logout();
            window.location.href = "/login";
            reject(
              new ApiError(
                { code: "UNAUTHORIZED", message: "Unauthorized" },
                401,
              ),
            );
          }
        });
      });
    }

    // 开始刷新
    isRefreshing = true;

    const ok = await doRefreshCookieSession();

    isRefreshing = false;
    onRefreshed(ok);

    if (ok) {
      // 刷新成功，重试原始请求
      return customFetch<T>(config, _options);
    } else {
      // 刷新失败，清除认证状态并跳转登录
      toast.error("登录已过期，请重新登录");
      useAuthStore.getState().logout();
      window.location.href = "/login";
      throw new ApiError(
        { code: "UNAUTHORIZED", message: "Unauthorized" },
        401,
      );
    }
  }

  // 非 2xx 响应抛出 ApiError
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json().catch(() => ({
      code: defaultErrorCodeFromStatus(response.status),
      message: response.statusText,
    }));
    throw new ApiError(errorData, response.status);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  // 解包统一响应格式 { code, message, data: T }
  const json = await response.json();
  return json.data as T;
};

export default customFetch;
