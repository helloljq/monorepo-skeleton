# 部署快速参考指南

本文档提供日常开发和部署的快速参考，详细说明请参阅 [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 和 [docker-infrastructure.md](./docker-infrastructure.md)。

---

## 一、本地开发

### 方式一：一键启动（推荐）

在项目根目录执行：

```bash
# 复制粘贴以下命令（一次性执行）
cd deploy/dev && cp .env.example .env && docker compose up -d && cd ../..
```

然后配置 Server 并启动：

```bash
cp apps/server/.env.example apps/server/.env
pnpm install
pnpm --filter server prisma:generate
pnpm dev
```

> `.env.example` 已预配置好本地 Docker 数据库连接，无需修改即可使用。

### 方式二：分步骤执行

<details>
<summary>点击展开详细步骤</summary>

**第 1 步：启动数据库**

```bash
cd deploy/dev

# .env.example 是隐藏文件，用 ls -a 可以看到
ls -a
# 输出: .  ..  .env.example  docker-compose.yml

# 复制配置文件
cp .env.example .env

# 启动数据库
docker compose up -d

# 查看状态（两个服务都应该是 running）
docker compose ps
```

**第 2 步：配置 Server**

```bash
cp apps/server/.env.example apps/server/.env
```

> `.env.example` 已预配置好本地 Docker 数据库连接，无需修改。

**第 3 步：启动应用**

```bash
cd ../..  # 回到项目根目录
pnpm install
pnpm --filter server prisma:generate
pnpm dev
```

</details>

### 验证服务

启动后访问以下地址确认服务正常：

| 服务 | 地址 | 说明 |
|------|------|------|
| Server API | http://localhost:8100/health | 应返回 `{"status":"ok"}` |
| Server Swagger | http://localhost:8100/api | API 文档 |
| Admin Web | http://localhost:3100 | 管理后台 |
| WWW Web | http://localhost:3200 | C 端 H5 |

### 停止服务

```bash
# 停止数据库
cd deploy/dev && docker compose down

# 停止应用（在运行 pnpm dev 的终端按 Ctrl+C）
```

### 本地端口速查

| 服务 | 端口 |
|------|------|
| PostgreSQL | 5400 |
| Redis | 6300 |
| Server API | 8100 |
| Admin Web | 3100 |
| WWW Web | 3200 |

---

## 二、发布到 Staging

### 自动部署（推荐）

```bash
# 创建 release 分支并推送
git checkout -b release/v1.0.0
git push origin release/v1.0.0
# GitHub Actions 自动构建并部署到 staging
```

### 手动触发

1. 进入 GitHub → Actions → CD
2. 点击 "Run workflow"
3. 选择 `staging` 环境

### 部署后访问

| 服务 | URL | 端口 |
|------|-----|------|
| API | https://api-staging.{{DOMAIN}} | 8110 |
| Admin | https://admin-staging.{{DOMAIN}} | 3110 |
| WWW | https://www-staging.{{DOMAIN}} | 3210 |

---

## 三、发布到 Production

### 自动部署

```bash
# 合并到 main 分支
git checkout main
git merge release/v1.0.0
git push origin main
# GitHub Actions 触发，需要手动批准
```

### 手动触发

1. 进入 GitHub → Actions → CD
2. 点击 "Run workflow"
3. 选择 `production` 环境
4. 在 Environment 保护规则中批准部署

### 部署后访问

| 服务 | URL | 端口 |
|------|-----|------|
| API | https://api.{{DOMAIN}} | 8120 |
| Admin | https://admin.{{DOMAIN}} | 3120 |
| WWW | https://www.{{DOMAIN}} | 3220 |

---

## 四、GitHub Secrets 配置

在 **Settings → Secrets and variables → Actions** 中配置：

### 镜像仓库（必需）

| Secret | 说明 | 示例 |
|--------|------|------|
| `DOCKER_REGISTRY` | 镜像仓库地址 | `registry.cn-hangzhou.aliyuncs.com/{{NAME}}` |
| `DOCKER_USERNAME` | 仓库用户名 | - |
| `DOCKER_PASSWORD` | 仓库密码/Token | - |

### Staging 服务器 SSH

| Secret | 说明 |
|--------|------|
| `STAGING_SERVER_HOST` | 服务器 IP 或域名 |
| `STAGING_SERVER_USER` | SSH 用户名 |
| `STAGING_SERVER_SSH_KEY` | SSH 私钥（完整内容，包含 BEGIN/END） |

### Production 服务器 SSH

| Secret | 说明 |
|--------|------|
| `PROD_SERVER_HOST` | 服务器 IP 或域名 |
| `PROD_SERVER_USER` | SSH 用户名 |
| `PROD_SERVER_SSH_KEY` | SSH 私钥 |

### Staging 环境变量

| Secret | 说明 | 示例 |
|--------|------|------|
| `STAGING_DATABASE_URL` | PostgreSQL 连接串 | `postgresql://xiaoyue:pwd@host:5410/{{NAME}}_staging` |
| `STAGING_REDIS_URL` | Redis 连接串 | `redis://:pwd@host:6310/0` |
| `STAGING_JWT_ACCESS_SECRET` | JWT 密钥（≥32字符） | 使用 `openssl rand -base64 32` 生成 |
| `STAGING_JWT_REFRESH_SECRET` | JWT 刷新密钥 | 同上 |
| `STAGING_CORS_ORIGINS` | CORS 白名单 | `https://admin-staging.{{DOMAIN}},https://www-staging.{{DOMAIN}}` |

### Production 环境变量

| Secret | 说明 |
|--------|------|
| `PROD_DATABASE_URL` | PostgreSQL 连接串 |
| `PROD_REDIS_URL` | Redis 连接串 |
| `PROD_JWT_ACCESS_SECRET` | JWT 密钥 |
| `PROD_JWT_REFRESH_SECRET` | JWT 刷新密钥 |
| `PROD_CORS_ORIGINS` | CORS 白名单 |

### 共享

| Secret | 说明 |
|--------|------|
| `CONFIG_ENCRYPTION_KEY` | 配置加密密钥 |

---

## 五、密钥生成命令

```bash
# 生成 32 位随机密码
openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32

# 生成 JWT 密钥（64 字节 Base64）
openssl rand -base64 64 | tr -d '\n'
```

---

## 六、端口规划速查

| 服务 | Dev | Staging | Prod |
|------|-----|---------|------|
| PostgreSQL | 5400 | 5410 | 5420 |
| Redis | 6300 | 6310 | 6320 |
| Server API | 8100 | 8110 | 8120 |
| Admin Web | 3100 | 3110 | 3120 |
| WWW Web | 3200 | 3210 | 3220 |

---

## 七、常用运维命令

### 本地开发

```bash
# 启动/停止数据库
cd deploy/dev
docker compose up -d
docker compose down

# 查看日志
docker compose logs -f
```

### 服务器运维

```bash
# SSH 到服务器后
cd /opt/xiaoyue/staging  # 或 prod

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f server

# 重启服务
docker compose restart server

# 执行数据库迁移
docker compose exec -T server pnpm prisma migrate deploy

# 手动备份
/opt/xiaoyue/scripts/backup.sh staging  # 或 prod
```

### 数据库访问

```bash
# 本地连接 staging 数据库（需 SSH 隧道，因为端口只绑定 127.0.0.1）
ssh -L 5410:127.0.0.1:5410 user@staging-server

# 然后本地连接
psql -h localhost -p 5410 -U xiaoyue -d {{NAME}}_staging
```

---

## 八、发布检查清单

### 发布到 Staging 前

- [ ] 代码已通过 CI（lint、typecheck、test）
- [ ] 本地测试通过
- [ ] 数据库迁移脚本已准备（如有）

### 发布到 Production 前

- [ ] Staging 环境测试通过
- [ ] 数据库迁移已在 Staging 验证
- [ ] 回滚方案已准备
- [ ] 相关人员已通知

---

## 相关文档

| 文档 | 说明 |
|------|------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | 完整部署操作手册 |
| [docker-infrastructure.md](./docker-infrastructure.md) | Docker 基础设施详细说明 |
| [secrets-management.md](./secrets-management.md) | 密钥管理指南 |
| [ci-cd.md](./ci-cd.md) | CI/CD 流程说明 |
