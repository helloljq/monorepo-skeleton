import { INestApplicationContext, Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Server, ServerOptions } from "socket.io";

import { AppConfigService } from "../../config/app-config.service";

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor!: ReturnType<typeof createAdapter>;
  private pubClient?: Redis;
  private subClient?: Redis;

  constructor(
    private app: INestApplicationContext,
    private configService: AppConfigService,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    this.pubClient = new Redis(this.configService.redisUrl);
    this.subClient = this.pubClient.duplicate();

    // Add error listeners for debugging connection issues
    this.pubClient.on("error", (err) => {
      this.logger.error({ err }, "[redis-io-adapter] Pub client error");
    });
    this.subClient.on("error", (err) => {
      this.logger.error({ err }, "[redis-io-adapter] Sub client error");
    });

    // Add reconnect listeners
    this.pubClient.on("reconnecting", (delay: number) => {
      this.logger.warn(
        { delayMs: delay },
        "[redis-io-adapter] Pub client reconnecting",
      );
    });
    this.subClient.on("reconnecting", (delay: number) => {
      this.logger.warn(
        { delayMs: delay },
        "[redis-io-adapter] Sub client reconnecting",
      );
    });

    await this.pubClient.ping();
    await this.subClient.ping();

    this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
    this.logger.log("[redis-io-adapter] Connected successfully");
  }

  createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    // Merge CORS options from config
    const corsOrigins = this.configService.corsOrigins;
    const serverOptions: Partial<ServerOptions> = {
      ...options,
      cors: {
        origin: corsOrigins,
        credentials: true,
        methods: ["GET", "POST"],
      },
    };

    this.logger.log(`WebSocket CORS origins: ${corsOrigins.join(", ")}`);

    const server = super.createIOServer(port, serverOptions) as Server;
    server.adapter(this.adapterConstructor);
    return server;
  }

  /**
   * Gracefully close Redis connections
   * Called when the application shuts down
   */
  async close(): Promise<void> {
    this.logger.log("Closing Redis adapter connections...");

    const closePromises: Promise<void>[] = [];

    if (this.pubClient) {
      closePromises.push(
        this.pubClient.quit().then(() => {
          this.logger.debug("Pub client closed");
        }),
      );
    }

    if (this.subClient) {
      closePromises.push(
        this.subClient.quit().then(() => {
          this.logger.debug("Sub client closed");
        }),
      );
    }

    await Promise.all(closePromises);
    this.logger.log("Redis adapter connections closed");
  }
}
