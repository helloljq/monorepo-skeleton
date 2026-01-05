# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个基于 NestJS 11 的企业级后端服务，使用 Prisma + PostgreSQL + Redis + Socket.io，采用 Zod 做输入校验，所有写操作默认落审计日志。

**关键技术栈**:
- NestJS 11 (TypeScript strict mode)
- Prisma 5 + PostgreSQL (带软删除支持)
- Redis (ioredis) - 缓存、会话、Socket.io 适配器
- Zod + nestjs-zod - 全局输入校验
- Socket.io - WebSocket 支持
- Pino - 结构化日志
- Prometheus - 指标监控

## 常用命令

### 开发与调试
```bash
source ~/.nvm/nvm.sh
pnpm install
pnpm start:dev           # 开发模式 (watch)
pnpm start:debug         # 调试模式
pnpm build               # 生产构建
pnpm start:prod          # 运行生产构建
```

### 代码质量
```bash
pnpm lint                # ESLint 检查
pnpm format              # Prettier 格式化
pnpm arch-check          # 架构依赖检查 (dependency-cruiser)
pnpm soft-delete-check   # 软删除模型一致性检查
```

### 测试
```bash
pnpm test                # 单元测试
pnpm test:watch          # 单元测试 (watch)
pnpm test:cov            # 测试覆盖率
```

### 数据库
```bash
pnpm prisma:generate     # 生成 Prisma Client
pnpm prisma migrate dev  # 创建并应用迁移 (仅本地)
pnpm prisma migrate deploy  # 应用迁移 (生产)
```

## 核心架构设计

### 1. 目录结构 (DDD 风格)

```
src/
├── modules/          # 业务模块 (Feature Modules)
│   ├── auth/        # 认证授权 (JWT 双 token)
│   ├── health/      # 健康检查
│   └── ws/          # WebSocket 网关
├── common/          # 公共基础设施 (无业务语义)
│   ├── adapters/    # WebSocket adapter 等
│   ├── audit/       # 审计上下文管理
│   ├── decorators/  # @Public(), @Idempotent(), @RawResponse()
│   ├── errors/      # BusinessException, 错误码
│   ├── filters/     # 全局异常过滤器
│   ├── interceptors/# 全局拦截器
│   ├── pagination/  # 分页 DTO
│   ├── redis/       # Redis 模块、分布式锁
│   ├── utils/       # 工具函数
│   └── validation/  # Zod helpers
├── config/          # 环境变量校验与配置服务
├── database/        # Prisma 数据库层
└── main.ts          # 应用入口
```

### 2. 强制架构规则

**依赖约束** (`pnpm arch-check`):
- ❌ **禁止**: `src/common/**` → `src/modules/**`
- ✅ **允许**: `src/modules/**` → `src/common/**`, `src/config/**`, `src/database/**`
- `common/` 只能包含无业务语义的通用基础设施

**循环依赖检测**: 已启用，会在 `arch-check` 时发出警告

### 3. 全局拦截器与过滤器 (按执行顺序)

**拦截器链**:
1. `IdempotencyInterceptor` - 幂等性控制 (需 `@Idempotent()` 标记)
2. `AuditContextInterceptor` - 注入审计上下文 (userId, ip, userAgent, requestId)
3. `TransformInterceptor` - 统一响应包装 + BigInt 转 string

**异常过滤器**:
1. `PrismaClientExceptionFilter` - Prisma 异常转换
2. `AllExceptionsFilter` - 所有异常统一格式化

**全局 Guard**:
- `JwtAuthGuard` - 默认全局 JWT 鉴权 (使用 `@Public()` 放行)
- `/metrics` 端点硬编码免鉴权

### 4. 统一响应格式

**成功响应** (自动包装):
```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "timestamp": 1735000000000
}
```

**异常响应**:
```json
{
  "code": 10002,
  "message": "Unauthorized",
  "data": null,
  "timestamp": 1735000000000
}
```

**Raw 响应例外**:
- `/metrics` - 永久 raw 输出 (Prometheus)
- 使用 `@RawResponse()` 装饰器的端点 (文件下载、流式响应)

### 5. 审计系统

**自动审计**: Prisma 全局中间件自动记录所有写操作到 `AuditLog` 表

**审计上下文来源**:
- **HTTP 请求**: `AuditContextInterceptor` 自动注入 (userId, ip, userAgent, requestId)
- **非 HTTP 场景** (WebSocket/定时任务/队列): 必须显式使用 `runWithAuditContext()` 或 `runWithSystemAuditContext()`

**审计字段**:
- `action`: 操作动作 (如 `USER_CREATE`, `ORDER_SOFT_DELETE`)
- `operation`: Prisma 操作 (create/update/delete)
- `entityType/entityId`: 实体类型与 ID
- `actorUserId`: 操作者 ID
- `before/after`: 变更前后的数据快照 (JSON)

### 6. 软删除策略

**实现方式**:
- **禁止**: 依赖 `delete()` 魔法改写
- **必须**: 使用显式方法 (`userSoftDelete()`, `userRestore()`, `userHardDelete()`)

**查询分离**:
- `this.prisma.soft.user.*` - 自动过滤 `deletedAt = null` (活跃用户)
- `this.prisma.raw.user.*` - 包含已删除数据

**新增软删模型 Checklist**:
1. Prisma model 添加 `deletedAt DateTime?`, `deletedById Int?`, `deleteReason String?`
2. 更新 `SOFT_DELETE_MODELS` 集合 (in `PrismaService`)
3. 更新 `SoftDeleteModelName` 类型 (添加新模型名)
4. 运行 `pnpm soft-delete-check` 验证一致性
5. 使用泛型方法: `genericSoftDelete()`, `genericRestore()`, `genericHardDelete()`

### 7. 鉴权与授权

**JWT 双 Token 策略**:
- `POST /api/v1/auth/login` - 返回 accessToken + refreshToken
- `POST /api/v1/auth/refresh` - 使用 refreshToken 刷新
- `POST /api/v1/auth/logout` - 删除 refreshToken (Redis)

**认证头**: `Authorization: Bearer <accessToken>`

**RefreshToken 存储**:
- Redis key 格式: `refresh_token:{userId}:{deviceId}`
- deviceId 必须由客户端生成并持久化 (建议 UUID)

**免鉴权接口**:
- 使用 `@Public()` 装饰器
- `/health` 和 `/metrics` 默认免鉴权

### 8. 幂等性控制

**适用场景**: 支付、扣库存、订单创建等重试敏感操作

**使用方式**:
```typescript
@Post('orders')
@Idempotent()  // 默认 TTL 24h
async createOrder(...) { ... }
```

**客户端要求**:
- Header: `Idempotency-Key: <uuid>`
- 未携带返回 400 (`IDEMPOTENCY_KEY_MISSING`)
- 正在处理返回 409 (`IDEMPOTENCY_IN_PROGRESS`)

**服务端行为**:
- 幂等签名: `userId + method + path + idempotencyKey`
- 缓存首次成功响应，后续重试直接返回

### 9. 分页规范

**请求参数**:
- `page`: 从 1 开始，默认 1
- `limit`: 范围 1-100，默认 10（特殊接口可通过 `@MaxLimit(1000)` 覆盖）

**Service 层返回格式**:
```typescript
return {
  data: [...],
  meta: {
    total: 100,
    page: 1,
    limit: 10,
    totalPages: Math.ceil(total / limit),
  },
};
```

**最终 API 响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  },
  "timestamp": 1735000000000
}
```

**重要**: 所有列表接口必须返回统一的分页格式（带 `data` + `meta`），禁止直接返回数组

### 10. 环境变量

**关键配置** (在 `env.schema.ts` 强校验):
- `PORT` - 默认 8100
- `DATABASE_URL` - PostgreSQL 连接串
- `REDIS_URL` - Redis 连接串
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL` - 默认 15m
- `JWT_REFRESH_TTL` - 默认 7d
- `IDEMPOTENCY_TTL_SECONDS` - 默认 86400
- `PRISMA_SLOW_QUERY_MS` - 慢查询阈值 (默认 500ms)

**访问方式**: 必须通过 `AppConfigService`，禁止直接读取 `process.env`

## 开发规范要点

### DTO 与校验
- **必须**: 使用 Zod 定义 schema，通过 `createZodDto(schema)` 导出 class
- Query 数字必须使用 `z.coerce.number()` 做类型收敛
- BigInt 输入必须显式 transform (`zBigIntFromString()`)
- 标识类字符串建议 `.trim()` (email, username, deviceId 等)

### Controller 职责
- 只做路由、DTO、鉴权注解、Swagger 注解、调用 service
- 禁止写业务规则与数据库逻辑
- 必须有 `@ApiTags()`, `@ApiOperation()`, `@ApiOkResponse()`

### Service 职责
- 承载业务编排与领域规则
- 数据库访问必须走 Prisma
- 跨资源编排必须明确事务边界 (`$transaction`)

### 错误处理
- **HTTP Status**: 语义正确 (200/400/401/403/404/409/500)
- **业务码**: 集中定义在 `error-codes.ts`，禁止 inline number
- 需要精细化错误时使用 `BusinessException`

### 数据库规范
- **金额**: 禁止 Float/Double，必须使用 `Decimal`
- **时间**: 统一 UTC，序列化用 ISO 8601 (`toISOString()`)
- **事务**: 一致性要求必须用 `$transaction`，禁止事务内外部网络请求
- **Migration**: 所有表结构变更必须落 `prisma/migrations/`

### Redis 规范
- 统一注入 `REDIS_CLIENT`，禁止临时连接
- Key 必须有 namespace (`refresh_token:`, `cache:`, `lock:`)
- 除长期配置外必须设置 TTL
- 分布式锁工具: `src/common/redis/redis-lock.ts`

### 测试要求
- Service 单测必须覆盖 happy path + 至少一个异常分支
- 禁止单测直连真实 Redis/DB，必须 mock

### 代码审查拒绝清单
- ❌ 出现 `console.log` (必须用 Logger)
- ❌ 无解释的 `as any`
- ❌ Controller 写业务逻辑
- ❌ 直接读取 `process.env`
- ❌ Magic Number/String (应抽常量/enum)
- ❌ 表结构变更无 migration
- ❌ 软删模型未通过 `soft-delete-check`
- ❌ 导出接口用超大 limit 拉全量
- ❌ 金额使用 Float 或 JS 浮点运算

## 常用服务端点

- **Swagger 文档**: `http://localhost:8100/api`
- **健康检查**: `http://localhost:8100/health`
- **Prometheus 指标**: `http://localhost:8100/metrics`
- **业务接口前缀**: `/api/v1` (如 `POST /api/v1/auth/login`)

## 前端 API 使用文档

如果你是前端开发，查看以下文档获取 API 使用指南：

- **[Dictionary API 前端使用指南](docs/features/DICTIONARY_API_GUIDE.md)** - 字典/配置管理 API（包含性能优化最佳实践）

更多 API 文档请访问 Swagger: `http://localhost:8100/api`

## 详细开发规范

完整开发规范请参考 `docs/DEVELOPMENT_GUIDELINES.md`，包含:
- 非功能性铁律 (质量底线、安全底线)
- API 设计规范 (版本控制、业务错误码)
- 分层职责 (Controller/Service/Module)
- WebSocket 规范
- 可观测性 (日志/健康检查/指标)
- Git 提交规范 (Conventional Commits)
- PR 审查清单

---

## AI 快速参考

> 本节为 AI 辅助开发优化，包含最常用的操作步骤和模式参考。

### 新增 CRUD 模块速查

**1. 创建文件结构**：
```
src/modules/{name}/
├── {name}.module.ts
├── {name}.controller.ts
├── {name}.service.ts
└── dto/
    ├── create-{name}.dto.ts
    ├── update-{name}.dto.ts
    └── {name}-query.dto.ts
```

**2. 添加 Prisma Model** 到 `prisma/schema.prisma`

**3. 生成 Prisma Client**：
```bash
pnpm prisma:generate
```

**4. 如需软删除**，在 Model 添加字段：
```prisma
deletedAt    DateTime?
deletedById  Int?
deleteReason String?   @db.VarChar(500)
```
然后更新 `src/database/prisma/prisma.service.ts`：
- 添加到 `SOFT_DELETE_MODELS` 集合
- 添加到 `SoftDeleteModelName` 类型

**5. 注册模块** 到 `src/app.module.ts` 的 imports

**6. 运行检查**：
```bash
pnpm soft-delete-check  # 如有软删除
pnpm arch-check         # 架构依赖检查
```

### DTO 模板

```typescript
// create-{name}.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const Create{Name}Schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  // ... 其他字段
});

export class Create{Name}Dto extends createZodDto(Create{Name}Schema) {}

// {name}-query.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationQuerySchema } from '../../common/pagination/pagination.dto';

const {Name}QuerySchema = PaginationQuerySchema.extend({
  keyword: z.string().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});

export class {Name}QueryDto extends createZodDto({Name}QuerySchema) {}
```

### Controller 模板

```typescript
@ApiTags('{name}')
@Controller('{name}')
export class {Name}Controller {
  constructor(private readonly {name}Service: {Name}Service) {}

  @Post()
  @ApiOperation({ summary: '创建{中文名}' })
  @ApiOkResponse({ type: {Name}ResponseDto })
  create(@Body() dto: Create{Name}Dto, @CurrentUser() user: JwtPayload) {
    return this.{name}Service.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: '获取{中文名}列表' })
  findAll(@Query() query: {Name}QueryDto) {
    return this.{name}Service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取{中文名}详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.{name}Service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新{中文名}' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Update{Name}Dto,
  ) {
    return this.{name}Service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除{中文名}' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.{name}Service.remove(id);
  }
}
```

### Service 模板（带分页）

```typescript
@Injectable()
export class {Name}Service {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {Name}QueryDto) {
    const { page = 1, limit = 10, keyword } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.{Name}WhereInput = {
      ...(keyword && {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.soft.{name}.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.soft.{name}.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const item = await this.prisma.soft.{name}.findUnique({ where: { id } });
    if (!item) {
      throw new BusinessException({
        code: ApiErrorCode.NOT_FOUND,
        message: '{中文名}不存在',
        status: HttpStatus.NOT_FOUND,
      });
    }
    return item;
  }

  async create(dto: Create{Name}Dto, userId: number) {
    return this.prisma.{name}.create({
      data: { ...dto },
    });
  }

  async update(id: number, dto: Update{Name}Dto) {
    await this.findOne(id); // 确保存在
    return this.prisma.{name}.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.genericSoftDelete('{Name}', id);
  }
}
```

### 模块依赖关系图

```
                    ┌─────────────────┐
                    │   AppModule     │
                    └────────┬────────┘
                             │ imports
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  AuthModule   │   │  UserModule   │   │ 其他业务模块  │
└───────┬───────┘   └───────┬───────┘   └───────────────┘
        │                   │
        │ imports           │ imports
        ▼                   ▼
┌───────────────┐   ┌───────────────┐
│IdentityModule │   │    共享依赖    │
└───────────────┘   │ - DatabaseModule (PrismaService)
                    │ - RedisModule (REDIS_CLIENT)
                    │ - AppConfigModule (AppConfigService)
                    └───────────────┘
```

### 关键数据流

#### 用户认证流程

```
POST /v1/auth/login { email, password, deviceId }
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ AuthController.login()                              │
│   └── AuthService.login()                          │
│         └── IdentityService.validateEmailPassword() │
│               ├── 查找 UserIdentity (provider=EMAIL)│
│               ├── bcrypt.compare(password, hash)    │
│               └── 返回 User + Roles                 │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ AuthService.generateTokens()                        │
│   ├── JWT 签发 accessToken (15m)                    │
│   ├── JWT 签发 refreshToken (7d)                    │
│   └── Redis SET refresh_token:{userId}:{deviceId}   │
│         = SHA256(refreshToken), EX 7d               │
└─────────────────────────────────────────────────────┘
         │
         ▼
{ accessToken, refreshToken, accessExpiresInSeconds }
```

#### Token 刷新流程

```
POST /v1/auth/refresh { refreshToken, deviceId }
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ 1. JWT 验证签名 (JWT_REFRESH_SECRET)                │
│ 2. Redis GET refresh_token:{userId}:{deviceId}      │
│ 3. 对比 SHA256(传入token) === 存储的hash            │
│ 4. 查询用户状态 (是否禁用/删除)                      │
│ 5. 生成新 Token 对，更新 Redis                       │
└─────────────────────────────────────────────────────┘
```

#### 请求处理完整流程

```
HTTP Request
    │
    ▼
┌─ Guards ─────────────────────────────────────────┐
│ 1. CustomThrottlerGuard (限流检查)               │
│ 2. JwtAuthGuard (JWT 验证，@Public 跳过)         │
│ 3. PermissionsGuard (权限检查，@RequirePermissions)│
└──────────────────────────────────────────────────┘
    │
    ▼
┌─ Interceptors (前置) ───────────────────────────┐
│ 1. IdempotencyInterceptor (幂等检查)            │
│ 2. AuditContextInterceptor (注入审计上下文)      │
│ 3. MaxLimitInterceptor (分页 limit 限制)         │
└──────────────────────────────────────────────────┘
    │
    ▼
┌─ Pipes ─────────────────────────────────────────┐
│ ZodValidationPipe (DTO 校验)                     │
└──────────────────────────────────────────────────┘
    │
    ▼
┌─ Controller → Service → Prisma ─────────────────┐
│ 业务逻辑执行                                      │
│ Prisma 中间件自动记录审计日志                     │
└──────────────────────────────────────────────────┘
    │
    ▼
┌─ Interceptors (后置) ───────────────────────────┐
│ TransformInterceptor (响应包装)                  │
│ { code: 0, message: 'success', data, timestamp } │
└──────────────────────────────────────────────────┘
    │
    ▼
HTTP Response
```

#### 审计日志写入流程

```
任意 Prisma 写操作 (create/update/delete)
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ Prisma $use 中间件拦截                              │
│   ├── 检查 AuditContext (来自 AsyncLocalStorage)    │
│   ├── 跳过 AuditLog 表本身 (防递归)                 │
│   ├── 获取变更前数据 (update/delete 时)             │
│   ├── 执行原操作                                    │
│   ├── 敏感字段脱敏 (password → [REDACTED])          │
│   └── 异步写入 AuditLog (不阻塞业务)                │
└─────────────────────────────────────────────────────┘
```

### 错误码速查

| 范围 | 域 | 示例 |
|------|---|------|
| 0 | 成功 | `SUCCESS_CODE = 0` |
| 10000-10999 | 通用协议 | `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR` |
| 11000-11999 | Auth | `AUTH_INVALID_CREDENTIALS`, `AUTH_TOKEN_EXPIRED` |
| 12000-12999 | User/Role | `USER_NOT_FOUND`, `ROLE_SYSTEM_IMMUTABLE` |
| 13000-13999 | Dictionary | `DICT_NOT_FOUND`, `DICT_KEY_EXISTS` |
| 14000-14999 | ConfigCenter | `CONFIG_ITEM_NOT_FOUND`, `CONFIG_ROLLBACK_FAILED` |
| 20000-20999 | 系统错误 | `DATABASE_ERROR`, `REDIS_ERROR` |

完整错误码定义: `src/common/errors/error-codes.ts`

### 环境变量速查

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✅ | - | PostgreSQL 连接串 |
| `REDIS_URL` | ✅ | - | Redis 连接串 |
| `JWT_ACCESS_SECRET` | ✅ | - | Access Token 密钥 (≥32字符) |
| `JWT_REFRESH_SECRET` | ✅ | - | Refresh Token 密钥 (≥32字符) |
| `PORT` | - | 8100 | 服务端口 |
| `JWT_ACCESS_TTL` | - | 15m | Access Token 有效期 |
| `JWT_REFRESH_TTL` | - | 7d | Refresh Token 有效期 |
| `RATE_LIMIT_MAX` | - | 100 | 每窗口最大请求数 |
| `PRISMA_SLOW_QUERY_MS` | - | 500 | 慢查询阈值 (ms) |

### 常见任务命令速查

| 任务 | 命令 |
|------|------|
| 启动开发服务 | `pnpm start:dev` |
| 添加数据库字段 | `pnpm prisma migrate dev --name add_xxx_field` |
| 重新生成 Prisma Client | `pnpm prisma:generate` |
| 查看数据库 | `pnpm prisma studio` |
| 运行单个测试文件 | `pnpm test -- --testPathPattern=user.service` |
| 运行单个测试用例 | `pnpm test -- -t "should create user"` |
| 检查架构依赖 | `pnpm arch-check` |
| 检查软删除一致性 | `pnpm soft-delete-check` |
| 生成 Swagger JSON | 访问 `http://localhost:8100/api-json` |

### AI 常见错误提醒

以下是 AI 辅助开发时容易犯的错误，请注意避免：

| 错误 | 正确做法 |
|------|---------|
| 使用 `console.log` | 使用 `Logger` (`@nestjs/common`) |
| 直接 `process.env.XXX` | 使用 `AppConfigService` |
| Controller 写业务逻辑 | 业务逻辑放 Service |
| 返回裸数组 `return items` | 返回分页格式 `{ data, meta }` |
| `this.prisma.user.delete()` | 使用 `genericSoftDelete('User', id)` |
| `this.prisma.user.findMany()` | 使用 `this.prisma.soft.user.findMany()` |
| 硬编码错误码 `throw new HttpException('error', 400)` | 使用 `BusinessException` + `ApiErrorCode` |
| 忘记 Swagger 注解 | 必须有 `@ApiTags`, `@ApiOperation`, `@ApiOkResponse` |
