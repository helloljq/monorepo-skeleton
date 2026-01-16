# {{TITLE}} - 完整部署操作手册

本文档提供从零开始到生产环境部署的完整指南。

---

## 目录

1. [架构概览](#一架构概览)
2. [Docker 构建优化](#二docker-构建优化turbo-prune)
3. [服务器准备](#三服务器准备)
4. [首次部署](#四首次部署)
5. [CI/CD 配置](#五cicd-配置)
6. [数据库迁移](#六数据库迁移)
7. [回滚操作](#七回滚操作)
8. [监控与日志](#八监控与日志)
9. [常见问题](#九常见问题)

---

## 一、架构概览

### 1.1 服务组成

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx / CDN                          │
│                    (SSL 终结, 反向代理)                       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  Admin Web    │   │   WWW Web     │   │   Server API  │
│  (Nginx)      │   │   (Nginx)     │   │   (Node.js)   │
│  :3120        │   │   :3220       │   │   :8120       │
└───────────────┘   └───────────────┘   └───────────────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                          ▼                    ▼                    ▼
                   ┌────────────┐      ┌────────────┐      ┌────────────┐
                   │ PostgreSQL │      │   Redis    │      │   MinIO    │
                   │   :5432    │      │   :6379    │      │  (可选)    │
                   └────────────┘      └────────────┘      └────────────┘
```

### 1.2 端口规划

| 服务       | 容器内端口 | dev  | staging | production |
| ---------- | ---------- | ---- | ------- | ---------- |
| Server API | 8100       | 8100 | 8110    | 8120       |
| Admin Web  | 80         | 3100 | 3110    | 3120       |
| WWW Web    | 80         | 3200 | 3210    | 3220       |
| PostgreSQL | 5432       | 5432 |
| Redis      | 6379       | 6379 |

---

## 二、Docker 构建优化（Turbo Prune）

### 2.1 优化背景

Monorepo 项目构建 Docker 镜像时面临的挑战：

- 整个仓库作为 Build Context 传输到 Docker Daemon（慢、耗资源）
- 修改任意文件都可能导致缓存失效
- 包含无关应用的代码和依赖

### 2.2 Turbo Prune 解决方案

我们使用 `turbo prune --docker` 在构建前裁剪 Monorepo，只保留目标应用及其依赖：

```
原始 Monorepo                    裁剪后（构建 server）
├── apps/                        ├── apps/
│   ├── server/ ────────────────►│   └── server/
│   ├── admin-web/  ✗ 排除       │
│   ├── www-web/    ✗ 排除       ├── packages/
│   └── miniprogram/ ✗ 排除      │   ├── shared-types/
├── packages/                    │   └── shared-utils/
│   ├── shared-types/ ──────────►│
│   └── shared-utils/ ──────────►└── (配置文件)
└── ...
```

### 2.3 构建流程（四阶段）

```dockerfile
# 阶段 0: Monorepo 裁剪
FROM node:20-alpine AS pruner
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @{{NAME}}/server --docker
# 输出: out/json/ (package.json), out/full/ (源码), out/pnpm-lock.yaml

# 阶段 1: 依赖安装（利用缓存）
FROM node:20-alpine AS deps
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile

# 阶段 2: 构建
FROM node:20-alpine AS builder
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
RUN pnpm --filter @{{NAME}}/server build

# 阶段 3: 生产运行时
FROM node:20-alpine AS runner
# 只复制必要的构建产物
```

### 2.4 优化效果

| 指标               | 优化前  | 优化后 | 提升 |
| ------------------ | ------- | ------ | ---- |
| Build Context 大小 | ~500MB+ | ~100MB | 80%↓ |
| 依赖安装缓存命中率 | 低      | 高     | ↑↑   |
| 增量构建时间       | 较长    | 较短   | 50%↓ |

### 2.5 本地构建命令

```bash
# 构建 server
docker build -f apps/server/Dockerfile -t xiaoyue-server .

# 构建 admin-web
docker build -f apps/admin-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.{{DOMAIN}} \
  -t xiaoyue-admin-web .

# 构建 www-web
docker build -f apps/www-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.{{DOMAIN}} \
  -t xiaoyue-www-web .
```

### 2.6 .dockerignore 配置

项目根目录的 `.dockerignore` 文件用于排除不必要的文件：

```
# 核心排除项
node_modules/          # 依赖（容器内重装）
dist/                  # 构建产物（容器内重建）
.turbo/                # Turbo 缓存
.git/                  # Git 历史
.env*                  # 环境变量（敏感）
docs/                  # 文档
*.md                   # Markdown
apps/miniprogram/      # 小程序（不参与 Docker 构建）
```

详细配置见 `/.dockerignore` 文件。

---

## 三、服务器准备

### 3.1 系统要求

- **操作系统**: Ubuntu 22.04 LTS / Debian 12 / CentOS 8+
- **最低配置**: 2 核 CPU, 4GB 内存, 50GB 磁盘
- **推荐配置**: 4 核 CPU, 8GB 内存, 100GB SSD

### 3.2 安装 Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录后验证
docker --version
docker-compose --version
```

### 3.3 创建部署目录

```bash
# 创建应用目录
sudo mkdir -p /opt/{{NAME}}/{backup,logs}

# 设置权限
sudo chown -R $USER:$USER /opt/{{NAME}}
```

### 3.4 配置防火墙

```bash
# 允许必要端口
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 8120  # API (可选，如果需要直接访问)
sudo ufw enable
```

---

## 四、首次部署

### 4.1 上传配置文件

将以下文件上传到服务器 `/opt/{{NAME}}/`:

```bash
scp docker-compose.prod.yml user@server:/opt/{{NAME}}/
scp .env.prod user@server:/opt/{{NAME}}/.env.prod
```

### 4.2 配置环境变量

编辑 `/opt/{{NAME}}/.env.prod`：

```bash
# 镜像仓库
DOCKER_REGISTRY=registry.cn-hangzhou.aliyuncs.com/{{NAME}}
IMAGE_TAG=latest

# 数据库
DATABASE_URL=postgresql://xiaoyue:密码@数据库地址:5432/xiaoyue_health

# Redis
REDIS_URL=redis://:密码@redis地址:6379

# JWT (使用随机字符串)
JWT_ACCESS_SECRET=your-random-access-secret
JWT_REFRESH_SECRET=your-random-refresh-secret
```

设置文件权限：

```bash
chmod 600 /opt/{{NAME}}/.env.prod
```

### 4.3 登录镜像仓库

```bash
# 阿里云 ACR
docker login registry.cn-hangzhou.aliyuncs.com

# Docker Hub
docker login
```

### 4.4 拉取并启动服务

```bash
cd /opt/{{NAME}}

# 加载环境变量
export $(cat .env.prod | grep -v '^#' | xargs)

# 拉取镜像
docker-compose -f docker-compose.prod.yml pull

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose -f docker-compose.prod.yml ps
```

### 4.5 执行数据库迁移

```bash
# 使用 docker-compose exec 自动继承环境变量（推荐）
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma migrate deploy

# 或使用 docker exec（需明确传递环境变量）
docker exec xiaoyue-server pnpm prisma migrate deploy
```

### 4.6 验证部署

```bash
# 检查服务健康状态
curl http://localhost:8120/health

# 查看服务日志
docker logs xiaoyue-server --tail 100
```

---

## 五、CI/CD 配置

### 5.1 GitHub Secrets 配置

在仓库 `Settings → Secrets and variables → Actions` 添加：

**镜像仓库**:

```
DOCKER_REGISTRY = registry.cn-hangzhou.aliyuncs.com/{{NAME}}
DOCKER_USERNAME = 你的用户名
DOCKER_PASSWORD = 你的密码
```

**服务器 SSH**:

```
PROD_SERVER_HOST = 服务器IP
PROD_SERVER_USER = 登录用户名
PROD_SERVER_SSH_KEY = SSH私钥内容
```

### 5.2 配置 GitHub Environments

1. 进入仓库 `Settings → Environments`
2. 创建环境: `dev`, `staging`, `production`
3. 为 `production` 添加保护规则（需要审批）

### 5.3 SSH 密钥配置

在服务器上添加 GitHub Actions 的公钥：

```bash
# 在本地生成密钥对
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/github_actions.pub user@server

# 将私钥内容添加到 GitHub Secrets (PROD_SERVER_SSH_KEY)
cat ~/.ssh/github_actions
```

### 5.4 触发部署

- **自动部署**: 合并代码到 `main` 分支
- **手动部署**: GitHub Actions → CD → Run workflow

---

## 六、数据库迁移

### 6.1 开发环境迁移

```bash
# 创建新迁移
pnpm --filter server prisma migrate dev --name add_user_table

# 生成 Prisma Client
pnpm --filter server prisma:generate
```

### 6.2 生产环境迁移

**方式一：自动迁移（CD 流程）**

CD 流程会自动执行：

```bash
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma migrate deploy
```

**方式二：手动迁移**

```bash
ssh user@server
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma migrate deploy
```

### 6.3 迁移注意事项

- **【强制】** 迁移前备份数据库
- **【强制】** 在 staging 环境先测试迁移
- **【禁止】** 直接修改生产数据库
- **【推荐】** 迁移脚本保持向后兼容

---

## 七、回滚操作

### 7.1 回滚到上一个版本

```bash
cd /opt/{{NAME}}

# 查看之前的镜像版本
cat backup/previous-server-image.txt

# 设置回滚版本
export IMAGE_TAG=之前的版本号

# 重启服务
docker-compose -f docker-compose.prod.yml up -d
```

### 7.2 回滚数据库（谨慎）

```bash
# 查看迁移历史
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma migrate status

# 回滚需要手动处理,建议从备份恢复
```

### 7.3 紧急回滚脚本

```bash
#!/bin/bash
# rollback.sh - 紧急回滚脚本

cd /opt/{{NAME}}

# 读取上一个版本
PREVIOUS_IMAGE=$(cat backup/previous-server-image.txt)

# 回滚
export IMAGE_TAG=$(echo $PREVIOUS_IMAGE | cut -d: -f2)
docker-compose -f docker-compose.prod.yml up -d

echo "已回滚到: $PREVIOUS_IMAGE"
```

---

## 八、监控与日志

### 8.1 查看服务日志

```bash
# 实时日志
docker logs -f xiaoyue-server

# 最近 100 行
docker logs xiaoyue-server --tail 100

# 指定时间范围
docker logs xiaoyue-server --since "2024-01-01"
```

### 8.2 健康检查

```bash
# API 健康检查
curl http://localhost:8120/health

# Prometheus 指标
curl http://localhost:8120/metrics

# 容器健康状态
docker inspect xiaoyue-server --format='{{.State.Health.Status}}'
```

### 8.3 资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df
```

### 8.4 清理资源

```bash
# 清理未使用的镜像
docker image prune -a

# 清理构建缓存
docker builder prune

# 清理所有未使用资源（谨慎）
docker system prune -a
```

---

## 九、常见问题

### Q1: 容器启动失败

```bash
# 查看详细日志
docker logs xiaoyue-server

# 常见原因:
# - 环境变量缺失: 检查 .env.prod
# - 数据库连接失败: 检查 DATABASE_URL
# - 端口冲突: lsof -i :8120
```

### Q2: 数据库迁移失败

```bash
# 查看迁移状态
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma migrate status

# 重置迁移（仅开发环境！）
docker-compose exec -T server pnpm prisma migrate reset
```

### Q3: 镜像拉取失败

```bash
# 重新登录镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com

# 检查网络
ping registry.cn-hangzhou.aliyuncs.com
```

### Q4: 内存不足

```bash
# 检查内存使用
free -h

# 调整 Docker 内存限制 (docker-compose.prod.yml)
services:
  server:
    deploy:
      resources:
        limits:
          memory: 1G
```

### Q5: 服务响应慢

```bash
# 检查 CPU 使用
top

# 检查慢查询日志
docker logs xiaoyue-server | grep "slow query"

# 检查 Redis 连接
docker exec xiaoyue-server redis-cli -u $REDIS_URL ping
```

---

## 十、运维命令速查

```bash
# === 服务管理 ===
docker-compose -f docker-compose.prod.yml up -d      # 启动
docker-compose -f docker-compose.prod.yml down       # 停止
docker-compose -f docker-compose.prod.yml restart    # 重启
docker-compose -f docker-compose.prod.yml pull       # 更新镜像

# === 日志查看 ===
docker logs -f xiaoyue-server                        # 实时日志
docker logs xiaoyue-server --tail 100                # 最近日志

# === 数据库 ===
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma migrate deploy  # 迁移
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma studio          # 可视化

# === 进入容器 ===
docker exec -it xiaoyue-server sh

# === 健康检查 ===
curl http://localhost:8120/health
```

---

## 十一、检查清单

### 首次部署前

- [ ] 服务器已安装 Docker
- [ ] 已创建 `/opt/{{NAME}}` 目录
- [ ] `.env.prod` 已配置
- [ ] 已登录镜像仓库
- [ ] 数据库已就绪
- [ ] Redis 已就绪

### CI/CD 配置前

- [ ] GitHub Secrets 已配置
- [ ] SSH 密钥已添加到服务器
- [ ] Environments 已创建

### 发布前

- [ ] 代码已通过 CI
- [ ] Staging 环境测试通过
- [ ] 数据库迁移已测试
- [ ] 回滚方案已准备
