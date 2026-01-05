import { Inject, Injectable, Logger } from "@nestjs/common";
import Redis from "ioredis";

import { REDIS_CLIENT } from "../../../common/redis/redis.module";
import { PrismaService } from "../../../database/prisma/prisma.service";

/**
 * 权限缓存服务
 *
 * 采用「按角色缓存权限」策略，避免角色变更时需遍历大量用户。
 * - 缓存 Key: permission:role:{roleCode}
 * - 缓存 Value: 权限代码数组 JSON
 * - TTL: 10 分钟
 *
 * 权限查询时合并用户所有角色的权限，角色变更时只需失效该角色缓存。
 */
@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);
  private readonly CACHE_PREFIX = "permission:role:";
  private readonly CACHE_TTL = 600; // 10 分钟

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 获取用户权限 (合并所有角色的权限)
   *
   * @param roles - 用户的角色代码列表
   * @returns 权限代码列表 (已去重)
   */
  async getUserPermissions(roles: string[]): Promise<string[]> {
    if (!roles.length) {
      return [];
    }

    // 批量获取各角色权限
    const permissionSets = await Promise.all(
      roles.map((role) => this.getRolePermissions(role)),
    );

    // 合并去重
    const merged = new Set<string>();
    for (const perms of permissionSets) {
      perms.forEach((p) => merged.add(p));
    }

    return Array.from(merged);
  }

  /**
   * 获取单个角色的权限 (带缓存)
   *
   * @param roleCode - 角色代码
   * @returns 权限代码列表
   */
  async getRolePermissions(roleCode: string): Promise<string[]> {
    const cacheKey = `${this.CACHE_PREFIX}${roleCode}`;

    try {
      // 1. 尝试从缓存获取
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as string[];
      }
    } catch (error) {
      this.logger.warn(
        { roleCode, error: error instanceof Error ? error.message : error },
        "[permission-cache] Redis get failed, fallback to DB",
      );
    }

    // 2. 从数据库加载
    const permissions = await this.loadRolePermissionsFromDb(roleCode);

    // 3. 写入缓存 (异步，不阻塞返回)
    this.redis
      .setex(cacheKey, this.CACHE_TTL, JSON.stringify(permissions))
      .catch((error: unknown) => {
        this.logger.warn(
          { roleCode, error: error instanceof Error ? error.message : error },
          "[permission-cache] Redis set failed",
        );
      });

    return permissions;
  }

  /**
   * 从数据库加载角色权限
   */
  private async loadRolePermissionsFromDb(roleCode: string): Promise<string[]> {
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
      include: {
        RolePermission: {
          include: {
            Permission: {
              select: { code: true, isEnabled: true },
            },
          },
        },
      },
    });

    if (!role) {
      return [];
    }

    // 只返回已启用的权限
    return role.RolePermission.filter((rp) => rp.Permission.isEnabled).map(
      (rp) => rp.Permission.code,
    );
  }

  /**
   * 角色权限变更时调用，失效该角色的缓存
   *
   * @param roleCode - 角色代码
   */
  async invalidateRoleCache(roleCode: string): Promise<void> {
    const cacheKey = `${this.CACHE_PREFIX}${roleCode}`;
    try {
      await this.redis.del(cacheKey);
      this.logger.debug({ roleCode }, "[permission-cache] Cache invalidated");
    } catch (error) {
      this.logger.warn(
        { roleCode, error: error instanceof Error ? error.message : error },
        "[permission-cache] Cache invalidation failed",
      );
    }
  }

  /**
   * 批量失效多个角色的缓存
   *
   * @param roleCodes - 角色代码列表
   */
  async invalidateRoleCaches(roleCodes: string[]): Promise<void> {
    if (!roleCodes.length) return;

    const keys = roleCodes.map((code) => `${this.CACHE_PREFIX}${code}`);
    try {
      await this.redis.del(...keys);
      this.logger.debug(
        { roleCodes },
        "[permission-cache] Batch cache invalidated",
      );
    } catch (error) {
      this.logger.warn(
        { roleCodes, error: error instanceof Error ? error.message : error },
        "[permission-cache] Batch cache invalidation failed",
      );
    }
  }

  /**
   * 清空所有权限缓存 (谨慎使用)
   */
  async invalidateAllCache(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length) {
        await this.redis.del(...keys);
        this.logger.debug(
          { count: keys.length },
          "[permission-cache] All cache invalidated",
        );
      }
    } catch (error) {
      this.logger.warn(
        { error: error instanceof Error ? error.message : error },
        "[permission-cache] All cache invalidation failed",
      );
    }
  }
}
