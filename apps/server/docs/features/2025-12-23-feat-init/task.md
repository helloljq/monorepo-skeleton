# 任务: NestJS 现代化后端初始化

- [ ] **初始化与工程配置** <!-- id: 0 -->
  - [ ] 使用 `pnpm` 创建 NestJS 项目结构 <!-- id: 1 -->
  - [ ] **工程规范**: 配置 `husky`, `lint-staged` 和 ESLint Import Sort <!-- id: 2 -->
  - [ ] **架构守护**: 配置 `dependency-cruiser` 锁定 `common/` 引用规则 <!-- id: 21 -->
  - [ ] **环境配置**:
    - [ ] 定义 Zod Schema (`env.schema.ts`) <!-- id: 19 -->
    - [ ] 封装强类型 `AppConfigService` <!-- id: 3 -->

- [ ] **数据库层 (Prisma)** <!-- id: 4 -->
  - [ ] 连接外部 PostgreSQL 并拉取 Schema <!-- id: 5 -->
  - [ ] **Schema 调整**: 配置 `@@unique([email, deletedAt])`，并为常查字段加 `deletedAt` 联合索引 <!-- id: 18 -->
  - [ ] **Prisma Service**: 实现扩展 (Soft Delete 自动化)，**应用 BigInt JSON Patch** <!-- id: 6 -->
  - [ ] **异常处理**: 全局 Filter 转换 Prisma 错误码 <!-- id: 7 -->

- [ ] **核心模块基建** <!-- id: 8 -->
  - [ ] **Redis**: 封装全局 Redis 模块 (ioredis) <!-- id: 15 -->
  - [ ] **公共工具**:
    - [ ] 实现 `ApiResponse` 拦截器 + `@RawResponse()` 装饰器 <!-- id: 9 -->
    - [ ] 实现 `Pagination` DTO 和工具函数 <!-- id: 20 -->
  - [ ] **认证模块**:
    - [ ] JWT Strategy (Access/Refresh 双 Token) <!-- id: 10 -->
    - [ ] **Token 管理**: 多端登录支持 (`refresh_token:{uid}:{deviceId}`) + 自动续签 <!-- id: 16 -->
  - [ ] **WebSocket**: 配置 `RedisIoAdapter` 和网关 <!-- id: 11 -->

- [ ] **可观测性 (Observability)** <!-- id: 22 -->
  - [ ] **日志**: 集成 `nestjs-pino` (JSON/Pretty 切换 + TraceId) <!-- id: 23 -->
  - [ ] **健康检查**: 实现 `/health` 端点 (Terminus -> DB/Redis) <!-- id: 24 -->
  - [ ] **监控**: 集成 Prometheus metrics (`/metrics`) <!-- id: 25 -->

- [ ] **文档与持续集成** <!-- id: 12 -->
  - [ ] **Swagger**: 配置 Zod 支持及 API 描述 <!-- id: 13 -->
  - [ ] **CI/CD**: 创建 GitHub Actions 工作流 <!-- id: 17 -->
