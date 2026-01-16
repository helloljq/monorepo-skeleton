# 技术栈说明

## 后端技术栈

| 技术       | 版本 | 用途                                       |
| ---------- | ---- | ------------------------------------------ |
| NestJS     | 11   | Web 框架                                   |
| TypeScript | 5.7+ | 类型安全（后端使用更保守版本以确保稳定性） |
| Prisma     | 5    | ORM                                        |
| PostgreSQL | 14+  | 主数据库                                   |
| Redis      | 6+   | 缓存、会话                                 |
| Zod        | 4    | 输入校验                                   |
| Socket.io  | 4    | WebSocket                                  |
| Pino       | -    | 日志                                       |
| Prometheus | -    | 监控指标                                   |

## 前端技术栈

### Admin Web

| 技术           | 版本 | 用途                           |
| -------------- | ---- | ------------------------------ |
| React          | 18   | UI 框架                        |
| TypeScript     | 5.9+ | 类型安全（前端可使用更新版本） |
| Vite           | 7    | 构建工具                       |
| shadcn/ui      | -    | UI 组件库                      |
| Tailwind CSS   | 3.4  | 样式                           |
| TanStack Query | 5    | 服务端状态                     |
| Zustand        | 5    | 客户端状态                     |
| React Router   | 7    | 路由                           |
| Orval          | 7    | API 代码生成                   |

### H5 Web

| 技术         | 版本 | 用途                           |
| ------------ | ---- | ------------------------------ |
| React        | 18   | UI 框架                        |
| TypeScript   | 5.9+ | 类型安全（前端可使用更新版本） |
| Vite         | 7    | 构建工具                       |
| Tailwind CSS | 3.4  | 样式                           |
| React Router | 7    | 路由                           |

### Miniprogram

| 技术       | 版本 | 用途     |
| ---------- | ---- | -------- |
| Taro       | 4    | 跨端框架 |
| React      | 18   | UI 框架  |
| TypeScript | 5.7+ | 类型安全 |
| Sass       | -    | 样式     |

## 工程化工具

| 工具        | 用途              |
| ----------- | ----------------- |
| pnpm        | 包管理            |
| Turborepo   | Monorepo 构建编排 |
| ESLint      | 代码检查          |
| Prettier    | 代码格式化        |
| Husky       | Git Hooks         |
| lint-staged | 提交前检查        |
| Vitest      | 单元测试          |
| Jest        | 后端单元测试      |
