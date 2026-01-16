# 环境说明

## 环境定义

| 环境        | 用途       | 部署位置   | 分支       | 域名模式                      |
| ----------- | ---------- | ---------- | ---------- | ----------------------------- |
| **dev**     | 本地开发   | 开发者本机 | 任意       | localhost / \*-dev.{{DOMAIN}} |
| **staging** | 预发布验证 | 生产物理机 | release/\* | \*-staging.{{DOMAIN}}         |
| **prod**    | 生产环境   | 生产物理机 | main       | \*.{{DOMAIN}}                 |

### 部署架构

```
┌────────────────────────┐
│     开发者本机 (dev)    │
│  Docker: PostgreSQL    │
│  Docker: Redis         │
│  本地运行: 应用代码      │
└────────────────────────┘

┌────────────────────────────────────────────────────┐
│              生产物理机 (staging + prod)            │
│                                                    │
│  ┌──────────────────┐    ┌──────────────────┐     │
│  │     Staging      │    │      Prod        │     │
│  │  (独立 Docker)    │    │  (独立 Docker)   │     │
│  │  PostgreSQL      │    │  PostgreSQL      │     │
│  │  Redis           │    │  Redis           │     │
│  │  Server          │    │  Server          │     │
│  │  Admin-Web       │    │  Admin-Web       │     │
│  │  WWW-Web         │    │  WWW-Web         │     │
│  └──────────────────┘    └──────────────────┘     │
└────────────────────────────────────────────────────┘
```

> 详细 Docker 配置请参考 [Docker 基础设施部署方案](./docker-infrastructure.md)

---

## 域名分配

### 各应用各环境域名

| 应用           | dev (本地)     | staging                  | prod             |
| -------------- | -------------- | ------------------------ | ---------------- |
| **Server API** | localhost:8100 | api-staging.{{DOMAIN}}   | api.{{DOMAIN}}   |
| **Admin Web**  | localhost:3100 | admin-staging.{{DOMAIN}} | admin.{{DOMAIN}} |
| **WWW Web**    | localhost:3200 | www-staging.{{DOMAIN}}   | www.{{DOMAIN}}   |

### 本地开发域名映射（可选）

如需使用域名访问本地服务，配置 hosts：

```bash
# macOS/Linux: sudo vim /etc/hosts
# Windows: C:\Windows\System32\drivers\etc\hosts

127.0.0.1 api-dev.{{DOMAIN}}
127.0.0.1 admin-dev.{{DOMAIN}}
127.0.0.1 www-dev.{{DOMAIN}}
```

> 详细配置步骤请参考 [本地 Hosts 配置指南](../development/local-hosts-setup.md)

---

## 服务端口

### 端口规划设计

```
端口规则：避免标准端口（5432/6379/3000/8000），防止与其他项目冲突

后端 API:    81xx  (8100 / 8110 / 8120)
Admin 前端:  31xx  (3100 / 3110 / 3120)
WWW 前端:    32xx  (3200 / 3210 / 3220)
PostgreSQL:  54xx  (5400 / 5410 / 5420)
Redis:       63xx  (6300 / 6310 / 6320)

环境编号：
  x0 = dev
  x1 = staging
  x2 = prod
```

### 完整端口分配表

| 服务           | dev  | staging | prod | 容器内端口 |
| -------------- | ---- | ------- | ---- | ---------- |
| **Server API** | 8100 | 8110    | 8120 | 8100       |
| **Admin Web**  | 3100 | 3110    | 3120 | 80         |
| **WWW Web**    | 3200 | 3210    | 3220 | 80         |
| **PostgreSQL** | 5400 | 5410    | 5420 | 5432       |
| **Redis**      | 6300 | 6310    | 6320 | 6379       |

---

## 数据库分配

### 连接信息

| 环境        | PostgreSQL           | Redis             | 数据库名          | 用户名  |
| ----------- | -------------------- | ----------------- | ----------------- | ------- |
| **dev**     | localhost:5400       | localhost:6300    | xiaoyue_dev       | xiaoyue |
| **staging** | postgres:5432 (内部) | redis:6379 (内部) | {{NAME}}\_staging | xiaoyue |
| **prod**    | postgres:5432 (内部) | redis:6379 (内部) | {{NAME}}\_prod    | xiaoyue |

> **注意**：staging/prod 的应用通过 Docker 内部网络访问数据库，使用内部端口。外部运维访问使用宿主机映射端口。

### 连接串格式

```bash
# Dev（本地开发）
DATABASE_URL="postgresql://xiaoyue:密码@localhost:5400/xiaoyue_dev"
REDIS_URL="redis://:密码@localhost:6300/0"

# Staging/Prod（Docker 内部）
DATABASE_URL="postgresql://xiaoyue:密码@postgres:5432/{{NAME}}_staging"
REDIS_URL="redis://:密码@redis:6379/0"
```

> 详细数据库配置请参考 [数据库配置](./database.md)

---

## 环境配置

### Dev 环境（本地开发）

```bash
# 1. 启动本地数据库
cd deploy/dev
docker compose up -d

# 2. 配置应用环境变量
cp apps/server/.env.example apps/server/.env
# 编辑 .env，设置本地连接串

# 3. 启动应用
pnpm dev
```

### Staging/Prod 环境

通过 CI/CD 自动部署或手动部署：

```bash
cd /opt/xiaoyue/staging  # 或 prod
docker compose up -d
```

> 详细部署流程请参考 [Docker 基础设施部署方案](./docker-infrastructure.md)

---

## 各环境配置差异

### 基础配置

| 配置项    | dev         | staging | prod       |
| --------- | ----------- | ------- | ---------- |
| NODE_ENV  | development | staging | production |
| DEBUG     | true        | false   | false      |
| LOG_LEVEL | debug       | info    | info       |
| CORS      | \*          | 白名单  | 白名单     |

### Docker 配置

| 配置项       | dev  | staging        | prod     |
| ------------ | ---- | -------------- | -------- |
| restart 策略 | 无   | unless-stopped | always   |
| 资源限制     | 无   | 无             | 有       |
| 日志轮转     | 默认 | 50-100MB       | 50-200MB |
| Redis 持久化 | 关闭 | AOF            | AOF      |

### 安全配置

| 配置项   | dev | staging  | prod       |
| -------- | --- | -------- | ---------- |
| SSL/TLS  | 否  | 是       | 是         |
| 防火墙   | 无  | 有       | 有         |
| 访问限制 | 无  | 内网/VPN | 公网 + WAF |

---

## 环境变量清单

### 必填项

| 变量                 | 说明                          | 示例             |
| -------------------- | ----------------------------- | ---------------- |
| `DATABASE_URL`       | PostgreSQL 连接串             | postgresql://... |
| `REDIS_URL`          | Redis 连接串                  | redis://...      |
| `JWT_ACCESS_SECRET`  | Access Token 密钥（≥32字符）  | 随机字符串       |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（≥32字符） | 随机字符串       |

### 可选项

| 变量              | 说明                    | 默认值 |
| ----------------- | ----------------------- | ------ |
| `PORT`            | 服务端口                | 8100   |
| `JWT_ACCESS_TTL`  | Access Token 有效期     | 15m    |
| `JWT_REFRESH_TTL` | Refresh Token 有效期    | 7d     |
| `CORS_ORIGINS`    | CORS 白名单（逗号分隔） | \*     |
| `BODY_LIMIT`      | 请求体大小限制          | 1mb    |

---

## 数据库迁移

### 本地开发

```bash
# 创建并应用迁移
pnpm --filter server prisma migrate dev --name add_user_table

# 生成 Prisma Client
pnpm --filter server prisma:generate
```

### Staging/Prod

```bash
# Docker 内执行迁移
docker compose exec -T server pnpm prisma migrate deploy
```

---

## 安全要求

### 密钥管理

- **【强制】** 禁止在代码中硬编码密钥
- **【强制】** 不同环境使用不同密钥
- **【强制】** `.env` 文件权限设置为 `600`
- **【强制】** `.env` 文件不提交 Git

### 密码命名规则

| 类型       | 格式                              | 示例                             |
| ---------- | --------------------------------- | -------------------------------- |
| PostgreSQL | `Xy` + 环境缩写 + `_` + 随机      | XyDev_xxx, XyStg_xxx, XyProd_xxx |
| Redis      | `XyRedis` + 环境缩写 + `_` + 随机 | XyRedisDev_xxx, XyRedisStg_xxx   |

---

## 相关文档

- [Docker 基础设施部署方案](./docker-infrastructure.md) - 详细 Docker 配置
- [数据库配置](./database.md) - 数据库详细说明
- [密钥管理](./secrets-management.md) - 密钥生成和管理
- [CI/CD 流程](./ci-cd.md) - 自动化部署流程
