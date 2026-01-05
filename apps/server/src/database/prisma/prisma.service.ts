/**
 * PrismaService - 数据库访问层
 *
 * 类型安全说明：
 * 此文件使用 `any` 类型主要是因为 Prisma 中间件的动态特性：
 * 1. 中间件需要动态访问模型 (`this[modelName]`)
 * 2. Prisma 的 $extends API 类型系统需要手动断言
 * 3. 审计系统需要处理任意实体的序列化
 *
 * 所有 `any` 使用都经过审查，在运行时有适当的类型检查。
 */

/* eslint-disable
  @typescript-eslint/no-this-alias,
  @typescript-eslint/no-base-to-string
*/

import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Logger } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import {
  getAuditContext,
  runWithAuditContext,
  runWithoutAudit,
} from "../../common/audit/audit-context";
import { AppConfigService } from "../../config/app-config.service";

const SOFT_DELETE_MODELS = new Set<string>([
  "User",
  "Role",
  "Dictionary",
  "ConfigNamespace",
  "ConfigItem",
]);

/**
 * 审计日志敏感字段列表
 * 这些字段在 before/after 快照中会被替换为 '[REDACTED]'
 */
const SENSITIVE_FIELDS = new Set<string>([
  "password",
  "hashedPassword",
  "passwordHash",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "privateKey",
  "secretKey",
]);

/**
 * JSON 安全序列化结果类型
 * 使用 Prisma.InputJsonValue 以确保与审计日志字段兼容
 */
type JsonSafeValue = Prisma.InputJsonValue;

/**
 * 实体记录基础类型 (用于审计)
 */
interface EntityRecord {
  id?: number | string | bigint;
  [key: string]: unknown;
}

/**
 * Prisma 模型委托接口 (用于动态访问)
 */
interface PrismaModelDelegate {
  findUnique?: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  findFirst?: (args: Record<string, unknown>) => Promise<unknown>;
  count?: (args: { where?: Record<string, unknown> }) => Promise<number>;
  update?: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
  delete?: (args: { where: Record<string, unknown> }) => Promise<unknown>;
}

/**
 * 软删除字段接口
 * 所有支持软删除的模型必须包含这些字段
 */
export interface SoftDeleteFields {
  id: number;
  deletedAt: Date | null;
  deletedById: number | null;
  deleteReason: string | null;
}

/**
 * 软删除操作的审计参数
 */
interface SoftDeleteAuditParams {
  actorUserId?: number;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  reason?: string;
}

/**
 * 支持的软删除模型名称类型
 */
type SoftDeleteModelName =
  | "User"
  | "Role"
  | "Dictionary"
  | "ConfigNamespace"
  | "ConfigItem";

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, "query">
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: AppConfigService) {
    super({
      log: [{ emit: "event", level: "query" }],
    });

    this.$on("query", (e: Prisma.QueryEvent) => {
      const threshold = this.config.prismaSlowQueryMs;
      if (typeof threshold === "number" && e?.duration >= threshold) {
        this.logger.warn(
          {
            durationMs: e.duration,
            target: e.target,
          },
          "[prisma] slow query",
        );
      }
    });
  }
  async onModuleInit() {
    await this.$connect();

    // Global audit middleware for all write operations.
    // Covers future models automatically, as long as writes go through Prisma.
    this.$use(async (params, next) => {
      const ctx = getAuditContext();
      if (!ctx || ctx.disableAudit) {
        return next(params);
      }

      const model = params.model;
      const operation = params.action;

      // Skip non-model operations and avoid recursion on audit table itself.
      if (!model || String(model) === "AuditLog") {
        return next(params);
      }

      const writeOps = new Set([
        "create",
        "createMany",
        "update",
        "updateMany",
        "delete",
        "deleteMany",
        "upsert",
      ]);

      if (!writeOps.has(operation)) {
        return next(params);
      }

      const toJsonSafe = (value: unknown): JsonSafeValue => {
        try {
          return JSON.parse(
            JSON.stringify(value, (key, v: unknown) => {
              // Redact sensitive fields in audit logs
              if (key && SENSITIVE_FIELDS.has(key)) {
                return "[REDACTED]";
              }
              if (typeof v === "bigint") return v.toString();
              if (v instanceof Date) return v.toISOString();
              // Handle Prisma Decimal type to preserve precision
              if (
                v !== null &&
                typeof v === "object" &&
                "toFixed" in v &&
                typeof v.toFixed === "function" &&
                (v as { constructor?: { name?: string } }).constructor?.name ===
                  "Decimal"
              ) {
                return String(v);
              }
              return v;
            }),
          ) as JsonSafeValue;
        } catch {
          return { _unserializable: true };
        }
      };

      const lowerModel = model.charAt(0).toLowerCase() + model.slice(1);
      // Dynamic model access requires type assertion - validated at runtime
      const delegate = (this as unknown as Record<string, PrismaModelDelegate>)[
        lowerModel
      ] as PrismaModelDelegate | undefined;
      const args = (params.args ?? {}) as {
        where?: Record<string, unknown>;
        data?: unknown;
      };

      const deriveEntityId = (result: unknown, isBulk: boolean): string => {
        if (isBulk) {
          // For bulk operations, use where clause hash or 'bulk'
          const where = args.where;
          if (where && Object.keys(where).length > 0) {
            return `bulk:${JSON.stringify(where)}`;
          }
          return "bulk:all";
        }
        const entityResult = result as EntityRecord | null;
        if (entityResult && entityResult.id !== undefined) {
          return String(entityResult.id);
        }
        const where = args.where;
        if (where?.id !== undefined) return String(where.id);
        if (where) return JSON.stringify(where);
        return "*";
      };

      let before: EntityRecord | null = null;
      let affectedCount: number | null = null;
      const where = args.where;
      const isBulkOperation = operation.endsWith("Many");

      if (
        operation === "update" ||
        operation === "delete" ||
        operation === "upsert"
      ) {
        if (delegate?.findUnique && where) {
          before = await runWithoutAudit(async () => {
            try {
              return (await delegate.findUnique!({
                where,
              })) as EntityRecord | null;
            } catch {
              return null;
            }
          });
        }
      }

      // For bulk update/delete, get affected count before operation
      if (
        (operation === "updateMany" || operation === "deleteMany") &&
        delegate?.count
      ) {
        try {
          affectedCount = await runWithoutAudit(() =>
            delegate.count!({ where }),
          );
        } catch {
          // Ignore count failure
        }
      }

      const result = await next(params);

      const action = ctx.actionOverride ?? operation.toUpperCase();
      const entityId = deriveEntityId(result, isBulkOperation);
      const after =
        operation === "delete" || operation === "deleteMany" ? null : result;

      // For bulk operations, store structured data with where, data, and count
      let finalBefore: JsonSafeValue;
      let finalAfter: JsonSafeValue;

      if (isBulkOperation) {
        // Structured bulk operation audit
        finalBefore = toJsonSafe({
          where: args.where,
          affectedCount,
        });
        finalAfter = toJsonSafe({
          data: operation === "createMany" ? args.data : args.data,
          result: result, // { count: n } for most bulk ops
        });
      } else {
        finalBefore = toJsonSafe(before);
        finalAfter = toJsonSafe(after);
      }

      // Write audit log asynchronously but don't fail the business operation
      // if audit fails. Log the error for investigation.
      try {
        await runWithoutAudit(async () => {
          await this.auditLog.create({
            data: {
              action,
              operation,
              entityType: model,
              entityId,
              actorUserId: ctx.actorUserId,
              ip: ctx.ip,
              userAgent: ctx.userAgent,
              requestId: ctx.requestId,
              before: finalBefore,
              after: finalAfter,
            },
          });
        });
      } catch (auditError) {
        // Log audit failure but don't fail the business operation
        this.logger.error(
          {
            error:
              auditError instanceof Error
                ? auditError.message
                : String(auditError),
            action,
            operation,
            entityType: model,
            entityId,
            requestId: ctx.requestId,
          },
          "[prisma] audit log write failed - business operation succeeded",
        );
      }

      return result;
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Soft-delete aware client.
   * - Default filters out soft-deleted rows (deletedAt IS NULL) for models listed in SOFT_DELETE_MODELS
   * - findUnique only rewrites the safe `{ where: { id } }` case to respect deletedAt
   * - Does NOT override delete/deleteMany (best practice: explicit softDelete/restore methods)
   *
   * Note: Type assertions (as SoftDeleteArgs) are required due to Prisma's $extends type system limitations.
   * The args parameter type is generic and doesn't include deletedAt field by default.
   */
  readonly soft = (() => {
    const prisma = this;

    // Type for soft-delete aware query args
    type SoftDeleteArgs = {
      where?: { deletedAt?: Date | null; [key: string]: unknown };
      [key: string]: unknown;
    };

    return prisma.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(String(model))) {
              const typedArgs = args as SoftDeleteArgs;
              if (typedArgs.where?.deletedAt === undefined) {
                typedArgs.where = { ...typedArgs.where, deletedAt: null };
              }
            }
            return query(args);
          },
          async findFirst({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(String(model))) {
              const typedArgs = args as SoftDeleteArgs;
              if (typedArgs.where?.deletedAt === undefined) {
                typedArgs.where = { ...typedArgs.where, deletedAt: null };
              }
            }
            return query(args);
          },
          async findUnique({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(String(model))) {
              const typedArgs = args as SoftDeleteArgs;
              const where = typedArgs.where;
              // Skip if deletedAt is explicitly set (user wants to control it)
              if (where?.deletedAt !== undefined) {
                return query(args);
              }
              // Use findFirst with combined where + deletedAt filter
              // This handles all unique field queries (id, email, etc.)
              const lowerModel =
                String(model).charAt(0).toLowerCase() + String(model).slice(1);
              // Dynamic model access requires type assertion
              const delegate = (
                prisma as unknown as Record<string, PrismaModelDelegate>
              )[lowerModel] as PrismaModelDelegate | undefined;
              if (delegate?.findFirst && where) {
                // Preserve all original args (include, select, etc.)
                const { where: _originalWhere, ...restArgs } = typedArgs;
                void _originalWhere; // Mark as intentionally unused
                return delegate.findFirst({
                  ...restArgs,
                  where: { ...where, deletedAt: null },
                });
              }
            }
            return query(args);
          },
          async count({ model, args, query }) {
            if (SOFT_DELETE_MODELS.has(String(model))) {
              const typedArgs = args as SoftDeleteArgs;
              if (typedArgs.where?.deletedAt === undefined) {
                typedArgs.where = { ...typedArgs.where, deletedAt: null };
              }
            }
            return query(args);
          },
        },
      },
    });
  })();

  /**
   * Raw client access (includes deleted records).
   * Use for admin/audit queries explicitly requiring soft-deleted rows.
   */
  get raw(): PrismaClient {
    return this;
  }

  /**
   * 软删除用户 (User 模型专用便捷方法)
   * @see genericSoftDelete 泛型方法
   */
  async userSoftDelete(params: {
    userId: number;
    actorUserId?: number;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    reason?: string;
  }) {
    return this.genericSoftDelete("User", params.userId, params);
  }

  /**
   * 恢复已软删除的用户 (User 模型专用便捷方法)
   * @see genericRestore 泛型方法
   */
  async userRestore(params: {
    userId: number;
    actorUserId?: number;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    reason?: string;
  }) {
    return this.genericRestore("User", params.userId, params);
  }

  /**
   * 硬删除用户 (User 模型专用便捷方法)
   * 警告: 此操作不可逆，将永久删除用户数据
   * @see genericHardDelete 泛型方法
   */
  async userHardDelete(params: {
    userId: number;
    actorUserId?: number;
    ip?: string;
    userAgent?: string;
    requestId?: string;
    reason?: string;
  }) {
    return this.genericHardDelete("User", params.userId, params);
  }

  // ============================================
  // 泛型软删除方法
  // ============================================

  /**
   * 获取模型委托 (动态访问 Prisma 模型)
   * @param modelName - 模型名称 (首字母大写)
   * @returns 模型委托或 undefined
   */
  private getModelDelegate(modelName: string): PrismaModelDelegate | undefined {
    const lowerModel = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    return (this as unknown as Record<string, PrismaModelDelegate>)[
      lowerModel
    ] as PrismaModelDelegate | undefined;
  }

  /**
   * 验证模型是否支持软删除
   * @param modelName - 模型名称
   * @throws Error 如果模型不在 SOFT_DELETE_MODELS 集合中
   */
  private validateSoftDeleteModel(modelName: string): void {
    if (!SOFT_DELETE_MODELS.has(modelName)) {
      throw new Error(
        `Model "${modelName}" is not configured for soft delete. ` +
          `Add it to SOFT_DELETE_MODELS set first.`,
      );
    }
  }

  /**
   * 泛型软删除方法
   *
   * 将实体标记为已删除 (设置 deletedAt, deletedById, deleteReason)
   * 自动记录审计日志
   *
   * @param modelName - 模型名称 (必须在 SOFT_DELETE_MODELS 中)
   * @param id - 实体主键 ID
   * @param params - 审计参数 (actorUserId, ip, userAgent, requestId, reason)
   * @returns 更新后的实体或 null (如果不存在或已删除)
   *
   * @example
   * ```typescript
   * // 软删除用户
   * const user = await prisma.genericSoftDelete('User', 123, {
   *   actorUserId: currentUser.id,
   *   reason: '违规账户',
   * });
   *
   * // 未来扩展: 软删除订单
   * // 1. 在 schema.prisma 添加 deletedAt/deletedById/deleteReason 字段
   * // 2. 在 SOFT_DELETE_MODELS 添加 'Order'
   * // 3. 更新 SoftDeleteModelName 类型
   * // const order = await prisma.genericSoftDelete('Order', 456, { ... });
   * ```
   */
  async genericSoftDelete<T extends SoftDeleteFields>(
    modelName: SoftDeleteModelName,
    id: number,
    params: SoftDeleteAuditParams = {},
  ): Promise<T | null> {
    this.validateSoftDeleteModel(modelName);
    const delegate = this.getModelDelegate(modelName);

    if (!delegate?.findUnique || !delegate?.update) {
      throw new Error(
        `Model "${modelName}" does not support required operations`,
      );
    }

    return runWithAuditContext(
      {
        actorUserId: params.actorUserId,
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
        actionOverride: `${modelName.toUpperCase()}_SOFT_DELETE`,
      },
      async () => {
        const before = (await delegate.findUnique!({
          where: { id },
        })) as T | null;

        if (!before || before.deletedAt) return before;

        return (await delegate.update!({
          where: { id },
          data: {
            deletedAt: new Date(),
            deletedById: params.actorUserId ?? null,
            deleteReason: params.reason ?? null,
          },
        })) as T;
      },
    );
  }

  /**
   * 泛型恢复方法
   *
   * 恢复已软删除的实体 (清空 deletedAt, deletedById, deleteReason)
   * 自动记录审计日志
   *
   * @param modelName - 模型名称 (必须在 SOFT_DELETE_MODELS 中)
   * @param id - 实体主键 ID
   * @param params - 审计参数
   * @returns 恢复后的实体或 null (如果不存在或未被删除)
   *
   * @example
   * ```typescript
   * const user = await prisma.genericRestore('User', 123, {
   *   actorUserId: adminUser.id,
   *   reason: '误删恢复',
   * });
   * ```
   */
  async genericRestore<T extends SoftDeleteFields>(
    modelName: SoftDeleteModelName,
    id: number,
    params: SoftDeleteAuditParams = {},
  ): Promise<T | null> {
    this.validateSoftDeleteModel(modelName);
    const delegate = this.getModelDelegate(modelName);

    if (!delegate?.findUnique || !delegate?.update) {
      throw new Error(
        `Model "${modelName}" does not support required operations`,
      );
    }

    return runWithAuditContext(
      {
        actorUserId: params.actorUserId,
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
        actionOverride: `${modelName.toUpperCase()}_RESTORE`,
      },
      async () => {
        // Use raw findUnique to find soft-deleted record
        const before = (await delegate.findUnique!({
          where: { id },
        })) as T | null;

        if (!before || !before.deletedAt) return before;

        return (await delegate.update!({
          where: { id },
          data: {
            deletedAt: null,
            deletedById: null,
            deleteReason: null,
          },
        })) as T;
      },
    );
  }

  /**
   * 泛型硬删除方法
   *
   * 永久删除实体 (物理删除)
   * 自动记录审计日志 (包含删除前的完整数据)
   *
   * @param modelName - 模型名称 (必须在 SOFT_DELETE_MODELS 中)
   * @param id - 实体主键 ID
   * @param params - 审计参数
   * @returns 删除前的实体或 null (如果不存在)
   *
   * @example
   * ```typescript
   * // 硬删除用户 (不可恢复)
   * const deletedUser = await prisma.genericHardDelete('User', 123, {
   *   actorUserId: superAdmin.id,
   *   reason: 'GDPR 数据删除请求',
   * });
   * ```
   */
  async genericHardDelete<T extends SoftDeleteFields>(
    modelName: SoftDeleteModelName,
    id: number,
    params: SoftDeleteAuditParams = {},
  ): Promise<T | null> {
    this.validateSoftDeleteModel(modelName);
    const delegate = this.getModelDelegate(modelName);

    if (!delegate?.findUnique || !delegate?.delete) {
      throw new Error(
        `Model "${modelName}" does not support required operations`,
      );
    }

    return runWithAuditContext(
      {
        actorUserId: params.actorUserId,
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
        actionOverride: `${modelName.toUpperCase()}_HARD_DELETE`,
      },
      async () => {
        const before = (await delegate.findUnique!({
          where: { id },
        })) as T | null;

        if (!before) return null;

        await delegate.delete!({ where: { id } });
        return before;
      },
    );
  }
}
