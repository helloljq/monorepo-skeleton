# 架构方案：NestJS 现代化极简后端

## 1. 核心架构概览
**核心理念**: 严格的类型安全、模块化、极简主义。

*   **运行环境**: Node.js (Latest Active LTS)
*   **包管理器**: pnpm
*   **框架**: NestJS (Standard Mode)
*   **语言**: TypeScript (Strict Mode)
*   **数据库**: PostgreSQL 16+ (外部连接)
*   **缓存/消息**: Redis 7+ (外部连接)
*   **ORM**: Prisma (配合 Client Extensions 实现增强功能)
*   **验证**: Zod (配合 `nestjs-zod`)
*   **API 风格**: 标准 RESTful (GET/POST/PUT/PATCH/DELETE)

## 2. 目录结构规范 (领域驱动)
**严格约定**: `common/` 只能存放**无业务语义**且**至少被2个模块使用**的代码。
*   **强制手段**: 引入 `dependency-cruiser` 或 ESLint `import/no-restricted-paths` 规则，禁止 `common` 引用 `modules`，并监控 `common` 内部依赖图。

```text
src/
├── app.module.ts
├── main.ts
├── common/                  # 公共设施 (无业务语义)
│   ├── adapters/            # RedisIoAdapter
│   ├── decorators/          # @RawResponse()
│   ├── filters/             # 全局异常过滤器
│   ├── interceptors/        # 响应封装 (ApiResponse)
│   ├── pagination/          # 分页 DTO 和元数据构造器
│   └── providers/           # 全局 Provider (如 ConfigService)
├── config/                  # 环境配置
│   ├── env.schema.ts        # Zod 校验结构
│   └── app-config.service.ts # 强类型配置服务
├── database/                # 数据库层
│   └── prisma/
│       └── prisma.service.ts # 包含 软删除 + BigInt 序列化扩展
├── modules/                 # 业务模块 (Feature Modules)
│   ├── auth/                # 认证 (JWT + Redis Blacklist)
│   ├── users/               # 用户域
│   └── ws/                  # WebSocket 实时通信域
└── generated/
```

## 3. 关键技术策略

### A. Prisma 增强策略 (软删除 & BigInt)
*   **机制**: 使用 Prisma Client Extensions (`$extends`)。
*   **软删除 (Soft Delete)**:
    *   **Schema**: 所有模型添加 `deletedAt DateTime?`。
    *   **唯一索引**: 使用联合唯一索引 `@@unique([email, deletedAt])`。
        *   **注意**: 必须在数据库层面启用 `NULLS NOT DISTINCT` (PostgreSQL 15+) 以保证 `deletedAt` 为 null 时的唯一性（即保证活跃用户唯一）。
    *   **自动化**:
        *   **扩展**: 封装全局 Prisma 扩展，自动拦截 `find*` 操作注入 `where: { deletedAt: null }`。
        *   **操作**: 拦截 `delete` / `deleteMany` 自动转换为 `update` 设置 `deletedAt`。
    *   **性能陷阱**: 必须为高频查询字段建立包含 `deletedAt` 的联合索引（e.g., `index([userId, deletedAt])`）。
    *   **级联处理**: 在扩展中需谨慎处理级联关系。建议 v1 版本仅处理主表软删除，关联表查询时通过 `where` 过滤，或在应用层显式处理级联逻辑以避免隐式魔法。
*   **BigInt 序列化**:
    *   **方案**: **Global Transform Interceptor** (最佳实践)。
    *   **理由**: 避免修改 `BigInt.prototype` 全局对象带来的副作用。在全局响应拦截器中，递归遍历响应对象，将所有 `BigInt` 转换为字符串。这符合 NestJS "AOP" 切面编程理念。

### B. 统一响应与分页 (Response & Pagination)
*   **统一响应格式**: 使用全局 Interceptor (`TransformInterceptor`) 包装所有返回数据：
    ```json
    {
      "code": 200,
      "message": "success",
      "data": { ... }, // 原始返回值
      "timestamp": 1698765432100
    }
    ```
*   **豁免机制**: 实现 `@RawResponse()` 装饰器。
*   **分页规范**:
    1.  **Offset 分页** (默认): `page`/`limit`。
    2.  **Cursor 分页** (可选, 无限滚动场景): `cursor` (Base64 Opaque String) / `limit`。
    3.  **响应**: 使用 `PaginatedResponse<T>` 泛型，根据分页类型返回 `meta` (total/page) 或 `cursor` (nextCursor)。

### C. 强类型环境配置 (Type-Safe Env)
*   **痛点**: `ConfigService.get('TYPO')` 返回 undefined 导致运行时崩溃。
*   **方案**:
    1.  **定义**: 使用 Zod 定义 `env.schema.ts`。
    2.  **封装**: 创建 `AppConfigService`，将配置项封装为 Getter 方法（如 `get dbUrl(): string`）。
    3.  **使用**: 代码中只注入 `AppConfigService`，彻底杜绝字符串魔法值。

### D. 认证与安全 (Auth & JWT)
*   **策略**: 双 Token 机制 (Access + Refresh)。
*   **多端登录**: Redis Key 设计为 `refresh_token:{userId}:{deviceId}`。允许同一用户在不同设备持有独立的 Refresh Token，互不干扰。
*   **存储**: Access Token (无状态), Refresh Token (Redis, 7天)。
*   **自动续签**: 当 Access Token 过期但 Refresh Token 有效时，前端无感调用 refresh 接口获取新 Token。
*   **注销**: 仅从 Redis 删除 Refresh Token，不维护 Access Token 黑名单（依赖短效期如 15min 自然过期）。
*   **API 风格**: **标准 RESTful**。
    *   `GET /users` - 列表
    *   `POST /users` - 创建
    *   `PATCH /users/:id` - 更新部分字段
    *   `DELETE /users/:id` - 删除 (逻辑删除)

### E. 开发规约与工程化
*   **Lint**: 配置 `eslint-plugin-simple-import-sort` (自动排序) 和 `@darraghor/nestjs-typed`。
*   **Git Hooks**: 使用 `husky` + `lint-staged` 在 commit 前强制检查。
*   **CI/CD**: GitHub Actions (`.github/workflows/ci.yml`) 包含 Lint -> Build 流程。
*   **文档归档 (Documentation Archiving)**:
    *   **机制**: 每次重大特性变更Planning结合后，必须将 `implementation_plan.md` 和 `task.md` 归档。
    *   **路径**: `docs/yyyy-mm-dd_{branch_name}/`。
    *   **目的**: 记录架构决策演进历史。

### F. 可观测性与运维 (Observability & Ops)
*   **健康检查 (Health Check)**:
    *   **库**: `@nestjs/terminus`。
    *   **端点**: `/health` (Readiness Probe)。
    *   **内容**: 检查 Database (Prisma Ping) 和 Redis 连接状态。
*   **日志规范 (Logging)**:
    *   **库**: `nestjs-pino` (基于 Pino 的高性能日志)。
    *   **格式**: Production 环境强制 JSON 格式（便于 ELK/Loki 收集）；Development 环境使用 Pretty Print。
    *   **上下文**: 自动注入 `traceId` (Correlation ID) 到所有日志中，贯穿请求全链路。
    *   **内容**: 记录请求参数、响应时间、异常堆栈、Prisma 慢查询 (>500ms)。
*   **性能监控 (Monitoring)**:
    *   **指标**: 集成 `@willsoto/nestjs-prometheus`。
    *   **端点**: `/metrics` (供 Prometheus 拉取)。
    *   **核心指标**: HTTP 请求吞吐量 (RPS)、响应延迟 (P95/P99)、系统内存/CPU 使用率。

### G. Git 提交规范 (Conventional Commits)
*   **格式**: `<type>(<scope>): <subject>`
*   **Type**:
    *   `feat`: 新功能
    *   `fix`: 修复 Bug
    *   `docs`: 文档变更
    *   `style`: 代码格式 (不影响逻辑，空格/分号等)
    *   `refactor`: 重构 (既无新功能也无 Bug 修复)
    *   `perf`: 性能优化
    *   `test`: 测试相关
    *   `chore`: 构建/工具/依赖变动/脚手架初始化
    *   `revert`: 回滚
*   **Scope**: 影响范围 (e.g., `deps`, `auth`, `common`)
*   **Subject**: 简短描述 (建议中文，动词开头)
*   **示例**: `feat(auth): 增加 JWT 双 Token 刷新机制`

## 4. 初始化任务清单
详见 `task.md`。
