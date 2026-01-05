import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import { AppConfigService } from "../../config/app-config.service";

interface AuthenticatedSocket extends Socket {
  userId?: number;
  email?: string;
}

@WebSocketGateway()
export class WsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
  ) {}

  afterInit(server: Server) {
    // Configure CORS at runtime
    const corsOrigins = this.configService.corsOrigins;
    this.logger.log(`WebSocket CORS origins: ${corsOrigins.join(", ")}`);

    // Note: CORS is configured via RedisIoAdapter.createIOServer()
    // This is just for logging purposes
    void server;
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract token from handshake auth or query
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

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        email: string;
      }>(token, {
        secret: this.configService.auth.accessSecret,
      });

      // Attach user info to socket
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

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(
      `Client ${client.id} disconnected (userId: ${client.userId ?? "unknown"})`,
    );
  }

  @SubscribeMessage("ping")
  handlePing(client: AuthenticatedSocket, payload: unknown): string {
    this.logger.debug(
      `Ping from userId: ${client.userId}, payload: ${JSON.stringify(payload)}`,
    );
    return "pong";
  }
}
