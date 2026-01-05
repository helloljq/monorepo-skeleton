/**
 * 公共路径常量
 *
 * 定义免鉴权的公共路径，避免硬编码分散在多处导致维护困难。
 * 这些路径在 main.ts 和 jwt-auth.guard.ts 中使用。
 */
export const PUBLIC_PATHS = {
  /** Prometheus 指标端点 */
  METRICS: "/metrics",
  /** 健康检查端点 */
  HEALTH: "/health",
} as const;

export type PublicPath = (typeof PUBLIC_PATHS)[keyof typeof PUBLIC_PATHS];
