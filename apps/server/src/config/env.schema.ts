import { z } from "zod";

/**
 * 检测是否为不安全的占位符 secret
 */
function isInsecurePlaceholder(value: string): boolean {
  const lowerValue = value.toLowerCase();
  return (
    lowerValue.includes("please-change") ||
    lowerValue.includes("change-me") ||
    lowerValue.includes("your-secret") ||
    lowerValue.includes("xxx") ||
    lowerValue === "secret" ||
    lowerValue === "password"
  );
}

export const envSchema = z
  .object({
    // Canonical app environment (ADR-ENV-001)
    APP_ENV: z.enum(["dev", "staging", "prod"]).default("dev"),

    // Server
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(17000),
    BODY_LIMIT: z.string().default("1mb"),

    // CORS (comma-separated list of allowed origins)
    // NOTE: 默认值仅用于本地开发环境，生产/Staging 环境必须通过 GitHub Secrets 配置
    // 参见 .github/workflows/cd.yml 中的 STAGING_CORS_ORIGINS / PROD_CORS_ORIGINS
    CORS_ORIGINS: z
      .string()
      .default(
        "http://localhost:17001,http://localhost:17002,http://localhost:17000,https://admin-dev.monorepo-skeleton.test,https://www-dev.monorepo-skeleton.test",
      ),

    // Database (PostgreSQL)
    DATABASE_URL: z.string().url(),

    // Redis
    REDIS_URL: z.string().url(),

    // Auth (JWT) - min 32 chars for security
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),

    // Rate Limiting
    RATE_LIMIT_TTL_MS: z.coerce.number().int().min(1000).default(60000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),

    // Idempotency
    IDEMPOTENCY_TTL_SECONDS: z.coerce.number().int().min(1).default(86400),

    // Observability
    PRISMA_SLOW_QUERY_MS: z.coerce.number().int().min(0).default(500),

    // WeChat Open Platform (扫码登录)
    WECHAT_OPEN_APP_ID: z.string().optional(),
    WECHAT_OPEN_APP_SECRET: z.string().optional(),

    // WeChat MP (公众号/H5 登录)
    WECHAT_MP_APP_ID: z.string().optional(),
    WECHAT_MP_APP_SECRET: z.string().optional(),

    // WeChat Mini Program (小程序登录)
    WECHAT_MINI_APP_ID: z.string().optional(),
    WECHAT_MINI_APP_SECRET: z.string().optional(),

    // WeChat State 签名密钥 (防 CSRF)
    WECHAT_STATE_SECRET: z.string().optional(),

    // Permission Cache TTL (seconds)
    PERMISSION_CACHE_TTL: z.coerce.number().int().min(1).default(600),

    // Config Center
    CONFIG_ENCRYPTION_KEY: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/i, "Must be a valid hex string")
      .optional(),
    CONFIG_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),

    // Script Upload (for external scripts without login)
    SCRIPT_UPLOAD_TOKEN: z.string().min(32).optional(),
  })
  .superRefine((data, ctx) => {
    // APP_ENV=staging/prod 时，NODE_ENV 必须为 production（NODE_ENV 仅表达运行时优化级别，不承载部署语义）
    if (data.APP_ENV !== "dev" && data.NODE_ENV !== "production") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NODE_ENV"],
        message: "When APP_ENV is staging/prod, NODE_ENV must be 'production'",
      });
    }

    // staging/prod 禁止使用不安全的占位符 secret
    if (data.APP_ENV !== "dev") {
      if (isInsecurePlaceholder(data.JWT_ACCESS_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_ACCESS_SECRET"],
          message:
            "Staging/production environment detected insecure placeholder in JWT_ACCESS_SECRET. Please use a secure random secret.",
        });
      }
      if (isInsecurePlaceholder(data.JWT_REFRESH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_REFRESH_SECRET"],
          message:
            "Staging/production environment detected insecure placeholder in JWT_REFRESH_SECRET. Please use a secure random secret.",
        });
      }

      // 配置中心加密密钥校验
      if (data.APP_ENV === "prod" && !data.CONFIG_ENCRYPTION_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CONFIG_ENCRYPTION_KEY"],
          message:
            "CONFIG_ENCRYPTION_KEY is required in production for config encryption",
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
