import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ConfigChangeType } from "@prisma/client";
import { Server, Socket } from "socket.io";

import { AppConfigService } from "../../../config/app-config.service";
import { PrismaService } from "../../../database/prisma/prisma.service";

/**
 * 认证后的 Socket 连接
 */
interface AuthenticatedSocket extends Socket {
  userId?: number;
  email?: string;
}

/**
 * 配置变更事件负载
 */
export interface ConfigChangedPayload {
  namespace: string;
  key: string;
  version: number;
  configHash: string;
  changeType: ConfigChangeType;
  changedAt: string;
}

/**
 * 订阅事件负载
 */
interface SubscribePayload {
  namespaces: string[];
}

/**
 * 配置中心 WebSocket 网关
 *
 * 提供配置变更实时推送功能：
 * - 客户端订阅指定命名空间的配置变更
 * - 配置发生变更时，自动推送通知
 * - 支持跨实例推送（通过 RedisIoAdapter）
 * - JWT 认证和权限验证
 */
@WebSocketGateway({ namespace: "/config" })
export class ConfigCenterGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ConfigCenterGateway.name);

  @WebSocketServer()
  server!: Server;

  /**
   * 本地订阅状态（仅用于日志/调试）
   * 实际推送依赖 Socket.io room 机制，通过 RedisIoAdapter 自动跨实例同步
   */
  private subscriptions = new Map<string, Set<string>>(); // socketId -> namespaces

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 处理客户端连接
   * 验证 JWT token
   */
  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      // 从握手中提取 token
      const token =
        (client.handshake.auth?.token as string | undefined) ||
        (client.handshake.query?.token as string | undefined);

      if (!token) {
        this.logger.warn(
          `Client ${client.id} attempted connection without token`,
        );
        client.emit("error", { message: "Authentication required" });
        client.disconnect();
        return;
      }

      // 验证 JWT token
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
      }>(token, {
        secret: this.configService.auth.accessSecret,
      });

      // 附加用户信息到 socket
      client.userId = payload.sub;
      client.email = payload.email;

      this.logger.log(`Client ${client.id} connected (userId: ${payload.sub})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(`Client ${client.id} authentication failed: ${message}`);
      client.emit("error", { message: "Invalid token" });
      client.disconnect();
    }
  }

  /**
   * 检查用户是否拥有指定权限
   */
  private async hasPermission(
    userId: number,
    permissionCode: string,
  ): Promise<boolean> {
    // 查询用户的所有权限
    const userWithPermissions = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: {
            role: {
              select: {
                isEnabled: true,
                deletedAt: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: { code: true, isEnabled: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithPermissions) {
      return false;
    }

    // 展平权限码
    const permissions = new Set<string>();
    for (const userRole of userWithPermissions.userRoles) {
      const role = userRole.role;
      if (!role.isEnabled || role.deletedAt) continue;
      for (const rolePermission of role.rolePermissions) {
        if (!rolePermission.permission.isEnabled) continue;
        permissions.add(rolePermission.permission.code);
      }
    }

    return permissions.has(permissionCode);
  }

  /**
   * 处理客户端订阅请求
   * 验证用户权限
   *
   * @param client WebSocket 连接
   * @param data 订阅的命名空间列表
   */
  @SubscribeMessage("config:subscribe")
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SubscribePayload,
  ): Promise<{ success: boolean; subscribed: string[]; error?: string }> {
    const { namespaces } = data;

    // 验证用户是否已认证
    if (!client.userId) {
      this.logger.warn(
        `Client ${client.id} attempted to subscribe without authentication`,
      );
      return {
        success: false,
        subscribed: [],
        error: "Authentication required",
      };
    }

    // 验证用户是否有读取配置的权限
    const hasPermission = await this.hasPermission(
      client.userId,
      "config:item:read",
    );

    if (!hasPermission) {
      this.logger.warn(
        `Client ${client.id} (userId: ${client.userId}) attempted to subscribe without config:item:read permission`,
      );
      return { success: false, subscribed: [], error: "Permission denied" };
    }

    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      return { success: false, subscribed: [], error: "Invalid namespaces" };
    }

    const current = this.subscriptions.get(client.id) || new Set();

    namespaces.forEach((ns) => {
      current.add(ns);
      // 加入 Socket.io room (格式: config:{namespace})
      void client.join(`config:${ns}`);
      this.logger.debug(
        `Client ${client.id} (userId: ${client.userId}) subscribed to namespace: ${ns}`,
      );
    });

    this.subscriptions.set(client.id, current);

    return { success: true, subscribed: Array.from(current) };
  }

  /**
   * 处理客户端取消订阅请求
   *
   * @param client WebSocket 连接
   * @param data 取消订阅的命名空间列表
   */
  @SubscribeMessage("config:unsubscribe")
  handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SubscribePayload,
  ): { success: boolean; subscribed: string[] } {
    const { namespaces } = data;

    if (!Array.isArray(namespaces) || namespaces.length === 0) {
      return { success: false, subscribed: [] };
    }

    const current = this.subscriptions.get(client.id);
    if (!current) {
      return { success: true, subscribed: [] };
    }

    namespaces.forEach((ns) => {
      current.delete(ns);
      // 离开 Socket.io room
      void client.leave(`config:${ns}`);
      this.logger.debug(
        `Client ${client.id} unsubscribed from namespace: ${ns}`,
      );
    });

    if (current.size === 0) {
      this.subscriptions.delete(client.id);
    }

    return { success: true, subscribed: Array.from(current) };
  }

  /**
   * 处理客户端断开连接
   *
   * @param client WebSocket 连接
   */
  handleDisconnect(client: AuthenticatedSocket): void {
    const subscribed = this.subscriptions.get(client.id);
    if (subscribed) {
      this.logger.debug(
        `Client ${client.id} disconnected, was subscribed to: ${Array.from(subscribed).join(", ")}`,
      );
      this.subscriptions.delete(client.id);
    }
  }

  /**
   * 推送配置变更通知
   *
   * 由 ConfigItemService 调用，推送到订阅了该命名空间的所有客户端
   *
   * @param payload 配置变更信息
   */
  notifyConfigChanged(payload: ConfigChangedPayload): void {
    // 检查 WebSocket server 是否已初始化
    // 在服务刚启动时，WebSocket 可能尚未完全初始化
    if (!this.server) {
      this.logger.warn(
        `WebSocket server not initialized, skipping config change notification for ${payload.namespace}:${payload.key}`,
      );
      return;
    }

    const room = `config:${payload.namespace}`;

    this.logger.debug(
      `Notifying config changed: ${payload.namespace}:${payload.key} (version ${payload.version})`,
    );

    // 推送到 room（所有订阅该命名空间的客户端）
    // RedisIoAdapter 会自动将消息同步到其他实例
    this.server.to(room).emit("config:changed", payload);
  }

  /**
   * 获取当前订阅统计信息（用于监控）
   */
  getSubscriptionStats(): {
    totalConnections: number;
    namespaceSubscriptions: Record<string, number>;
  } {
    const namespaceCount: Record<string, number> = {};

    for (const namespaces of this.subscriptions.values()) {
      for (const ns of namespaces) {
        namespaceCount[ns] = (namespaceCount[ns] || 0) + 1;
      }
    }

    return {
      totalConnections: this.subscriptions.size,
      namespaceSubscriptions: namespaceCount,
    };
  }
}
