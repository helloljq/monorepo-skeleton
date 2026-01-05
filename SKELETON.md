# Monorepo Skeleton

这是一个通用的 Monorepo 项目骨架，包含完整的基础设施和通用功能模块。

## 快速开始

### 创建新项目

```bash
# 克隆骨架
git clone <skeleton-repo-url> my-project
cd my-project

# 初始化项目
./scripts/init-project.sh <NAME> <TITLE> <DOMAIN>

# 示例
./scripts/init-project.sh i54kb "54KB 工具站" 54kb.com
./scripts/init-project.sh myshop "我的商城" myshop.com
```

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `NAME` | 项目标识（小写字母+数字，用于包名、容器名、数据库名） | `i54kb`, `myshop` |
| `TITLE` | 项目显示名称（用于文档和 UI） | `54KB 工具站`, `我的商城` |
| `DOMAIN` | 项目域名 | `54kb.com`, `myshop.com` |

## 包含的功能

### 后端模块 (apps/server)

- **auth** - JWT 双 Token 认证
- **user** - 用户管理
- **role** - 角色管理
- **permission** - 权限管理
- **identity** - 多身份认证（邮箱/手机/微信）
- **config-center** - 配置中心（支持加密、版本控制）
- **dictionary** - 字典数据管理
- **health** - 健康检查
- **ws** - WebSocket 网关

### 前端功能 (apps/admin-web)

- 登录/注册
- 用户/角色/权限管理
- 配置项管理
- 字典管理
- 个人中心
- 主题切换

### 基础设施

- **CI/CD**: GitHub Actions（CI + 多环境部署）
- **Docker**: 多阶段构建、docker-compose
- **数据库**: PostgreSQL + Prisma
- **缓存**: Redis
- **监控**: Prometheus 指标
- **日志**: Pino 结构化日志
- **审计**: 自动审计日志

## 目录结构

```
skeleton/
├── apps/
│   ├── server/          # NestJS 后端
│   ├── admin-web/       # React Admin
│   ├── www-web/         # React H5
│   └── miniprogram/     # Taro 小程序
├── packages/
│   ├── shared-types/    # 共享类型
│   └── shared-utils/    # 共享工具
├── tooling/
│   ├── eslint-config/   # ESLint 配置
│   ├── typescript-config/ # TS 配置
│   └── tailwind-config/ # Tailwind 配置
├── deploy/
│   ├── dev/             # 开发环境
│   ├── staging/         # 预发布环境
│   └── prod/            # 生产环境
├── infra/               # 基础设施配置
├── docs/                # 文档
├── scripts/
│   └── init-project.sh  # 初始化脚本
└── SKELETON.md          # 本文件
```

## 占位符说明

骨架中使用以下占位符，初始化时会被替换：

| 占位符 | 替换为 | 用途 |
|--------|--------|------|
| `{{NAME}}` | 项目 NAME 参数 | 包名、容器名、数据库名 |
| `{{TITLE}}` | 项目 TITLE 参数 | 文档、UI 显示名称 |
| `{{DOMAIN}}` | 项目 DOMAIN 参数 | 域名配置 |

## 初始化后的步骤

1. **安装依赖**
   ```bash
   pnpm install
   ```

2. **配置数据库**
   ```bash
   # 复制环境变量
   cp apps/server/.env.example apps/server/.env
   # 编辑 .env 填写数据库连接信息

   # 生成 Prisma Client
   pnpm --filter server prisma:generate

   # 执行数据库迁移
   pnpm --filter server prisma migrate dev
   ```

3. **启动开发服务**
   ```bash
   pnpm dev
   ```

4. **配置 GitHub Secrets**（用于 CI/CD）
   - `DOCKER_REGISTRY`
   - `DOCKER_NAMESPACE`
   - `DOCKER_USERNAME`
   - `DOCKER_PASSWORD`
   - `STAGING_*` 系列
   - `PROD_*` 系列

## 扩展指南

### 添加新的业务模块

1. 在 `apps/server/src/modules/` 创建新模块
2. 在 `apps/admin-web/src/features/` 创建对应前端
3. 更新路由和菜单配置
4. 运行 `pnpm api:generate` 生成 API 代码

### 添加新的共享包

1. 在 `packages/` 下创建新目录
2. 添加 `package.json`，name 格式为 `@{{NAME}}/package-name`
3. 在需要使用的应用中添加依赖

## 注意事项

- 小程序开发需要 Node.js 20 或更低版本（Taro 兼容性）
- 生产部署前请更新所有密钥
- 详细开发规范请参考各应用的 `CLAUDE.md`
