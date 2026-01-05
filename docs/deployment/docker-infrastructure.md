# Docker 基础设施部署方案

本文档描述三环境（dev / staging / prod）的 Docker 部署架构，每个环境独立运行 PostgreSQL 和 Redis。

---

## 一、架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                         开发者本机 (dev)                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              docker-compose.yml (deploy/dev/)               │ │
│  │  ┌─────────────┐  ┌─────────────┐                          │ │
│  │  │ PostgreSQL  │  │    Redis    │    ← 仅数据库服务         │ │
│  │  │    :5400    │  │    :6300    │    ← 应用代码本地运行     │ │
│  │  └─────────────┘  └─────────────┘                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                   生产物理机 (staging + prod)                     │
│                                                                  │
│  ┌─────────────────────────────────┐ ┌─────────────────────────┐ │
│  │      staging (xy-staging)      │ │       prod (xy-prod)    │ │
│  │   docker-compose.yml           │ │   docker-compose.yml    │ │
│  ├─────────────────────────────────┤ ├─────────────────────────┤ │
│  │  PostgreSQL        :5410       │ │  PostgreSQL      :5420  │ │
│  │  Redis             :6310       │ │  Redis           :6320  │ │
│  │  Server            :8110       │ │  Server          :8120  │ │
│  │  Admin-Web         :3110       │ │  Admin-Web       :3120  │ │
│  │  WWW-Web           :3210       │ │  WWW-Web         :3220  │ │
│  │                                │ │                         │ │
│  │  network: xy-staging-net       │ │  network: xy-prod-net   │ │
│  │  volumes: xy-staging-*         │ │  volumes: xy-prod-*     │ │
│  └─────────────────────────────────┘ └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 设计原则

| 原则 | 说明 |
|------|------|
| **完全隔离** | 各环境独立 Docker network、volumes、容器命名空间 |
| **端口规律** | 基础端口 `xx00`（dev）→ `+10`（staging）→ `+20`（prod） |
| **本机开发** | dev 仅启动数据库容器，应用代码在宿主机运行，便于调试 |
| **同机部署** | staging/prod 在同一物理机，通过网络隔离互不影响 |

---

## 二、端口规划

### 2.1 完整端口表

| 服务 | dev | staging | prod | 容器内端口 |
|------|-----|---------|------|-----------|
| PostgreSQL | 5400 | 5410 | 5420 | 5432 |
| Redis | 6300 | 6310 | 6320 | 6379 |
| Server API | 8100 | 8110 | 8120 | 8100 |
| Admin Web | 3100 | 3110 | 3120 | 80 |
| WWW Web | 3200 | 3210 | 3220 | 80 |

### 2.2 端口设计说明

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

---

## 三、目录结构

```
deploy/
├── dev/
│   ├── docker-compose.yml      # Dev 数据库服务
│   └── .env.example            # 环境变量模板
├── staging/
│   ├── docker-compose.yml      # Staging 全栈服务
│   └── .env.example
├── prod/
│   ├── docker-compose.yml      # Prod 全栈服务
│   └── .env.example
└── scripts/
    ├── backup.sh               # 数据库备份脚本
    └── restore.sh              # 数据库恢复脚本
```

---

## 四、Docker Compose 配置

### 4.1 Dev 环境

**用途**：开发者本机运行，仅启动数据库服务，应用代码在宿主机运行便于调试。

```yaml
# deploy/dev/docker-compose.yml
name: xy-dev

services:
  postgres:
    image: postgres:16-alpine
    container_name: xy-dev-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-xiaoyue_dev}
      POSTGRES_USER: ${POSTGRES_USER:-{{NAME}}}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
      TZ: Asia/Shanghai
    ports:
      - "5400:5432"
    volumes:
      - xy-dev-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-{{NAME}}}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - xy-dev-net

  redis:
    image: redis:7-alpine
    container_name: xy-dev-redis
    command: redis-server --requirepass ${REDIS_PASSWORD:?required}
    environment:
      REDISCLI_AUTH: ${REDIS_PASSWORD}  # 用于 healthcheck
      TZ: Asia/Shanghai
    ports:
      - "6300:6379"
    volumes:
      - xy-dev-redis:/data
    healthcheck:
      # 使用 REDISCLI_AUTH 环境变量，避免密码泄露到进程列表
      test: ["CMD-SHELL", "redis-cli --no-auth-warning ping | grep -q PONG"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - xy-dev-net

volumes:
  xy-dev-postgres:
  xy-dev-redis:

networks:
  xy-dev-net:
    driver: bridge
```

**环境变量** (`deploy/dev/.env.example`):

```bash
# PostgreSQL
POSTGRES_DB=xiaoyue_dev
POSTGRES_USER=xiaoyue
POSTGRES_PASSWORD=XyDev_ChangeMe123

# Redis
REDIS_PASSWORD=XyRedisDev_ChangeMe123
```

### 4.2 Staging 环境

**用途**：预发布验证，完整模拟生产环境。

```yaml
# deploy/staging/docker-compose.yml
name: xy-staging

services:
  # ==================== 数据库 ====================
  postgres:
    image: postgres:16-alpine
    container_name: xy-staging-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-{{NAME}}_staging}
      POSTGRES_USER: ${POSTGRES_USER:-{{NAME}}}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
      TZ: Asia/Shanghai
    ports:
      - "5410:5432"
    volumes:
      - xy-staging-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-{{NAME}}}"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-staging-net
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  redis:
    image: redis:7-alpine
    container_name: xy-staging-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD:?required} --appendonly yes
    environment:
      REDISCLI_AUTH: ${REDIS_PASSWORD}
      TZ: Asia/Shanghai
    ports:
      - "6310:6379"
    volumes:
      - xy-staging-redis:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli --no-auth-warning ping | grep -q PONG"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-staging-net
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  # ==================== 应用服务 ====================
  server:
    image: ${DOCKER_REGISTRY}/xiaoyue-server:${IMAGE_TAG:-latest}
    container_name: xy-staging-server
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: staging
      PORT: 8100
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?required}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?required}
      CORS_ORIGINS: ${CORS_ORIGINS:-}
      TZ: Asia/Shanghai
    ports:
      - "8110:8100"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8100/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    networks:
      - xy-staging-net
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  admin-web:
    image: ${DOCKER_REGISTRY}/xiaoyue-admin-web:${IMAGE_TAG:-latest}
    container_name: xy-staging-admin-web
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
    environment:
      TZ: Asia/Shanghai
    ports:
      - "3110:80"
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-staging-net
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

  www-web:
    image: ${DOCKER_REGISTRY}/xiaoyue-www-web:${IMAGE_TAG:-latest}
    container_name: xy-staging-www-web
    restart: unless-stopped
    depends_on:
      server:
        condition: service_healthy
    environment:
      TZ: Asia/Shanghai
    ports:
      - "3210:80"
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-staging-net
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"

volumes:
  xy-staging-postgres:
  xy-staging-redis:

networks:
  xy-staging-net:
    driver: bridge
```

### 4.3 Prod 环境

**用途**：生产环境，增加资源限制和更严格的重启策略。

> **安全说明**：生产数据库端口仅绑定 127.0.0.1，外部运维需通过 SSH 隧道访问。

```yaml
# deploy/prod/docker-compose.yml
name: xy-prod

services:
  # ==================== 数据库 ====================
  postgres:
    image: postgres:16-alpine
    container_name: xy-prod-postgres
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-{{NAME}}_prod}
      POSTGRES_USER: ${POSTGRES_USER:-{{NAME}}}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?required}
      TZ: Asia/Shanghai
    ports:
      # 仅绑定本机，外部访问需 SSH 隧道
      - "127.0.0.1:5420:5432"
    volumes:
      - xy-prod-postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-{{NAME}}}"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-prod-net
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
        reservations:
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "5"

  redis:
    image: redis:7-alpine
    container_name: xy-prod-redis
    restart: always
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD:?required}
      --appendonly yes
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
    environment:
      REDISCLI_AUTH: ${REDIS_PASSWORD}
      TZ: Asia/Shanghai
    ports:
      # 仅绑定本机，外部访问需 SSH 隧道
      - "127.0.0.1:6320:6379"
    volumes:
      - xy-prod-redis:/data
    healthcheck:
      test: ["CMD-SHELL", "redis-cli --no-auth-warning ping | grep -q PONG"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-prod-net
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 256M
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  # ==================== 应用服务 ====================
  server:
    image: ${DOCKER_REGISTRY}/xiaoyue-server:${IMAGE_TAG:-latest}
    container_name: xy-prod-server
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 8100
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?required}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?required}
      CORS_ORIGINS: ${CORS_ORIGINS:-}
      TZ: Asia/Shanghai
    ports:
      - "8120:8100"
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8100/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    networks:
      - xy-prod-net
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
        reservations:
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "200m"
        max-file: "10"

  admin-web:
    image: ${DOCKER_REGISTRY}/xiaoyue-admin-web:${IMAGE_TAG:-latest}
    container_name: xy-prod-admin-web
    restart: always
    depends_on:
      server:
        condition: service_healthy
    environment:
      TZ: Asia/Shanghai
    ports:
      - "3120:80"
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-prod-net
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

  www-web:
    image: ${DOCKER_REGISTRY}/xiaoyue-www-web:${IMAGE_TAG:-latest}
    container_name: xy-prod-www-web
    restart: always
    depends_on:
      server:
        condition: service_healthy
    environment:
      TZ: Asia/Shanghai
    ports:
      - "3220:80"
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost/ || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - xy-prod-net
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "5"

volumes:
  xy-prod-postgres:
  xy-prod-redis:

networks:
  xy-prod-net:
    driver: bridge
```

---

## 五、隔离机制

### 5.1 隔离维度

| 维度 | dev | staging | prod |
|------|-----|---------|------|
| **Docker 项目名** | xy-dev | xy-staging | xy-prod |
| **容器前缀** | xy-dev-* | xy-staging-* | xy-prod-* |
| **Network** | xy-dev-net | xy-staging-net | xy-prod-net |
| **Volumes** | xy-dev-* | xy-staging-* | xy-prod-* |
| **宿主机端口** | xx00 | xx10 | xx20 |

### 5.2 同机隔离原理

staging 和 prod 运行在同一物理机，通过以下方式完全隔离：

```
┌─────────────────────────────────────────────────────────────────┐
│                          宿主机                                  │
│                                                                 │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │     xy-staging-net      │    │      xy-prod-net        │    │
│  │    (172.18.0.0/16)      │    │    (172.19.0.0/16)      │    │
│  │                         │    │                         │    │
│  │  ┌─────┐ ┌─────┐       │    │  ┌─────┐ ┌─────┐       │    │
│  │  │ pg  │ │redis│       │    │  │ pg  │ │redis│       │    │
│  │  └──┬──┘ └──┬──┘       │    │  └──┬──┘ └──┬──┘       │    │
│  │     │       │          │    │     │       │          │    │
│  │  ┌──┴───────┴──┐       │    │  ┌──┴───────┴──┐       │    │
│  │  │   server    │       │    │  │   server    │       │    │
│  │  └─────────────┘       │    │  └─────────────┘       │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│           ↓                              ↓                      │
│       :5410/:6310/:8110              :5420/:6320/:8120          │
└─────────────────────────────────────────────────────────────────┘
```

**关键点**：
- Docker network 隔离：容器只能访问同一 network 内的服务
- 应用通过内部 DNS 访问数据库（`postgres:5432`），无需跨环境端口
- 宿主机端口仅用于外部访问和运维

---

## 六、部署流程

### 6.1 Dev 环境（开发者本机）

```bash
# 1. 进入配置目录
cd deploy/dev

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，设置密码

# 3. 启动数据库服务
docker compose up -d

# 4. 验证服务状态
docker compose ps
docker compose logs -f

# 5. 配置应用连接
# 在 apps/server/.env 中设置：
# DATABASE_URL="postgresql://xiaoyue:密码@localhost:5400/xiaoyue_dev"
# REDIS_URL="redis://:密码@localhost:6300/0"
```

### 6.2 Staging/Prod 环境（物理机）

```bash
# ========== 首次部署 ==========

# 1. 创建部署目录
sudo mkdir -p /opt/xiaoyue/{staging,prod}
sudo chown -R $USER:$USER /opt/xiaoyue

# 2. 上传配置文件
scp deploy/staging/docker-compose.yml user@server:/opt/xiaoyue/staging/
scp deploy/prod/docker-compose.yml user@server:/opt/xiaoyue/prod/

# 3. 配置环境变量
cd /opt/xiaoyue/staging
cp /path/to/.env.example .env
chmod 600 .env
# 编辑 .env，填入真实配置

cd /opt/xiaoyue/prod
cp /path/to/.env.example .env
chmod 600 .env
# 编辑 .env，填入真实配置

# 4. 登录镜像仓库
docker login your-registry.com

# 5. 启动 Staging
cd /opt/xiaoyue/staging
docker compose up -d

# 6. 启动 Prod
cd /opt/xiaoyue/prod
docker compose up -d

# ========== 日常更新 ==========

# 拉取新镜像并重启（零停机滚动更新）
cd /opt/xiaoyue/staging  # 或 prod
docker compose pull
docker compose up -d --no-deps server admin-web www-web

# 执行数据库迁移
docker compose exec -T server pnpm prisma migrate deploy
```

---

## 七、环境变量配置

### 7.1 Staging/Prod 环境变量模板

```bash
# deploy/staging/.env.example 或 deploy/prod/.env.example

# ==================== Docker Registry ====================
DOCKER_REGISTRY=your-registry.com/xiaoyue
IMAGE_TAG=latest

# ==================== PostgreSQL ====================
POSTGRES_DB={{NAME}}_staging    # prod: {{NAME}}_prod
POSTGRES_USER=xiaoyue
POSTGRES_PASSWORD=             # 使用强密码

# ==================== Redis ====================
REDIS_PASSWORD=                # 使用强密码

# ==================== JWT ====================
# 至少 32 字符的随机字符串
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

# ==================== CORS ====================
# 逗号分隔的允许域名
CORS_ORIGINS=https://admin-staging.{{DOMAIN}},https://www-staging.{{DOMAIN}}
```

### 7.2 密码生成

```bash
# 生成 32 位随机密码
openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32

# 生成 JWT 密钥（64 字节 Base64）
openssl rand -base64 64 | tr -d '\n'
```

---

## 八、配置差异对比

### 8.1 环境配置差异

| 配置项 | dev | staging | prod |
|--------|-----|---------|------|
| **restart** | 无 | unless-stopped | always |
| **资源限制** | 无 | 有 (CPU + 内存) | 有 (CPU + 内存) |
| **数据库端口绑定** | 0.0.0.0 | 0.0.0.0 | 127.0.0.1 (仅本机) |
| **Redis AOF** | 关 | 开 | 开 |
| **Redis maxmemory** | 无限制 | 无限制 | 512MB |
| **日志大小** | 默认 | 50-100MB | 50-200MB |
| **日志文件数** | 默认 | 3-5 | 5-10 |
| **healthcheck 间隔** | 10s | 30s | 30s |
| **时区** | Asia/Shanghai | Asia/Shanghai | Asia/Shanghai |
| **前端 healthcheck** | 无 | 有 | 有 |

### 8.2 应用行为差异

| 配置 | dev | staging | prod |
|------|-----|---------|------|
| **NODE_ENV** | development | staging | production |
| **日志级别** | debug | info | info |
| **CORS** | * | 白名单 | 白名单 |
| **调试工具** | 启用 | 禁用 | 禁用 |

---

## 九、备份策略

### 9.1 备份脚本

```bash
#!/bin/bash
# deploy/scripts/backup.sh

ENV=${1:-staging}
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/xiaoyue/backups/${ENV}
ENV_FILE="/opt/xiaoyue/${ENV}/.env"

mkdir -p ${BACKUP_DIR}

# 安全读取环境变量（避免 source 的安全隐患）
get_env_var() {
    grep -E "^${1}=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

POSTGRES_USER=$(get_env_var "POSTGRES_USER")
POSTGRES_DB=$(get_env_var "POSTGRES_DB")
REDIS_PASSWORD=$(get_env_var "REDIS_PASSWORD")

# PostgreSQL 备份
docker exec xy-${ENV}-postgres pg_dump \
  -U ${POSTGRES_USER:-{{NAME}}} \
  ${POSTGRES_DB:-xiaoyue_${ENV}} | gzip > ${BACKUP_DIR}/pg_${DATE}.sql.gz

# Redis 备份（使用 LASTSAVE 检查完成状态）
PREV_LASTSAVE=$(docker exec xy-${ENV}-redis redis-cli --no-auth-warning LASTSAVE | grep -oE '[0-9]+')
docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD}" xy-${ENV}-redis redis-cli --no-auth-warning BGSAVE
while true; do
    CURRENT=$(docker exec xy-${ENV}-redis redis-cli --no-auth-warning LASTSAVE | grep -oE '[0-9]+')
    [ "$CURRENT" != "$PREV_LASTSAVE" ] && break
    sleep 1
done
docker cp xy-${ENV}-redis:/data/dump.rdb ${BACKUP_DIR}/redis_${DATE}.rdb

# 清理 7 天前的备份
find ${BACKUP_DIR} -mtime +7 -delete

echo "Backup completed: ${BACKUP_DIR}"
```

### 9.2 定时备份（Crontab）

```bash
# 每日凌晨 3 点备份 staging
0 3 * * * /opt/xiaoyue/scripts/backup.sh staging

# 每日凌晨 4 点备份 prod
0 4 * * * /opt/xiaoyue/scripts/backup.sh prod
```

---

## 十、运维命令速查

### 10.1 服务管理

```bash
# 进入环境目录
cd /opt/xiaoyue/staging  # 或 prod

# 启动所有服务
docker compose up -d

# 停止所有服务
docker compose down

# 重启单个服务
docker compose restart server

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f server
docker compose logs --tail 100 postgres
```

### 10.2 数据库操作

```bash
# 进入 PostgreSQL
docker exec -it xy-staging-postgres psql -U xiaoyue -d {{NAME}}_staging

# 进入 Redis
docker exec -it xy-staging-redis redis-cli -a ${REDIS_PASSWORD}

# 执行迁移
docker compose exec -T server pnpm prisma migrate deploy

# 打开 Prisma Studio
docker compose exec -T server pnpm prisma studio
```

### 10.3 故障排查

```bash
# 查看容器资源使用
docker stats

# 检查容器健康状态
docker inspect xy-staging-server --format='{{.State.Health.Status}}'

# 进入容器调试
docker exec -it xy-staging-server sh

# 查看网络
docker network inspect xy-staging-net
```

---

## 十一、安全注意事项

### 11.1 密码安全

- **【强制】** 各环境使用不同密码
- **【强制】** `.env` 文件权限设置为 `600`
- **【强制】** 禁止将密码提交到 Git
- **【推荐】** 定期轮换生产密码（90 天）

### 11.2 网络安全

- **【强制】** 生产数据库端口绑定 127.0.0.1，不暴露公网
- **【强制】** 外部运维通过 SSH 隧道访问：`ssh -L 5420:127.0.0.1:5420 user@server`
- **【推荐】** 使用防火墙限制可访问 IP
- **【推荐】** 生产环境使用 SSL/TLS 加密

### 11.3 备份安全

- **【强制】** 备份文件加密存储
- **【强制】** 定期测试备份恢复流程
- **【推荐】** 备份文件异地存储

---

## 十二、Dockerfile 构建策略

### 12.1 构建架构

项目使用 **Turbo Prune** 优化 Monorepo 构建，多阶段构建减少镜像体积：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Docker Build 流程                              │
│                                                                         │
│  阶段 0: Pruner          阶段 1: Deps           阶段 2: Builder          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │ turbo prune     │───▶│ pnpm install    │───▶│ pnpm build      │     │
│  │ 裁剪 monorepo   │    │ 安装依赖        │    │ 构建应用        │     │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                                        │                │
│                                                        ▼                │
│                                               阶段 3: Runner            │
│                                              ┌─────────────────┐        │
│                                              │ 生产运行时      │        │
│                                              │ (最小化镜像)    │        │
│                                              └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Server Dockerfile

**位置**: `apps/server/Dockerfile`

**关键特性**:
- 使用 `turbo prune @{{NAME}}/server --docker` 裁剪 Monorepo
- 4 阶段构建：pruner → deps → builder → runner
- 非 root 用户运行 (nestjs:1001)
- 使用 dumb-init 作为 PID 1（正确处理信号）
- 内置健康检查

**构建命令**:
```bash
# 从项目根目录执行
docker build -f apps/server/Dockerfile -t xiaoyue-server .

# 运行测试
docker run -p 8100:8100 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e REDIS_URL=redis://:pass@host:6379/0 \
  -e JWT_ACCESS_SECRET=xxx \
  -e JWT_REFRESH_SECRET=xxx \
  xiaoyue-server
```

**最终镜像内容**:
```
/app/
├── apps/server/
│   ├── dist/           # 编译后的代码
│   ├── prisma/         # Schema 和迁移文件
│   └── scripts/        # 运维脚本
├── packages/           # 共享包
└── node_modules/       # 仅生产依赖
```

### 12.3 前端 Dockerfile

**位置**: `apps/admin-web/Dockerfile`, `apps/www-web/Dockerfile`

**关键特性**:
- 同样使用 Turbo Prune 裁剪
- 支持 `VITE_API_BASE_URL` 构建参数
- 最终阶段使用 nginx:alpine（~25MB）
- 非 root 用户运行 (nginx)

**构建命令**:
```bash
# Admin Web
docker build -f apps/admin-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.{{DOMAIN}} \
  -t xiaoyue-admin-web .

# WWW Web
docker build -f apps/www-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api.{{DOMAIN}} \
  -t xiaoyue-www-web .
```

### 12.4 Nginx 配置

**位置**: `apps/admin-web/nginx.conf`, `apps/www-web/nginx.conf`

**核心功能**:
| 功能 | 配置 |
|------|------|
| SPA 路由 | `try_files $uri $uri/ /index.html` |
| API 代理 | `/api/` → `http://server:8100` |
| Gzip 压缩 | 启用，level 6 |
| 静态资源缓存 | 1 年（带 hash 的文件） |
| 健康检查 | `/health` 返回 200 |
| 安全头 | X-Frame-Options, X-Content-Type-Options |

### 12.5 .dockerignore

**位置**: 项目根目录 `.dockerignore`

**排除内容**:
```
node_modules/        # 容器内重新安装
dist/                # 容器内重新构建
.env*                # 敏感信息不入镜像
.git/                # 版本控制不需要
docs/                # 文档不需要
*.test.ts            # 测试文件不需要
apps/miniprogram/    # 小程序不参与 Docker 构建
```

### 12.6 镜像大小参考

| 镜像 | 基础镜像 | 预估大小 |
|------|----------|----------|
| server | node:20-alpine | ~200MB |
| admin-web | nginx:alpine | ~30MB |
| www-web | nginx:alpine | ~30MB |

---

## 十三、CI/CD 流程

### 13.1 流程概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CI/CD 完整流程                                 │
│                                                                         │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐               │
│  │ Push/PR      │   │  CI Pipeline │   │  CD Pipeline │               │
│  │ main/develop │──▶│  (ci.yml)    │   │  (cd.yml)    │               │
│  └──────────────┘   └──────┬───────┘   └──────┬───────┘               │
│                            │                   │                        │
│                            ▼                   │                        │
│  ┌─────────────────────────────────────────┐   │                        │
│  │ 1. Install dependencies                  │   │                        │
│  │ 2. Prisma generate                       │   │                        │
│  │ 3. Lint                                  │   │                        │
│  │ 4. Typecheck                             │   │                        │
│  │ 5. Build                                 │   │                        │
│  │ 6. Test                                  │   │                        │
│  └─────────────────────────────────────────┘   │                        │
│                                                │                        │
│  ┌──────────────┐                             │                        │
│  │ Push         │                             │                        │
│  │ release/*    │─────────────────────────────┤                        │
│  │ main         │                             │                        │
│  └──────────────┘                             │                        │
│                                                ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ CD Pipeline                                                      │   │
│  │ ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │   │
│  │ │ Prepare   │─▶│   Build   │─▶│  Deploy   │─▶│  Health   │     │   │
│  │ │ (环境判断) │  │  (镜像)   │  │  (SSH)    │  │  Check    │     │   │
│  │ └───────────┘  └───────────┘  └───────────┘  └───────────┘     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 13.2 CI 流程 (ci.yml)

**触发条件**:
- Push 到 `main` 或 `develop` 分支
- PR 目标为 `main` 或 `develop`

**执行步骤**:
```yaml
jobs:
  ci:
    steps:
      - Checkout 代码
      - Setup pnpm
      - Setup Node.js 20 (带缓存)
      - pnpm install --frozen-lockfile
      - pnpm prisma:generate
      - pnpm lint
      - pnpm typecheck
      - pnpm build
      - pnpm test (server, admin-web, shared-utils)
```

### 13.3 CD 流程 (cd.yml)

**触发条件**:
| 触发 | 目标环境 |
|------|----------|
| Push `release/*` | staging |
| Push `main` | production (需批准) |
| 手动触发 | 可选 staging/production |

**执行阶段**:

#### 阶段 1: Prepare
```yaml
- 判断目标环境 (staging/production)
- 生成镜像 Tag (commit SHA 前 7 位)
```

#### 阶段 2: Build (并行构建)
```yaml
matrix:
  - server (apps/server/Dockerfile)
  - admin-web (apps/admin-web/Dockerfile)
  - www-web (apps/www-web/Dockerfile)

steps:
  - Docker Buildx 设置
  - 登录镜像仓库
  - 构建并推送镜像 (带 GitHub Actions 缓存)
```

#### 阶段 3: Deploy (SSH)
```yaml
- 连接目标服务器
- 备份当前版本信息
- 生成 docker-compose.yml
- 拉取新镜像
- 启动容器
- 等待健康检查
- 执行数据库迁移
- 执行种子数据 (可选)
- 清理旧镜像
```

#### 阶段 4: Health Check
```yaml
- 检查 API Server 健康
- 检查 Admin Web 可访问
- 检查 WWW Web 可访问
```

### 13.4 回滚机制

CD 流程内置自动回滚功能：

```bash
rollback() {
  local reason="$1"
  echo "🔄 开始回滚: $reason"

  if [ -f "$BACKUP_DIR/previous-images.env" ]; then
    source "$BACKUP_DIR/previous-images.env"
    if [ -n "$PREV_IMAGE_TAG" ]; then
      export IMAGE_TAG="$PREV_IMAGE_TAG"
      docker-compose -f docker-compose.prod.yml up -d
      echo "✅ 回滚完成"
    fi
  fi
  exit 1
}
```

**触发回滚的场景**:
- 容器启动失败
- 健康检查超时 (60 秒)
- 数据库迁移失败

### 13.5 GitHub Secrets 配置

在 `Settings → Secrets and variables → Actions` 中配置：

#### 镜像仓库
| Secret | 说明 | 示例 |
|--------|------|------|
| `DOCKER_REGISTRY` | 镜像仓库地址 | `registry.cn-hangzhou.aliyuncs.com/xiaoyue` |
| `DOCKER_USERNAME` | 仓库用户名 | |
| `DOCKER_PASSWORD` | 仓库密码 | |

#### 服务器 SSH (Staging)
| Secret | 说明 |
|--------|------|
| `STAGING_SERVER_HOST` | 服务器 IP 或域名 |
| `STAGING_SERVER_USER` | SSH 用户名 |
| `STAGING_SERVER_SSH_KEY` | SSH 私钥（完整内容） |

#### 服务器 SSH (Production)
| Secret | 说明 |
|--------|------|
| `PROD_SERVER_HOST` | 服务器 IP 或域名 |
| `PROD_SERVER_USER` | SSH 用户名 |
| `PROD_SERVER_SSH_KEY` | SSH 私钥（完整内容） |

#### 应用环境变量
| Secret | 说明 |
|--------|------|
| `STAGING_DATABASE_URL` | Staging PostgreSQL 连接串 |
| `STAGING_REDIS_URL` | Staging Redis 连接串 |
| `STAGING_JWT_ACCESS_SECRET` | Staging JWT 密钥 |
| `STAGING_JWT_REFRESH_SECRET` | Staging JWT 刷新密钥 |
| `STAGING_CORS_ORIGINS` | Staging CORS 白名单 |
| `PROD_DATABASE_URL` | Production PostgreSQL 连接串 |
| `PROD_REDIS_URL` | Production Redis 连接串 |
| `PROD_JWT_ACCESS_SECRET` | Production JWT 密钥 |
| `PROD_JWT_REFRESH_SECRET` | Production JWT 刷新密钥 |
| `PROD_CORS_ORIGINS` | Production CORS 白名单 |
| `CONFIG_ENCRYPTION_KEY` | 配置加密密钥 |

### 13.6 手动触发部署

```yaml
workflow_dispatch:
  inputs:
    environment:
      description: '部署环境'
      required: true
      default: 'staging'
      type: choice
      options:
        - staging
        - production
```

在 GitHub Actions 页面可手动触发，选择目标环境。

### 13.7 镜像标签策略

| 标签格式 | 说明 | 示例 |
|----------|------|------|
| `{sha}` | Commit SHA 前 7 位 | `a1b2c3d` |
| `{env}-latest` | 环境最新版本 | `staging-latest`, `production-latest` |

---

## 相关文档

- [环境说明](./environments.md) - 各环境配置差异
- [完整部署手册](./DEPLOYMENT_GUIDE.md) - 详细部署步骤
- [密钥管理](./secrets-management.md) - 密钥生成和管理
