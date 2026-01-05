# CLAUDE.md

> **文件用途说明**
>
> 本文件服务于两类读者：
> 1. **AI 辅助工具**：Claude Code 等 AI 开发工具读取此文件获取项目上下文
> 2. **人类开发者**：快速了解项目结构和开发规范
>
> 这是 Anthropic 官方推荐的项目配置文件格式。详细规范请参考 `/docs/` 目录。

## 项目概述

{{TITLE}}（{{TITLE}}）是一个企业级健康管理平台 Monorepo，使用 pnpm workspace + Turborepo 管理。

## 项目结构

```
{{TITLE}}/
├── apps/
│   ├── server/          # NestJS 后端 (端口 8100)
│   ├── admin-web/       # React 管理后台 (端口 3100)
│   ├── www-web/         # WWW 移动端 (端口 3200)
│   └── miniprogram/     # 微信小程序 (Taro)
├── packages/
│   ├── shared-types/    # 共享 TS 类型
│   └── shared-utils/    # 共享工具函数
├── tooling/             # 共享配置
└── docs/                # 项目文档
```

## 常用命令

```bash
# 全局命令
pnpm dev              # 启动 server + admin-web + www-web（不含小程序）
pnpm dev:all          # 启动所有应用（含小程序，需 Node.js < 22）
pnpm build            # 构建所有应用
pnpm lint             # 代码检查
pnpm typecheck        # 类型检查

# 指定应用
pnpm --filter server start:dev    # 后端开发模式
pnpm --filter admin-web dev       # 管理后台
pnpm --filter www-web dev         # WWW 移动端
pnpm --filter miniprogram dev     # 小程序（需 Node.js < 22）

# 数据库
pnpm --filter server prisma:generate          # 生成 Prisma Client
pnpm --filter server exec prisma migrate dev  # 执行数据库迁移
```

> **注意**: Taro 小程序与 Node.js 22 存在兼容性问题，`pnpm dev` 默认排除小程序。
> 开发小程序请使用 Node.js 20 或单独运行 `pnpm --filter miniprogram dev`。

## 核心技术栈

- **Monorepo**: pnpm workspace + Turborepo
- **Server**: NestJS 11 + Prisma + PostgreSQL + Redis + Zod
- **Admin Web**: React 19 + Vite + shadcn/ui + TanStack Query + Zustand
- **WWW Web**: React 19 + Vite + Tailwind CSS
- **Miniprogram**: Taro 4 + React + TypeScript

## 开发规范

### 代码风格
- 使用 ESLint + Prettier 统一代码风格
- 遵循各应用的 CLAUDE.md 中的具体规范

### 文档规范
- 跨应用文档放 `/docs/`
- 应用内部文档放 `/apps/*/docs/`
- 包使用说明放 `/packages/*/README.md`

### Git 提交规范
- 使用 Conventional Commits
- 格式: `type(scope): message`
- 类型: feat / fix / docs / style / refactor / perf / test / chore

## 应用说明

各应用有独立的 CLAUDE.md，包含：
- apps/server/CLAUDE.md - 后端开发规范
- apps/admin-web/CLAUDE.md - 管理后台开发规范
- apps/www-web/CLAUDE.md - WWW 开发规范
- apps/miniprogram/CLAUDE.md - 小程序开发规范

## 关键文档

| 文档 | 说明 |
|------|------|
| [GLOSSARY.md](./GLOSSARY.md) | 业务词汇表，包含核心概念、枚举值、数据模型关系 |
| [docs/](./docs/) | 详细架构文档和设计规范 |

## Language Preference

Always respond in Simplified Chinese (简体中文).

---

## AI 辅助开发指南

> 本节帮助 AI 快速理解项目架构，提高辅助开发效率。

### 项目定位

这是一个**单人独立开发**的企业级健康管理平台，架构设计的首要目标是：
1. **AI 可理解性** - 便于 AI 辅助开发时快速获取上下文
2. **模式一致性** - 统一的代码模式减少 AI 推理成本
3. **单一职责** - 每个模块职责明确，便于独立修改

### 快速上下文获取

**开始新任务前，AI 应该阅读**：
1. 相关应用的 `CLAUDE.md`（包含模板和模式）
2. `GLOSSARY.md`（理解业务术语）
3. 相关模块的现有代码（理解当前模式）

### 跨应用数据流

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   admin-web     │    │    www-web      │    │  miniprogram    │
│  (管理后台)      │    │  (C端 H5)       │    │  (微信小程序)    │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │    HTTP/REST API     │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │       server          │
                    │    (NestJS 后端)       │
                    ├───────────────────────┤
                    │  Controller (入口)     │
                    │  Service (业务逻辑)    │
                    │  Prisma (数据访问)     │
                    └───────────┬───────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
┌────────▼────────┐   ┌────────▼────────┐    ┌────────▼────────┐
│   PostgreSQL    │   │     Redis       │    │  Object Storage │
│    (主数据库)    │   │  (缓存/会话)     │    │   (文件存储)     │
└─────────────────┘   └─────────────────┘    └─────────────────┘
```

### 应用间共享

| 共享内容 | 位置 | 说明 |
|---------|------|------|
| TS 类型 | `packages/shared-types` | 跨应用共享的类型定义 |
| 工具函数 | `packages/shared-utils` | 跨应用共享的工具函数 |
| API 类型 | 各前端 `api/model/` | 从 Swagger 生成，与后端保持同步 |

### 常见开发场景

| 场景 | 涉及应用 | 关键文件 |
|------|---------|---------|
| 新增 CRUD 模块 | server | 参考 `apps/server/CLAUDE.md` 的模板 |
| 新增管理页面 | admin-web | 参考 `apps/admin-web/CLAUDE.md` 的模板 |
| 新增移动端页面 | www-web | 参考 `apps/www-web/CLAUDE.md` 的模板 |
| 新增小程序页面 | miniprogram | 参考 `apps/miniprogram/CLAUDE.md` 的模板 |
| 修改数据模型 | server | `prisma/schema.prisma` → 执行迁移 → 重新生成 API |
| 修改 API 接口 | server + 前端 | 后端改完后前端执行 `pnpm api:generate` |

### AI 开发最佳实践

1. **遵循现有模式** - 新代码应与同模块现有代码风格一致
2. **使用生成的代码** - 前端 API 调用必须使用 Orval 生成的 hooks
3. **类型优先** - 利用 TypeScript 类型系统，避免 any
4. **参考模板** - 各 CLAUDE.md 中的模板是最佳实践的体现
5. **理解业务** - 修改前先阅读 GLOSSARY.md 理解相关业务概念
