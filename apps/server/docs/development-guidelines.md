## 后端开发规范（最细化版）

本规范是本项目后续所有业务开发的唯一标准。所有代码变更必须同时满足：可读、可测、可审计、可回滚、可演进。

**适用范围**：`src/`、`prisma/`、`docs/`、CI 与工程配置。

**强制约束来源**：以仓库当前实现为准（全局拦截器/过滤器、Prisma 审计、鉴权 guard、`dependency-cruiser` 规则）。文档不允许与实现相冲突。

---

## 规范强度等级定义（减少 Review 摩擦）

为避免“这是必须还是建议？”产生争议，本文约定三档强度：

- **【强制】**：违反即拒绝 PR（必须修正或给出等价替代方案并获得维护者明确同意）。
- **【推荐】**：允许不执行，但 PR 必须写明理由与风险评估。
- **【建议】**：经验性最佳实践，可按场景选择。

标注规则：

- 文档中涉及“必须/禁止/严禁/不得”的规则类条目，默认视为 **【强制】**（即使未显式标注）。
- 示例、背景说明、非规则性段落不参与强度判定。

章节编号锁定策略：

- 章节编号一旦发布即视为锁定。
- 后续新增内容 **只允许追加（append）到文档末尾**，不允许插入到中间导致编号大规模漂移。

---

## 1. 快速总览（十分钟上手）

- **【建议】框架**：NestJS 11，TypeScript strict
- **【建议】验证**：Zod + `nestjs-zod`（全局 `ZodValidationPipe`）
- **【建议】数据库**：PostgreSQL + Prisma 5
- **【建议】缓存/消息**：Redis（ioredis），同时用于 Socket.io Redis Adapter
- **【建议】统一响应**：全局 `TransformInterceptor` 包装 `{ code, message, data, timestamp }`，并递归把 `bigint` 转 string
- **【建议】异常格式**：全局过滤器输出 `{ code, message, data: null, timestamp }`
- **【建议】鉴权**：全局 `JwtAuthGuard`，使用 `@Public()` 放行；`/metrics` 永久免鉴权且 raw 返回
- **【建议】审计**：Prisma 全局中间件记录所有写操作到 `AuditLog`；HTTP 请求上下文由 `AuditContextInterceptor` 注入
- **【建议】架构守护**：`depcruise` 禁止 `src/common/**` 依赖 `src/modules/**`

---

## 2. 非功能性铁律（必须遵守）

### 2.1 质量底线

- **【强制】禁止隐式魔法**：关键行为必须显式表达，不允许“看起来是 A，实际做了 B”。
- **【强制】禁止绕开审计**：业务写操作必须走 Prisma（默认自动落审计）；直写 SQL 需要专项评审与等价审计方案。
- **【强制】输入必须校验**：body/query/param 都必须经过 Zod 校验；不允许用 service 层手写 if 代替。
- **【强制】错误必须可定位**：返回的 status 与 message 必须稳定可预期；需要全链路定位时必须能关联到 requestId。
- **【强制】`common/` 不得出现业务语义**：只允许跨模块通用基础设施。

### 2.2 安全底线

- **【强制】敏感信息禁止出现在日志/审计**：密码、refreshToken、数据库连接串、完整 Authorization 头都不允许记录。
- **【强制】生产环境不泄露内部细节**：对外错误信息要克制；内部细节只在日志中出现。
- **【强制】密码必须使用 bcrypt hash**：严禁存明文密码或可逆加密密码。
- **【强制】时间与时区必须统一**：所有服务端时间处理必须以 UTC 为准（详见 8.7），禁止依赖部署机器本地时区做业务判断/序列化。

---

## 3. 目录结构与依赖规则（DDD 风格）

### 3.1 目录说明

- `src/modules/`：业务模块（Feature Modules）
- `src/common/`：公共设施（无业务语义）
- `src/config/`：配置与环境变量校验
- `src/database/`：数据库层（Prisma）
- `scripts/`：脚本目录（详见 3.1.1）

#### 3.1.1 scripts/ 目录规范

| 子目录         | 用途                             | Git 状态     | 示例                       |
| -------------- | -------------------------------- | ------------ | -------------------------- |
| `scripts/`     | 正式脚本（构建、部署、数据迁移） | ✅ 提交      | `scripts/migrate-data.ts`  |
| `scripts/dev/` | 临时调试脚本（本地开发用）       | ❌ gitignore | `scripts/dev/check-xxx.js` |

**【强制】临时调试脚本必须放在 `scripts/dev/` 目录**，禁止放在项目根目录或其他位置。

使用示例：

```bash
# 执行调试脚本
node scripts/dev/check-cookie.js
```

**【建议】调试完成后及时清理 `scripts/dev/` 中不再需要的脚本**。

### 3.2 强制依赖规则

- **【强制】禁止**：`src/common/**` → `src/modules/**`（`pnpm arch-check` 强制）
- **【强制】允许**：`src/modules/**` → `src/common/**`、`src/config/**`、`src/database/**`
- **【建议】模块之间不要互相 import service**：如出现跨域依赖，优先抽接口或抽新模块
- **【建议】`src/common/**` 内部避免循环依赖**：工具类互相引用会导致测试困难；仓库已启用循环依赖检测（`depcruise`）。

### 3.3 `src/common/` 允许清单（可执行）

允许包含（必须满足“无业务语义、跨模块复用”的前提）：

- **【强制】技术基础设施**：logger、redis、Prisma wrapper、HTTP client wrapper、WebSocket adapter、全局拦截器/过滤器/guard 等。
- **【强制】跨模块通用 DTO/契约**：分页（pagination）、幂等（idempotency）等通用协议。
- **【强制】通用错误类型与错误码**：`BusinessException`、`ApiErrorCode` 等集中定义。
- **【强制】纯工具函数**：不包含围绕具体业务名词的条件判断（例如不允许 `if (order.status === ...)` 这种业务判断）。

明确禁止：

- **【强制】任何围绕某个业务名词的规则/判断**：例如 “订单状态机”“库存扣减规则”“用户等级计算”等必须放到对应 `src/modules/<domain>/`。
- **【强制】跨模块复用但带业务语义的代码**：宁可抽出更小的无语义工具，再由各业务模块组合。

---

## 4. 配置与环境变量（强类型）

### 4.1 规则

- **【强制】禁止**：业务代码直接读取 `process.env`
- **【强制】必须**：通过 `AppConfigService` 获取配置
- **【强制】必须**：所有环境变量在 `env.schema.ts` 中声明并校验，启动时校验失败直接退出

### 4.2 当前关键配置项

- **【建议】`PORT`**（默认 8100）
- **【建议】`DATABASE_URL`**
- **【建议】`REDIS_URL`**
- **【建议】`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`**
- **【建议】`JWT_ACCESS_TTL`（默认 `15m`）/ `JWT_REFRESH_TTL`（默认 `7d`）**

---

## 5. API 规范（Controller 层）

### 5.1 路由与方法

- **【推荐】资源名使用复数**：`/users`、`/orders`
- **【推荐】`GET /resource`**：列表（分页、筛选）
- **【强制】`GET /resource/:id`**：详情（找不到必须返回 404）
- **【推荐】`POST /resource`**：创建
- **【推荐】`PATCH /resource/:id`**：局部更新
- **【推荐】`DELETE /resource/:id`**：删除（默认逻辑删除；硬删必须走显式方法）

### 5.2 统一响应格式（强制）

除非使用 `@RawResponse()` 或命中 `/metrics`，所有成功响应都包装为：

```json
{
  "code": 0,
  "message": "success",
  "data": null,
  "timestamp": 1735000000000
}
```

补充规则：

- **【强制】BigInt 序列化**：响应体内任何 `bigint` 会递归转换为 string，避免前端精度丢失。
- **【强制】code/HTTP status 语义**：`code` 为**业务码**，HTTP status 仍保持语义正确（200/400/401/403/404/409/500...）。

### 5.3 Raw 响应（严格限制）

- **【强制】`/metrics` 必须 raw**：Prometheus 要求 `text/plain`，系统已在拦截器与 guard 中硬编码放行。
- **【强制】其他 raw 场景必须使用 `@RawResponse()`**：如文件下载、流式返回。

### 5.4 异常响应格式（强制）

所有异常统一输出：

```json
{
  "code": 10002,
  "message": "Unauthorized",
  "data": null,
  "timestamp": 1735000000000
}
```

规则：

- **【强制】HTTP status 语义正确**：例如未授权=401，找不到=404。
- **【强制】code 为业务错误码**：用于前端精细化提示与分支处理。
- **【强制】message 稳定可读**：能作为前端提示或错误定位依据。

### 5.5 DTO 与校验（强制）

- **【强制】DTO 使用 Zod**：使用 Zod 定义 schema，并用 `createZodDto(schema)` 导出 class。
- **【强制】Query 数字必须收敛**：Query 中的数字必须用 `z.coerce.number()` 做类型收敛。
- **【强制】Query 布尔值必须使用专用转换函数**：Query 中的布尔值（如 `isEnabled`）**禁止**使用 `z.coerce.boolean()`，**必须**使用 `zBooleanFromString()`（`src/common/validation/zod-helpers.ts`）。原因：`z.coerce.boolean()` 会将所有非空字符串（包括 `"false"`）转换为 `true`，导致过滤条件失效。
- **【推荐】标识类字符串默认 trim**：email/username/deviceId/手机号/邀请码等字段建议使用 `.trim()`（或公共 helper），避免空格导致查询/唯一性不匹配。
- **【强制】BigInt 输入处理**：前端 ID 类字段通常以 String 传递；DTO 层必须显式 transform（例如 `zBigIntFromString()`）后再进入 service，禁止把 BigInt 直接暴露在 JSON 序列化层。
- **【强制】验证错误消息必须使用中文**：所有 Zod 验证规则必须提供中文错误消息，因为这些消息会通过 API 响应直接暴露给前端用户。禁止使用英文或默认的验证消息。

**示例 1：中文错误消息**：

```typescript
// ✅ 正确：提供中文错误消息
const passwordSchema = z
  .string()
  .min(8, "密码长度至少为 8 个字符")
  .regex(/[A-Z]/, "密码必须包含至少一个大写字母");

// ❌ 错误：使用英文或不提供自定义消息
const passwordSchema = z
  .string()
  .min(8) // 缺少自定义消息
  .regex(/[A-Z]/, "Password must contain uppercase"); // 英文消息
```

**示例 2：Query 布尔值正确转换**：

```typescript
import { zBooleanFromString } from "../../../common/validation/zod-helpers";

// ✅ 正确：使用 zBooleanFromString()
export const QueryPermissionSchema = z.object({
  isEnabled: zBooleanFromString().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// ❌ 错误：使用 z.coerce.boolean()
export const QueryPermissionSchema = z.object({
  isEnabled: z.coerce.boolean().optional(), // ⚠️ "false" 会被转换为 true！
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// 原因：z.coerce.boolean() 的转换行为
z.coerce.boolean().parse("false"); // ❌ 返回 true（所有非空字符串都是 true）
z.coerce.boolean().parse("0"); // ❌ 返回 true

// zBooleanFromString() 的正确行为
zBooleanFromString().parse("false"); // ✅ 返回 false
zBooleanFromString().parse("true"); // ✅ 返回 true
zBooleanFromString().parse("0"); // ✅ 返回 false
zBooleanFromString().parse("1"); // ✅ 返回 true
```

**验证错误响应格式**：

```json
{
  "code": 10001,
  "message": "Validation failed",
  "data": {
    "errors": [
      {
        "path": ["password"],
        "message": "密码必须包含至少一个大写字母",
        "code": "invalid_format"
      }
    ]
  }
}
```

### 5.8 幂等性（Idempotency Key）

适用：支付、扣库、订单创建等“网络重试会导致重复写入”的接口。

- **【强制】客户端必须传幂等键**：Header `Idempotency-Key: <uuid>`。
- **【强制】服务端幂等签名**：以 `userId + method + path + idempotencyKey` 作为幂等签名，缓存“首次成功的响应结果”并在后续重试直接返回。
- **【建议】工具**：`@Idempotent()`（`src/common/decorators/idempotent.decorator.ts`）+ 全局 `IdempotencyInterceptor`。
- **【强制】约束**：
  - 仅对 `POST/PUT/PATCH/DELETE` 生效；
  - 未携带 Key 返回 400（业务码 `IDEMPOTENCY_KEY_MISSING`）；
  - 正在处理返回 409（业务码 `IDEMPOTENCY_IN_PROGRESS`）；
  - 默认结果缓存 TTL 为 24h（可按接口覆盖）。

### 5.9 业务错误码制度（制度化，避免“1 年后后悔”）

- **【强制】集中定义**：所有业务错误码必须集中定义在 `src/common/errors/error-codes.ts`，禁止在业务代码里写 inline number。
- **【强制】分段管理**：按“域/模块”划分区间（示例）：
  - `10000-10999`：通用协议错误（如鉴权/参数/幂等）
  - `11000-11999`：Auth 域
  - `12000-12999`：User 域
  - `20000-20999`：系统/依赖错误（DB/Redis/外部调用）
- **【推荐】编码规则**：同一错误语义在全系统只能有一个 code；变更 code 需要迁移方案并更新文档。
- **【强制】抛错方式**：需要精细化错误码时，使用 `BusinessException`（`src/common/errors/business.exception.ts`）。

备注：

- 文档示例中使用 enum 只是示意；本项目当前采用 `const ApiErrorCode = { ... } as const` + `type ApiErrorCode = ...` 的方式，同样满足“集中定义/类型约束/禁 inline”。

### 5.6 API 版本控制（Versioning）

- **【推荐】策略**：URI 版本（推荐），统一前缀 `/v1`。
- **【推荐】目的**：为未来破坏性变更预留通道；旧版本可并行维护并逐步下线。
- **【推荐】例外**：探针与指标建议不加版本前缀：
  - `GET /health`
  - `GET /metrics`

#### 5.6.1 Controller 装饰器路径规范（强制）

本项目通过 `main.ts` 中的 `app.setGlobalPrefix('v1', { exclude: [...] })` 统一设置全局前缀，Controller 装饰器**只需写资源名**，无需重复添加版本前缀。

- **【强制】业务接口**：Controller 只写资源名（复数形式），系统自动添加 `/v1` 前缀。

  ```typescript
  // ✅ 正确 - 最终路径为 /v1/users
  @Controller('users')
  @Controller('roles')
  @Controller('auth')
  @Controller('orders')

  // ❌ 错误 - 会导致路径重复 /v1/v1/users
  @Controller('v1/users')
  ```

- **【强制】系统接口**：健康检查与指标端点已在全局前缀中排除，直接使用资源名。

  ```typescript
  // ✅ 正确 - 最终路径为 /health、/metrics
  @Controller('health')
  @Controller('metrics')
  ```

- **【强制】嵌套资源**：子资源路径在 Controller 或方法级别定义。

  ```typescript
  // 方式一：Controller 定义父资源，方法定义子资源
  @Controller("users")
  class UserController {
    @Get(":userId/roles") // 最终路径 /v1/users/:userId/roles
    getUserRoles() {}
  }

  // 方式二：Controller 完整定义嵌套路径
  @Controller("users/:userId/roles")
  class UserRolesController {}
  ```

**全局前缀配置**（`src/main.ts`）：

```typescript
app.setGlobalPrefix("v1", {
  exclude: [
    { path: "health", method: RequestMethod.ALL },
    { path: "metrics", method: RequestMethod.ALL },
  ],
});
```

**规范依据**：

- 全局前缀集中管理，避免各 Controller 重复声明
- 版本前缀便于 API 演进与多版本并行
- 复数资源名符合 RESTful 语义
- 系统端点不需要版本控制（探针/指标通常无破坏性变更）

### 5.7 Swagger/OpenAPI 文档标准

- **【强制】Controller 必须有 `@ApiTags('...')`**。
- **【强制】路由方法必须有 `@ApiOperation({ summary: '...' })`**。
- **【强制】路由方法必须声明响应（至少成功响应）**：
  - 成功：`@ApiOkResponse(...)` 或 `@ApiResponse({ status: 200, ... })`
  - 常见错误：按需补 `@ApiResponse({ status: 400/401/403/404/409, ... })`

说明：本项目强依赖 Swagger 作为前端/测试对接依据，因此不接受“接口无摘要/无响应定义”的提交。

---

## 6. 分页规范（强制）

### 6.1 请求参数

- **【强制】`page`**：从 1 开始，默认 1
- **【强制】`limit`**：范围 1–100，默认 10

DTO：`src/common/pagination/pagination.dto.ts`

#### 特殊场景：扩大 limit 上限

**【推荐】** 如果确认某接口数据总量有限（如系统配置项、字典列表等），可通过装饰器覆盖默认上限：

```typescript
@Get('configs')
@MaxLimit(500)  // 覆盖默认的 100 上限
async getAllConfigs(@Query() query: PaginationQueryDto) { ... }
```

注意事项：

- 必须在代码注释中说明为何需要扩大 limit（如"配置项总量不超过 200 条"）
- 禁止用于常规业务数据导出，大数据量导出应使用流式下载或分批处理

### 6.2 返回结构

**【强制】所有列表接口必须返回统一的分页格式**，即使数据量很小或不需要分页，也应保持 API 一致性。

Service 层返回格式：

```typescript
return {
  data: [...],  // 列表数据数组
  meta: {
    total: 100,      // 总记录数
    page: 1,         // 当前页码
    limit: 10,       // 每页数量
    totalPages: 10,  // 总页数
  },
};
```

经过全局 `TransformInterceptor` 包装后，最终响应格式：

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

**说明**：

- **【强制】`data` 字段**：必须是数组，包含当前页的记录
- **【强制】`meta` 字段**：必须包含 `total`、`page`、`limit`、`totalPages` 四个字段
- **【强制】一致性要求**：所有列表查询接口（`GET /resources`）都必须遵循此格式，禁止直接返回数组
- **【推荐】计算总页数**：`totalPages = Math.ceil(total / limit)`

**反例**（禁止）：

```typescript
// ❌ 错误：直接返回数组
return configs.map(...);

// ❌ 错误：缺少 meta
return { data: [...] };
```

**正例**：

```typescript
// ✅ 正确：带 meta 的分页格式
const [data, total] = await Promise.all([
  this.prisma.xxx.findMany({ where, skip, take: limit }),
  this.prisma.xxx.count({ where }),
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
```

### 6.3 导出/大数据量场景（必须单独设计）

- **【强制】禁止**：把 `limit` 放大到几千/几万来"导出数据"，这会压垮数据库与服务内存。
- **【推荐】推荐方案**：
  - **【推荐】导出接口**：使用 `@RawResponse()` + Stream（CSV/JSONL）或异步任务（生成文件后下载）。
  - **【推荐】管理/内部接口**：如确有需要突破 100，必须满足：权限校验（Admin）、限流、审计、并对数据库查询加索引与超时保护。

#### 6.3.1 导出场景替代方案

| 场景                       | 推荐方案                  | 说明                                            |
| -------------------------- | ------------------------- | ----------------------------------------------- |
| 小批量导出（<1000条）      | `@MaxLimit(1000)`         | 配置项、字典等数据量有限的接口                  |
| 中批量导出（1000-10000条） | 游标分页 + 前端拼接       | 使用 `cursor` 参数替代 `page`，前端循环请求拼接 |
| 大批量导出（>10000条）     | 异步任务 + 文件下载       | 后台生成 CSV/Excel，完成后通知用户下载          |
| 实时流式导出               | `@RawResponse()` + Stream | 流式返回 CSV/JSONL，适合日志等场景              |

**游标分页示例**：

```typescript
// DTO
const CursorPaginationSchema = z.object({
  cursor: z.coerce.number().int().optional(), // 上一页最后一条的 ID
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

// Service
async findWithCursor(cursor?: number, limit = 100) {
  return this.prisma.order.findMany({
    where: cursor ? { id: { gt: cursor } } : undefined,
    orderBy: { id: 'asc' },
    take: limit,
  });
}
```

**下拉选择全量数据场景**：

对于"下拉选择需要全部选项"的场景：

- **【推荐】配置类数据**：使用 `@MaxLimit(500)` 并说明理由
- **【推荐】业务数据**：使用搜索 + 分页（前端输入关键字后加载匹配项）
- **【推荐】高频选择**：前端缓存选项列表，后端提供增量更新接口

---

## 7. 鉴权与授权（Auth 模块）

### 7.1 默认策略

- **【强制】默认所有接口都需要 JWT**：全局 `JwtAuthGuard`。
- **【强制】免鉴权接口使用 `@Public()`**。
- **【强制】认证头**：`Authorization: Bearer 访问令牌`。

### 7.2 双 Token（当前实现）

- **【建议】`POST /auth/login`**：成功返回 accessToken、refreshToken、accessExpiresInSeconds
- **【建议】`POST /auth/refresh`**：校验 refreshToken 后签发新 tokens
- **【建议】refreshToken 存储**：存于 Redis，key 由 `userId` 与 `deviceId` 拼接组成，例如 `refresh_token:42:ios-2f4b9a74-1b2c-4b95-9e9c-8c7d7f7b0b7a`
- **【建议】`POST /auth/logout`**：删除该 deviceId 对应的 refreshToken

### 7.3 deviceId 规范（强制）

- **【强制】deviceId 必须由客户端生成并持久化**（建议 UUID）。
- **【强制】login/refresh/logout 必须携带同一 deviceId**。

---

## 8. 数据库规范（Prisma + PostgreSQL）

### 8.1 Prisma 使用原则

- **【强制】统一注入 `PrismaService`**：禁止自行 new PrismaClient。
- **【强制】活跃用户查询默认使用 `this.prisma.soft.user.*`**：过滤 `deletedAt = null`。
- **【强制】需要包含已删除数据时使用 `this.prisma.raw.user.*`**。

说明：软删过滤通过 `PrismaService` 内部的 `SOFT_DELETE_MODELS` 统一管理；新增含 `deletedAt` 的 model 时必须同步更新该集合，并运行 `pnpm soft-delete-check` 防止遗漏。

### 8.2 软删除（显式方法）

- **【强制】禁止**：依赖 `delete()` 魔法改写做软删。
- **【强制】必须**：使用显式方法，并保证有审计上下文。

当前已实现：

- `PrismaService.userSoftDelete()`
- `PrismaService.userRestore()`
- `PrismaService.userHardDelete()`

### 8.3 审计（强制）

- **【强制】写操作必须可审计**：所有 Prisma 写操作都会被全局中间件写入 `AuditLog`。
- **【强制】请求上下文来源**：`AuditContextInterceptor`（actorUserId/ip/userAgent/requestId）。
- **【推荐】语义化审计动作**：需要语义化审计动作时，使用 `runWithAuditContext({ actionOverride })` 覆盖默认动作名。

#### 8.3.1 跳过审计（@SkipAudit）

**【推荐】** 对于高频低敏感操作，可使用 `@SkipAudit()` 装饰器跳过审计日志：

```typescript
import { SkipAudit } from '../../../common/decorators/skip-audit.decorator';

@Post('read-status')
@SkipAudit() // 消息已读状态变更频繁，无需审计
async markAsRead(@Body() dto: MarkAsReadDto) { ... }
```

**适用场景**：

- 高频低敏感操作（消息已读状态、用户在线心跳、浏览记录）
- 内部健康检查或状态更新
- 批量数据同步等性能敏感场景

**禁用场景**（**【强制】** 以下操作禁止使用 `@SkipAudit()`）：

- 用户创建/删除/权限变更
- 资金相关操作（支付、退款、余额变更）
- 敏感数据访问或修改
- 任何需要合规审计的操作

**使用要求**：

- PR 中必须说明跳过审计的理由
- 代码评审时需确认操作确实不需要审计追踪

### 8.4 事务规范

- **【强制】一致性要求必须用 `$transaction`**：先读后写且要求一致性的逻辑必须使用 `$transaction`。
- **【强制】事务内禁止外部网络请求**：避免长事务与不可控阻塞。

### 8.5 Migration 规范

- **【强制】所有表结构变更必须落 migrations**：`prisma/migrations/**/migration.sql`。
- **【强制】部署迁移使用 `pnpm prisma migrate deploy`**。
- **【强制】禁止对生产库使用 `prisma migrate dev`**。

### 8.6 金额与小数（强制）

- **【强制】数据库存储**：
  - **【强制】禁止**：`Float`/`Double` 存金额或需要精确的小数
  - **【强制】必须**：使用 `Decimal`（Prisma 支持）
- **【强制】代码计算**：
  - **【强制】禁止**：用 JS 原生 `+ - * /` 直接计算金额（浮点误差不可控）
  - **【推荐】推荐**：使用 `Prisma.Decimal`（Prisma 内置 decimal 实现）或统一的 Decimal 工具类
  - **【推荐】输出格式**：输出到前端时应明确格式（字符串/定点整数），并在 DTO 层统一约定

### 8.7 时间与时区（Timezone）

- **【强制】存储**：数据库时间字段统一使用 `timestamptz`，语义为 UTC 时间点。
- **【强制】序列化**：对外交互统一 ISO 8601（UTC），推荐 `toISOString()`。
- **【强制】代码规范**：
  - **【推荐】不禁止 `new Date()`**：它表示“当前时间点”，不依赖时区；但禁止用本地时区字符串（如 `toString()`）做业务判断。
  - **【推荐】推荐统一使用 `DateUtil.now()/DateUtil.nowIso()`**：`src/common/utils/date.util.ts`，避免格式不一致。

---

## 9. Redis 规范

- **【强制】统一注入**：统一使用 `RedisModule` 提供的 `REDIS_CLIENT` 注入。
- **【强制】禁止临时连接**：禁止在业务代码里创建临时 Redis 连接（避免连接数失控）。
- **【强制】Key 必须有 namespace**：`refresh_token:`、`cache:`、`lock:`、`rate_limit:`。
- **【强制】TTL**：除非是明确的长期配置，否则写入必须设置 TTL。

### 9.1 分布式锁（并发控制）

适用：库存扣减、余额支付、幂等控制等“必须串行化”的临界区。

- **【强制】必须**：锁有 TTL（毫秒），避免死锁。
- **【强制】必须**：释放锁时校验 token，避免误删他人锁。
- **【建议】工具**：`src/common/redis/redis-lock.ts`（`acquireRedisLock/releaseRedisLock/withRedisLock`）

### 9.2 幂等键结果缓存

- **【推荐】Key 前缀**：幂等键结果缓存默认使用 Redis，key 前缀建议：`idempotency:res:`。
- **【强制】结果一致性**：幂等结果必须包含完整响应体（含业务码/消息/data/timestamp），以保证重试返回一致。

---

## 10. WebSocket 规范

- **【强制】使用 Socket.io**：适配器为 `RedisIoAdapter`（多实例扩展）。
- **【强制】网关位置**：放在 `src/modules/ws/`。
- **【推荐】事件命名**：保持一致（全项目统一一种风格）。

---

## 11. 可观测性（日志/健康检查/指标）

### 11.1 日志

- **【强制】使用 `nestjs-pino`**。
- **【强制】输出格式**：生产环境输出 JSON；开发环境使用 `pino-pretty`。
- **【强制】禁止敏感信息日志**：密码、refreshToken、Authorization、DATABASE_URL。

### 11.2 健康检查

- **【强制】`GET /health`**：公开接口（`@Public()`），必须检查数据库与 Redis（当前已实现）。

### 11.3 指标

- **【强制】`GET /metrics`**：Prometheus 拉取端点，必须 raw 返回且免鉴权。

### 11.4 Prisma 慢查询监控

- **【强制】慢查询日志**：超过阈值（默认 500ms）记为 slow query，并输出 warn 日志。
- **【建议】阈值配置**：`PRISMA_SLOW_QUERY_MS`（默认 500）。

---

## 12. 工程化（Lint/格式化/架构守护）

### 12.1 必须会用的命令

- **【推荐】`pnpm lint`**
- **【推荐】`pnpm format`**
- **【推荐】`pnpm arch-check`**
- **【推荐】`pnpm soft-delete-check`**

### 12.2 提交前检查

- **【强制】使用 `husky` + `lint-staged`**：对提交文件执行 ESLint 与 Prettier。

---

## 13. 测试规范

- **【建议】单元测试位置**：`src/**/*.spec.ts`
- **【建议】e2e 测试位置**：`test/**`

最低硬规则（【强制】）：

- **【强制】Service 单测必须覆盖**：
  - 正常路径（happy path）
  - 至少一个异常分支（例如参数非法/资源不存在/权限不足）
- **【强制】e2e 必须验证**：
  - 鉴权失败（401）
  - DTO 校验失败（400）
- **【强制】禁止在单测中直连真实 Redis/DB**：
  - 单测必须 mock/stub 外部依赖
  - e2e 如需集成外部依赖，必须使用可控的测试容器/测试库，并在 CI 中明确配置（不允许连开发/生产环境）

---

## 14. Git 规范（Conventional Commits）

格式：`type(scope): subject`，例如 `feat(auth): 增加多设备 refresh token 续签`

常用 type：

- **【推荐】`feat`**：新功能
- **【推荐】`fix`**：修复
- **【推荐】`docs`**：文档
- **【推荐】`refactor`**：重构
- **【推荐】`perf`**：性能
- **【推荐】`test`**：测试
- **【推荐】`chore`**：工程/依赖/工具

示例：`feat(auth): 增加多设备 refresh token 续签`

---

## 15. PR 审查清单（必须全部通过）

- **【强制】架构**：`common/` 未引入业务依赖；模块边界清晰。
- **【强制】接口**：DTO 已 Zod 校验；错误 status/message 稳定。
- **【强制】数据**：写操作可审计；事务边界正确；软删走显式方法。
- **【强制】安全**：无敏感信息日志；生产环境错误不泄露内部细节。
- **【强制】可观测**：关键路径能通过 requestId/日志定位。
- **【强制】可维护**：命名清晰；避免重复；必要处解释“为什么”。

---

## 16. Code Review 拒绝清单（看到即打回）

- **【强制】禁止 console**：出现 `console.log`/`console.warn`（必须使用 Logger，如 `nestjs-pino` 或 `Logger`，并确保不打印敏感信息）。
- **【强制】禁止无解释的 `as any`**：出现 `as any` 且没有解释注释、且可以用类型收敛/类型守卫解决。
- **【强制】禁止 Controller 写业务**：Controller 出现明显业务逻辑（经验阈值：单方法超过 5 行“业务分支”就应下沉 Service）。
- **【强制】禁止直接读取 `process.env`**：必须用 `AppConfigService`。
- **【强制】禁止 Magic Number/String**：应抽 enum/常量，并写清语义。
- **【强制】表结构变更必须有 migration**：`prisma/migrations/**/migration.sql`。
- **【强制】软删模型必须通过 soft-delete-check**：新增 `deletedAt` 必须更新 `SOFT_DELETE_MODELS` 且通过 `pnpm soft-delete-check`。
- **【强制】导出禁止超大 limit 拉全量**：必须走导出/流式/异步任务方案。
- **【强制】金额禁止 Float/JS 浮点运算**。

---

## 17. 请求体大小限制与文件上传安全

### 17.1 请求体大小限制

- **【强制】服务端必须显式设置 body limit**：JSON/urlencoded body 大小限制（默认 1mb，可通过 `BODY_LIMIT` 配置）。
- **【强制】增大 body limit 必须评审**：需要更大请求体必须评审（DoS 风险）并配套限流/鉴权。

### 17.2 文件上传（如未来引入）

- **【强制】无状态**：禁止把上传文件直接落到本地磁盘作为最终存储。
- **【强制】校验文件头**：必须校验 Magic Number，而非只看后缀名。
- **【强制】校验类型与大小**：必须校验 Content-Type/大小/白名单；必要时做病毒扫描与图片解码校验。
- **【推荐】OSS/S3**：后端签名直传或后端流式转发上传。
- **【推荐】下载/预览安全**：下载/预览接口需鉴权与防盗链策略。

---

## 18. 跨服务/外部调用防御（HTTP/RPC）

### 18.1 超时（【强制】）

- **【强制】必须设置 Timeout**：任何外部调用必须设置明确 Timeout（禁止依赖默认值）。
- **【强制】超时必须可定位**：必须返回可定位的错误（业务码 + 日志包含 requestId），并避免长时间占用线程/连接池。

### 18.2 重试与熔断（【建议】）

- **【建议】熔断/降级**：对“非核心依赖”建议加熔断/降级，避免雪崩扩散。
- **【推荐】重试约束**（满足才允许重试）：
  - 仅对幂等请求重试；
  - 带退避（exponential backoff + jitter）；
  - 有最大重试次数；
  - 与 Idempotency-Key 配合，避免重复写入。

## 附录 A：编码与命名约定（落地细则）

### A.1 TypeScript 约定

- **【推荐】文件命名**：kebab-case（例如 `user-profile.service.ts`）。
- **【推荐】类/接口命名**：PascalCase（例如 `UserProfileService`、`JwtPayload`）。
- **【推荐】变量/函数命名**：camelCase；布尔变量以 `is/has/can/should` 开头。
- **【推荐】尽量避免 any**：确实需要时，必须解释原因并把 any 限定在最小范围。
- **【强制】Promise 处理**：任何 Promise 都必须 `await` 或返回；禁止“发起但不处理”的写法。
- **【强制】导入顺序**：遵守 `simple-import-sort` 自动排序，提交前不要手动调整为非排序状态。

### A.2 NestJS 分层职责（强制）

- **【强制】Controller**：只做路由、DTO、鉴权注解、Swagger 注解、调用 service；不写业务规则与数据库逻辑。
- **【强制】Service**：承载业务编排与领域规则；数据库访问必须走 Prisma；跨资源编排必须明确事务边界。
- **【强制】Module**：只负责依赖组装；不要把业务逻辑写进 module 文件。

### A.3 DTO 命名与文件组织（强制）

- **【强制】DTO 命名**：
  - 创建：`CreateXxxDto`
  - 更新：`UpdateXxxDto`（PATCH 场景）
  - 查询：`XxxQueryDto`（列表筛选、分页）
- **【强制】DTO 文件组织**：放在 `src/modules/模块名/dto/` 目录，按资源拆分文件，不要把大量 schema 堆在一个文件里。
- **【强制】Zod 规则**：所有输入都必须有 schema；Query 数字必须 `z.coerce.number()`；可选字段必须显式 `.optional()`。
- **【推荐】字符串清洗**：标识类字段默认 `.trim()`；可以复用 `src/common/validation/zod-helpers.ts`。
- **【推荐】XSS/注入**：
  - 普通文本字段建议禁止 `<`/`>`（降低被当作 HTML 的风险），或按业务语义制定白名单规则。
  - 富文本字段禁止“简单正则过滤”冒充安全方案：必须使用专门的 sanitize（后端或前端统一策略），并在展示端做输出编码。

### A.4 错误处理约定

- **【强制】对外 code**：`code` 为业务错误码；HTTP status 仅表达协议语义。
- **【推荐】异常类型**：优先使用 Nest 内置异常（`BadRequestException`、`UnauthorizedException`、`ForbiddenException`、`NotFoundException`、`ConflictException`）。
- **【强制】message 规范**：对外 message 要短、稳定、可枚举；生产环境不泄露内部错误细节。
- **【强制】业务码机制**：需要精细化错误时，抛出 `BusinessException`（`src/common/errors/business.exception.ts`）。

---

## 附录 B：新增能力 Checklist（复制即用）

### B.1 新增业务接口（HTTP）

- **【推荐】定义路由**：RESTful 与 `@ApiTags`
- **【强制】DTO 使用 Zod**：body/query/param
- **【强制】鉴权标注**：需要鉴权则保持默认，不需要鉴权才加 `@Public()`
- **【推荐】明确返回结构**：列表是否分页、是否需要 raw
- **【强制】写操作可审计**：默认 Prisma 写操作自动落审计
- **【强制】日志**：补关键路径日志（避免打印敏感信息）
- **【强制】测试**：补单测或 e2e（至少覆盖核心分支）

### B.2 新增软删除模型（如果该表需要软删）

- **【强制】Prisma model 增加**：
  - `deletedAt DateTime?`
  - 推荐增加 `deletedById Int?`、`deleteReason String?`
- **【推荐】索引**：为高频查询字段建立包含 `deletedAt` 的联合索引（例如 `@@index([userId, deletedAt])`）
- **【强制】软删过滤更新**：
  1. 更新 `SOFT_DELETE_MODELS` 集合
  2. 更新 `SoftDeleteModelName` 类型（添加新模型名）
  3. 运行 `pnpm soft-delete-check` 防止遗漏
- **【强制】使用泛型方法**：直接使用 `genericSoftDelete()`/`genericRestore()`/`genericHardDelete()` 泛型方法，无需为每个模型编写专用方法
  ```typescript
  // 示例：软删除订单
  await this.prisma.genericSoftDelete("Order", orderId, {
    actorUserId: currentUser.id,
    reason: "用户取消",
  });
  ```
- **【推荐】便捷方法**：如需类型安全的专用方法，可参考 `userSoftDelete()` 模式封装

### B.3 在非 HTTP 场景写库（WS/定时任务/队列）

- **【强制】非 HTTP 写库必须显式注入审计上下文**：由于 `AuditContextInterceptor` 仅对 HTTP 生效，非 HTTP 场景必须显式使用 `runWithAuditContext()`：
  - `actorUserId`（如果有操作者）
  - `ip/userAgent`（如果来源于客户端连接且可得）
  - `requestId`（建议生成并贯穿日志）
- **【推荐】减少遗漏**：直接使用 `runWithSystemAuditContext/runWithJobAuditContext`（`src/common/audit/system-audit.ts`）。

---

## 附录 C：API 版本策略

### C.1 当前策略：强制升级

本项目采用 **强制升级** 策略，所有客户端（Web、小程序）与后端同步发布。

| 客户端类型 | 版本策略 | 说明                                        |
| ---------- | -------- | ------------------------------------------- |
| Admin Web  | 强制刷新 | 部署后用户刷新即获得最新版本                |
| H5 Web     | 强制刷新 | 同上                                        |
| 微信小程序 | 延迟兼容 | 受审核延迟影响，后端需保持 **1 周向下兼容** |

### C.2 路由前缀规范

- **【强制】API 前缀**：所有业务接口使用 `/v1` 前缀
- **【强制】不做版本共存**：当前阶段不维护 v1、v2 并行版本
- **【推荐】Breaking Change 处理**：
  1. 优先通过新增字段实现向下兼容
  2. 必须破坏性变更时，提前 1 周通知前端团队
  3. 小程序版本需等待审核通过后再下线旧逻辑

### C.3 未来扩展

若后续有原生 App（无法强制升级）或对外开放 API，需要：

1. 引入 `/api/v2` 前缀
2. 通过 API 网关或 NestJS 版本控制模块实现版本路由
3. 制定版本淘汰时间表（建议 v(n-2) 可废弃）

---

**维护者**：项目维护组
**最后更新**：2025-12-30
