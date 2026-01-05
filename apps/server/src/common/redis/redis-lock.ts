import { randomUUID } from "node:crypto";

import Redis from "ioredis";

export interface RedisLockOptions {
  /**
   * 锁的 TTL（毫秒）。必须设置，避免死锁。
   */
  ttlMs: number;

  /**
   * 获取锁失败时的重试次数（默认 0，不重试）。
   */
  retries?: number;

  /**
   * 重试间隔（毫秒，默认 50）。
   */
  retryDelayMs?: number;
}

export interface RedisLock {
  key: string;
  token: string;
  ttlMs: number;
}

const RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取分布式锁（SET key value NX PX ttl）
 */
export async function acquireRedisLock(
  redis: Redis,
  key: string,
  options: RedisLockOptions,
): Promise<RedisLock | null> {
  const token = randomUUID();
  const retries = options.retries ?? 0;
  const delay = options.retryDelayMs ?? 50;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const ok = await redis.set(key, token, "PX", options.ttlMs, "NX");
    if (ok === "OK") {
      return { key, token, ttlMs: options.ttlMs };
    }
    if (attempt < retries) {
      await sleep(delay);
    }
  }

  return null;
}

/**
 * 释放分布式锁（对比 token 后删除，避免误删他人的锁）
 */
export async function releaseRedisLock(
  redis: Redis,
  lock: RedisLock,
): Promise<boolean> {
  const result = await redis.eval(RELEASE_LUA, 1, lock.key, lock.token);
  return Number(result) > 0;
}
