# Monorepo Skeleton

企业级全栈应用 Monorepo 骨架项目，包含后端服务、管理后台、H5 移动端和微信小程序。

## 使用此模板初始化项目

### 方式一：使用 degit（推荐）

```bash
# 安装 degit（如果没有）
npm install -g degit

# 克隆模板到新项目目录
degit helloljq/monorepo-skeleton my-project

cd my-project
```

### 方式二：直接克隆

```bash
git clone https://github.com/helloljq/monorepo-skeleton.git my-project
cd my-project

# 删除原有 git 历史，初始化新仓库
rm -rf .git
git init
```

### 初始化配置（推荐脚本）

克隆后请运行初始化脚本替换占位符（会批量替换 `{{...}}`，并生成项目 README）：

| 占位符            | 说明                                                  | 示例          |
| ----------------- | ----------------------------------------------------- | ------------- |
| `{{NAME}}`        | 项目标识（小写字母+数字，用于包名、容器名、数据库名） | `i54kb`       |
| `{{TITLE}}`       | 项目显示名称（用于文档与 UI）                         | `54KB 工具站` |
| `{{DOMAIN}}`      | 项目域名                                              | `54kb.com`    |
| `{{PROJECT_NUM}}` | 项目编号（17-99，用于端口规划）                       | `17`          |

```bash
./scripts/init-project.sh <NAME> <TITLE> <DOMAIN> <PROJECT_NUM>
```

示例：

```bash
./scripts/init-project.sh i54kb "54KB 工具站" 54kb.com 17
```

---

## 技术栈

| 应用            | 技术栈                                       |
| --------------- | -------------------------------------------- |
| **server**      | NestJS 11 + Prisma + PostgreSQL + Redis      |
| **admin-web**   | React 18 + Vite + shadcn/ui + TanStack Query |
| **www-web**     | React 18 + Vite + Tailwind CSS               |
| **miniprogram** | Taro 4 + React + TypeScript                  |

## 快速开始

### 环境要求

- Node.js 22 LTS（默认；见根目录 `.nvmrc`）
- 小程序（`apps/miniprogram`）开发：Node.js >= 20；如遇 Taro + Node.js 22 兼容问题，建议切换到 Node.js 20
- pnpm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 6

### 安装依赖

```bash
pnpm install
```

### 配置 hosts

本地开发需要配置 hosts 文件：

```bash
# macOS/Linux: sudo vim /etc/hosts
# Windows: C:\Windows\System32\drivers\etc\hosts

127.0.0.1 api-dev.{{DOMAIN}}
127.0.0.1 www-dev.{{DOMAIN}}
127.0.0.1 admin-dev.{{DOMAIN}}
```

> 详细配置步骤请参考 [本地 Hosts 配置指南](./docs/runbooks/development/local-hosts-setup.md)

### 配置环境变量

```bash
# 按应用配置（规范：每个应用提交 `.env.example`，禁止提交实际 `.env*`）
cp apps/server/.env.example apps/server/.env
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/www-web/.env.example apps/www-web/.env
# 可选：小程序构建期 env（如需）
cp apps/miniprogram/.env.example apps/miniprogram/.env

# 可选：本地 docker-compose（数据库/Redis）变量
cp deploy/dev/.env.example .env
```

### 启动开发

```bash
# 启动 server + admin-web + www-web（默认不含小程序）
pnpm dev

# 启动所有应用（含小程序；如遇 Taro + Node.js 22 兼容问题，建议切换到 Node.js 20）
pnpm dev:all

# 启动指定应用
pnpm --filter server dev
pnpm --filter admin-web dev
pnpm --filter www-web dev
# 小程序开发：如遇 Taro + Node.js 22 兼容问题，建议切到 Node.js 20 再运行
pnpm --filter miniprogram dev
```

### 构建

```bash
# 构建所有应用
pnpm build

# 构建指定应用
pnpm --filter server build
```

## 项目结构

```
{{TITLE}}/
├── apps/                    # 应用
│   ├── server/             # NestJS 后端
│   ├── admin-web/          # React 管理后台
│   ├── www-web/            # WWW 移动端
│   └── miniprogram/        # 微信小程序
├── packages/               # 共享包
│   ├── shared-types/       # 共享类型
│   └── shared-utils/       # 共享工具
├── tooling/                # 工具配置
│   ├── eslint-config/      # ESLint 配置
│   ├── typescript-config/  # TypeScript 配置
│   └── tailwind-config/    # Tailwind 配置
└── docs/                   # 项目文档
```

## 常用命令

| 命令             | 说明                 |
| ---------------- | -------------------- |
| `pnpm dev`       | 启动所有应用开发模式 |
| `pnpm build`     | 构建所有应用         |
| `pnpm lint`      | 代码检查             |
| `pnpm typecheck` | 类型检查             |
| `pnpm test`      | 运行测试             |
| `pnpm format`    | 格式化代码           |
| `pnpm clean`     | 清理构建产物         |

## 文档

- [文档中心索引](./docs/README.md)
- [架构设计](./docs/design/architecture/overview.md)
- [入职指南](./docs/runbooks/development/onboarding.md)
- [部署指南](./docs/runbooks/deployment/environments.md)

## License

UNLICENSED - Private
