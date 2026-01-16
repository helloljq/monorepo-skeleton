# 数据库初始化指南

本文档说明如何为不同环境初始化数据库。

## 目录

- [新环境初始化](#新环境初始化)
- [现有数据库迁移](#现有数据库迁移)
- [迁移文件说明](#迁移文件说明)
- [常见问题](#常见问题)

---

## 新环境初始化

### 前提条件

- PostgreSQL 14+ 已安装并运行
- Redis 6+ 已安装并运行
- Node.js 18+ 和 pnpm 已安装

### 步骤

#### 1. 创建数据库

```bash
# 使用 psql 创建数据库
createdb mydb

# 或使用 SQL
psql -U postgres -c "CREATE DATABASE mydb;"
```

#### 2. 配置环境变量

复制 `.env.example` 并修改数据库连接信息：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
REDIS_URL="redis://localhost:6379"
```

#### 3. 应用数据库迁移

```bash
# 安装依赖
pnpm install

# 应用所有迁移
pnpm prisma migrate deploy
```

#### 4. 生成 Prisma Client

```bash
pnpm prisma:generate
```

#### 5. 验证数据库状态

```bash
# 查看迁移状态
pnpm prisma migrate status
```

---

## 现有数据库迁移

如果你的数据库已经有数据（从旧版本升级或从其他来源导入），请按以下步骤操作。

### 场景 A: 数据库与 baseline 兼容

如果现有数据库结构与 `202512230000_baseline` 迁移前的状态一致：

```bash
# 1. 标记 baseline 为已应用（不实际执行 SQL）
pnpm prisma migrate resolve --applied 202512230000_baseline

# 2. 应用后续迁移
pnpm prisma migrate deploy
```

### 场景 B: 数据库需要手动同步

如果数据库结构与迁移历史不一致：

```bash
# 1. 检查迁移状态
pnpm prisma migrate status

# 2. 对每个需要跳过的迁移执行 resolve
pnpm prisma migrate resolve --applied <migration_name>

# 3. 应用剩余迁移
pnpm prisma migrate deploy
```

---

## 迁移文件说明

### 迁移历史

| 迁移名称                                | 描述                 | 关键变更                                     |
| --------------------------------------- | -------------------- | -------------------------------------------- |
| `202512230000_baseline`                 | 基准迁移             | 空迁移，用于标记现有数据库状态               |
| `202512230001_soft_delete_audit`        | 软删除 + 审计日志    | User 软删除字段、AuditLog 表                 |
| `202512230002_audit_action_string`      | 审计日志升级         | action 枚举转 text、添加 operation/requestId |
| `202512240001_drop_refresh_token_table` | 移除 RefreshToken 表 | 改用 Redis 存储                              |

### baseline 迁移说明

`202512230000_baseline` 是一个**空迁移**，用于以下目的：

1. **标记数据库初始状态** - 对于已有数据的数据库，标记为 baseline 后的迁移才需要应用
2. **简化初始化流程** - 新环境直接运行全部迁移即可
3. **保持迁移历史连贯** - 确保所有环境的迁移记录一致

### 创建新迁移

```bash
# 开发环境：创建并应用迁移
pnpm prisma migrate dev --name <migration_name>

# 生产环境：仅应用迁移
pnpm prisma migrate deploy
```

---

## 常见问题

### Q: "Migration not found" 错误

**原因**: 迁移文件被删除或重命名。

**解决方案**:

```bash
# 查看数据库中已记录的迁移
psql $DATABASE_URL -c "SELECT * FROM _prisma_migrations ORDER BY started_at;"

# 如果迁移确实已应用，标记为已解决
pnpm prisma migrate resolve --rolled-back <migration_name>
```

### Q: "Migration has not been applied" 警告

**原因**: 迁移文件存在但未在数据库中记录。

**解决方案**:

```bash
# 如果数据库结构已与迁移一致
pnpm prisma migrate resolve --applied <migration_name>

# 如果需要实际应用
pnpm prisma migrate deploy
```

### Q: 软删除模型如何添加？

1. 在 `schema.prisma` 添加软删除字段：

   ```prisma
   model Order {
     id           Int       @id @default(autoincrement())
     // ... 其他字段

     deletedAt    DateTime?
     deletedById  Int?
     deleteReason String?

     deletedBy    User?     @relation("OrderDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)
   }
   ```

2. 更新 `PrismaService` 中的 `SOFT_DELETE_MODELS`:

   ```typescript
   const SOFT_DELETE_MODELS = new Set<string>(["User", "Order"]);
   ```

3. 更新 `SoftDeleteModelName` 类型:

   ```typescript
   type SoftDeleteModelName = "User" | "Order";
   ```

4. 运行一致性检查：
   ```bash
   pnpm soft-delete-check
   ```

### Q: 如何备份数据库？

```bash
# 备份
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 恢复
psql $DATABASE_URL < backup_20251224_120000.sql
```

---

## 相关文档

- [开发规范](./development-guidelines.md) - 数据库规范章节
- [Prisma 官方文档](https://www.prisma.io/docs)
