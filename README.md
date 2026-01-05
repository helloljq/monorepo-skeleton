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

### 初始化配置

克隆后需要替换项目中的占位符：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{{TITLE}}` | 项目名称（英文，用于目录名、包名等） | `health-platform` |
| `{{DOMAIN}}` | 项目域名 | `example.com` |

**快速替换命令：**

```bash
# macOS
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.yml" -o -name "*.yaml" -o -name ".env*" \) \
  -not -path "./node_modules/*" -not -path "./.git/*" \
  -exec sed -i '' 's/{{TITLE}}/your-project-name/g; s/{{DOMAIN}}/your-domain.com/g' {} +

# Linux
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.yml" -o -name "*.yaml" -o -name ".env*" \) \
  -not -path "./node_modules/*" -not -path "./.git/*" \
  -exec sed -i 's/{{TITLE}}/your-project-name/g; s/{{DOMAIN}}/your-domain.com/g' {} +
```

**然后完成初始化：**

```bash
# 安装依赖
pnpm install

# 生成 Prisma Client
pnpm --filter server prisma:generate

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入实际配置

# 首次提交
git add .
git commit -m "chore: init project from monorepo-skeleton"
```

---

## 技术栈

| 应用 | 技术栈 |
|------|--------|
| **server** | NestJS 11 + Prisma + PostgreSQL + Redis |
| **admin-web** | React 19 + Vite + shadcn/ui + TanStack Query |
| **www-web** | React 19 + Vite + Tailwind CSS |
| **miniprogram** | Taro 4 + React + TypeScript |

## 快速开始

### 环境要求

- Node.js >= 20.0.0
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

> 详细配置步骤请参考 [本地 Hosts 配置指南](./docs/development/local-hosts-setup.md)

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 填入实际配置
```

### 启动开发

```bash
# 启动所有应用
pnpm dev

# 启动指定应用
pnpm --filter server dev
pnpm --filter admin-web dev
pnpm --filter www-web dev
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

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动所有应用开发模式 |
| `pnpm build` | 构建所有应用 |
| `pnpm lint` | 代码检查 |
| `pnpm typecheck` | 类型检查 |
| `pnpm test` | 运行测试 |
| `pnpm format` | 格式化代码 |
| `pnpm clean` | 清理构建产物 |

## 文档

- [架构设计](./docs/architecture/overview.md)
- [入职指南](./docs/ONBOARDING.md)
- [部署指南](./docs/deployment/environments.md)

## License

UNLICENSED - Private
