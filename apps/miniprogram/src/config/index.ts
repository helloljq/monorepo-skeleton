/**
 * 小程序运行时配置（Taro）
 *
 * Canonical env: APP_ENV=dev|staging|prod (ADR-ENV-001).
 * `process.env.APP_ENV` 由 Taro 构建配置注入（见 apps/miniprogram/config/index.ts）。
 */

export type AppEnv = "dev" | "staging" | "prod";

function requireAppEnv(value: unknown): AppEnv {
  if (value === "dev" || value === "staging" || value === "prod") return value;
  throw new Error(
    `Invalid APP_ENV: ${String(value)} (expected dev|staging|prod)`,
  );
}

export const APP_ENV: AppEnv = requireAppEnv(process.env.APP_ENV ?? "dev");

const API_BASE_URL: Record<AppEnv, string> = {
  dev: "https://api-dev.monorepo-skeleton.test",
  staging: "https://api-staging.monorepo-skeleton.test",
  prod: "https://api.monorepo-skeleton.test",
};

// 导出配置
export const config = {
  env: APP_ENV,
  apiBaseUrl: API_BASE_URL[APP_ENV],
};

export default config;
