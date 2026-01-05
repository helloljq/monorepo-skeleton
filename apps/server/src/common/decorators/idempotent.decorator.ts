import { SetMetadata } from "@nestjs/common";

export const IDEMPOTENT_KEY = "IDEMPOTENT_KEY";

export interface IdempotentOptions {
  /**
   * 结果缓存 TTL（秒）。默认使用配置项。
   */
  ttlSeconds?: number;

  /**
   * 锁 TTL（毫秒）。默认 30000。
   * 必须 >= 接口最大预期耗时，否则会出现重复执行风险。
   */
  lockTtlMs?: number;

  /**
   * 是否要求用户已认证。默认 true。
   * 当设为 true 时，未认证用户会收到 401 错误而非降级为 'anon'。
   * 这可以防止不同匿名用户共享幂等签名的风险。
   */
  requireAuth?: boolean;
}

export const Idempotent = (options?: IdempotentOptions) =>
  SetMetadata(IDEMPOTENT_KEY, { requireAuth: true, ...options });
