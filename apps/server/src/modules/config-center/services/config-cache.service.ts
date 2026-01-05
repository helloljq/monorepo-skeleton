import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ConfigItem } from "@prisma/client";
import type Redis from "ioredis";

import { REDIS_CLIENT } from "../../../common/redis/redis.constants";
import {
  acquireRedisLock,
  releaseRedisLock,
} from "../../../common/redis/redis-lock";
import { AppConfigService } from "../../../config/app-config.service";

/**
 * 配置缓存服务
 *
 * 提供基于 Redis 的配置缓存功能，包括：
 * - 防缓存击穿（分布式锁）
 * - 防缓存雪崩（TTL 抖动）
 * - 多维度缓存失效（单个配置、命名空间级）
 */
@Injectable()
export class ConfigCacheService {
  private readonly logger = new Logger(ConfigCacheService.name);
  private readonly baseTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: AppConfigService,
  ) {
    this.baseTtl = this.configService.configCacheTtlSeconds;
  }

  /**
   * 计算带抖动的 TTL（±10%）
   * 防止大量 key 同时过期导致缓存雪崩
   */
  private getTtlWithJitter(): number {
    const jitter = this.baseTtl * 0.1 * (Math.random() * 2 - 1);
    return Math.floor(this.baseTtl + jitter);
  }

  /**
   * 生成缓存 key
   */
  private getCacheKey(namespace: string, key?: string): string {
    if (key) {
      return `config:${namespace}:${key}`;
    }
    return `config:${namespace}:all`;
  }

  /**
   * 生成元数据缓存 key
   */
  private getMetaCacheKey(namespace: string): string {
    return `config:${namespace}:meta`;
  }

  /**
   * 生成锁 key
   */
  private getLockKey(cacheKey: string): string {
    return `lock:${cacheKey}`;
  }

  /**
   * 获取单个配置缓存
   */
  async get(namespace: string, key: string): Promise<ConfigItem | null> {
    try {
      const cacheKey = this.getCacheKey(namespace, key);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as ConfigItem;
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Cache get failed for ${namespace}:${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null; // 降级为不使用缓存
    }
  }

  /**
   * 设置单个配置缓存
   */
  async set(namespace: string, key: string, config: ConfigItem): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(namespace, key);
      const ttl = this.getTtlWithJitter();
      await this.redis.setex(cacheKey, ttl, JSON.stringify(config));
    } catch (error) {
      this.logger.warn(
        `Cache set failed for ${namespace}:${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // 不抛出异常，允许降级
    }
  }

  /**
   * 获取命名空间下所有配置（缓存）
   */
  async getAll(namespace: string): Promise<ConfigItem[] | null> {
    try {
      const cacheKey = this.getCacheKey(namespace);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as ConfigItem[];
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Cache getAll failed for ${namespace}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * 设置命名空间所有配置缓存
   */
  async setAll(namespace: string, configs: ConfigItem[]): Promise<void> {
    try {
      const cacheKey = this.getCacheKey(namespace);
      const ttl = this.getTtlWithJitter();
      await this.redis.setex(cacheKey, ttl, JSON.stringify(configs));
    } catch (error) {
      this.logger.warn(
        `Cache setAll failed for ${namespace}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 使用分布式锁防止缓存击穿
   *
   * @param cacheKey 缓存 key
   * @param loader 数据加载函数
   * @returns 配置数据
   */
  async getWithLock<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
    // 1. 尝试获取缓存
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }

    // 2. 获取分布式锁
    const lockKey = this.getLockKey(cacheKey);
    const lock = await acquireRedisLock(this.redis, lockKey, {
      ttlMs: 5000, // 锁 TTL 5s
      retries: 3,
      retryDelayMs: 100,
    });

    if (!lock) {
      // 获取锁失败，等待其他实例完成加载后重新尝试读取
      await new Promise((resolve) => setTimeout(resolve, 200));
      const rechecked = await this.redis.get(cacheKey);
      if (rechecked) {
        return JSON.parse(rechecked) as T;
      }

      // 仍未命中，直接加载（降级）
      this.logger.warn(
        `Failed to acquire lock for ${cacheKey}, fallback to direct load`,
      );
      return loader();
    }

    try {
      // 3. 双重检查（Double-Check）
      const rechecked = await this.redis.get(cacheKey);
      if (rechecked) {
        return JSON.parse(rechecked) as T;
      }

      // 4. 加载数据
      const data = await loader();

      // 5. 写入缓存
      const ttl = this.getTtlWithJitter();
      await this.redis.setex(cacheKey, ttl, JSON.stringify(data));

      return data;
    } finally {
      // 6. 释放锁
      await releaseRedisLock(this.redis, lock);
    }
  }

  /**
   * 失效缓存
   *
   * 当配置创建/更新/删除时调用
   */
  async invalidate(namespace: string, key?: string): Promise<void> {
    try {
      const keysToDelete: string[] = [];

      if (key) {
        // 单个配置变更
        keysToDelete.push(this.getCacheKey(namespace, key));
      }

      // 命名空间级缓存失效
      keysToDelete.push(
        this.getCacheKey(namespace), // :all
        this.getMetaCacheKey(namespace), // :meta
      );

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (error) {
      this.logger.warn(
        `Cache invalidation failed for ${namespace}${key ? `:${key}` : ""}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // 不抛出异常，接受短暂不一致（TTL 会自然过期）
    }
  }

  /**
   * 失效命名空间列表缓存
   */
  async invalidateNamespaceList(): Promise<void> {
    try {
      await this.redis.del("config:ns:list");
    } catch (error) {
      this.logger.warn(
        `Cache invalidation failed for namespace list: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 获取配置元数据缓存（用于客户端校验）
   */
  async getMeta(namespace: string): Promise<Array<{
    key: string;
    version: number;
    configHash: string;
  }> | null> {
    try {
      const cacheKey = this.getMetaCacheKey(namespace);
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        return JSON.parse(cached) as Array<{
          key: string;
          version: number;
          configHash: string;
        }>;
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Cache getMeta failed for ${namespace}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * 设置配置元数据缓存
   */
  async setMeta(
    namespace: string,
    meta: Array<{ key: string; version: number; configHash: string }>,
  ): Promise<void> {
    try {
      const cacheKey = this.getMetaCacheKey(namespace);
      // 元数据 TTL 较短（5 分钟）
      await this.redis.setex(cacheKey, 300, JSON.stringify(meta));
    } catch (error) {
      this.logger.warn(
        `Cache setMeta failed for ${namespace}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
