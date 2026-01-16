import { API_BASE_URL } from "@/config/env";

export type ApiErrorResponse = {
  code: string;
  message: string;
  data?: unknown;
};

export class ApiError extends Error {
  code: string;
  status: number;
  data: unknown;

  constructor(payload: ApiErrorResponse, status: number) {
    super(payload.message);
    this.name = "ApiError";
    this.code = payload.code;
    this.status = status;
    this.data = payload.data ?? null;
  }
}

function createTraceId(): string {
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

type RequestConfig = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: unknown;
  params?: Record<string, unknown>;
  signal?: AbortSignal;
};

/**
 * Web 端统一请求封装（对齐 ADR-API-001 / 前端结构规范）：
 * - 必须注入 X-Trace-Id
 * - 401/403 以 HTTP status 为准处理
 * - 解包统一响应格式 { code, message, data }
 */
export async function customFetch<T>(config: RequestConfig): Promise<T> {
  const { url, method = "GET", headers = {}, data, params, signal } = config;
  const traceId = createTraceId();

  let fullUrl = `${API_BASE_URL}${url}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) fullUrl += `?${qs}`;
  }

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

  if (!response.ok) {
    const payload: ApiErrorResponse = await response.json().catch(() => ({
      code: defaultErrorCodeFromStatus(response.status),
      message: response.statusText,
    }));
    throw new ApiError(payload, response.status);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = (await response.json()) as { data: T };
  return json.data;
}
