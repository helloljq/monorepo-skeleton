# 数据库配置

本文档描述 PostgreSQL 和 Redis 在各环境中的配置和使用方式。

---

## 架构概览

```
┌────────────────────────────────────────────────────────────────┐
│                       开发者本机 (dev)                          │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Docker Compose (deploy/dev/)                │ │
│  │  ┌─────────────────┐    ┌─────────────────┐             │ │
│  │  │   PostgreSQL    │    │      Redis      │             │ │
│  │  │   :5400→5432    │    │   :6300→6379    │             │ │
│  │  └─────────────────┘    └─────────────────┘             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              ↓                                 │
│                    应用代码 (本地运行)                          │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                    生产物理机 (staging + prod)                  │
│                                                                │
│  ┌───────────────────────────┐  ┌───────────────────────────┐ │
│  │        xy-staging         │  │         xy-prod           │ │
│  │  ┌───────┐  ┌───────┐    │  │  ┌───────┐  ┌───────┐    │ │
│  │  │  PG   │  │ Redis │    │  │  │  PG   │  │ Redis │    │ │
│  │  │:5410  │  │:6310  │    │  │  │:5420  │  │:6320  │    │ │
│  │  └───┬───┘  └───┬───┘    │  │  └───┬───┘  └───┬───┘    │ │
│  │      └────┬─────┘        │  │      └────┬─────┘        │ │
│  │           ↓              │  │           ↓              │ │
│  │      ┌────────┐          │  │      ┌────────┐          │ │
│  │      │ Server │          │  │      │ Server │          │ │
│  │      │ :8110  │          │  │      │ :8120  │          │ │
│  │      └────────┘          │  │      └────────┘          │ │
│  └───────────────────────────┘  └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 端口分配

| 服务 | dev | staging | prod | 容器内端口 |
|------|-----|---------|------|-----------|
| **PostgreSQL** | 5400 | 5410 | 5420 | 5432 |
| **Redis** | 6300 | 6310 | 6320 | 6379 |

---

## PostgreSQL 配置

### 连接信息

| 环境 | 宿主机端口 | 数据库名 | 用户名 | 密码格式 |
|------|-----------|----------|--------|----------|
| **dev** | 5400 | xiaoyue_dev | xiaoyue | `XyDev_[随机]` |
| **staging** | 5410 | {{NAME}}_staging | xiaoyue | `XyStg_[随机]` |
| **prod** | 5420 | {{NAME}}_prod | xiaoyue | `XyProd_[随机]` |

### 连接串格式

```bash
# ========== Dev 环境 ==========
# 本地开发，应用直接连接宿主机端口
DATABASE_URL="postgresql://xiaoyue:XyDev_xxx@localhost:5400/xiaoyue_dev"

# ========== Staging/Prod 环境 ==========
# Docker 内部通信，使用容器名和内部端口
DATABASE_URL="postgresql://xiaoyue:XyStg_xxx@postgres:5432/{{NAME}}_staging"
DATABASE_URL="postgresql://xiaoyue:XyProd_xxx@postgres:5432/{{NAME}}_prod"

# 外部运维连接（使用宿主机端口）
DATABASE_URL="postgresql://xiaoyue:XyStg_xxx@服务器IP:5410/{{NAME}}_staging"
DATABASE_URL="postgresql://xiaoyue:XyProd_xxx@服务器IP:5420/{{NAME}}_prod"
```

### Docker Compose 配置

```yaml
# 通用 PostgreSQL 配置
postgres:
  image: postgres:16-alpine
  container_name: xy-${ENV}-postgres
  restart: unless-stopped  # prod 使用 always
  environment:
    POSTGRES_DB: ${POSTGRES_DB}
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  ports:
    - "${PG_PORT}:5432"
  volumes:
    - xy-${ENV}-postgres:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
    interval: 30s
    timeout: 10s
    retries: 3
  logging:
    driver: "json-file"
    options:
      max-size: "100m"
      max-file: "5"
```

---

## Redis 配置

### 连接信息

| 环境 | 宿主机端口 | 数据库号 | 密码格式 |
|------|-----------|----------|----------|
| **dev** | 6300 | 0 | `XyRedisDev_[随机]` |
| **staging** | 6310 | 0 | `XyRedisStg_[随机]` |
| **prod** | 6320 | 0 | `XyRedisProd_[随机]` |

### 连接串格式

```bash
# ========== Dev 环境 ==========
REDIS_URL="redis://:XyRedisDev_xxx@localhost:6300/0"

# ========== Staging/Prod 环境 ==========
# Docker 内部通信
REDIS_URL="redis://:XyRedisStg_xxx@redis:6379/0"
REDIS_URL="redis://:XyRedisProd_xxx@redis:6379/0"

# 外部运维连接
REDIS_URL="redis://:XyRedisStg_xxx@服务器IP:6310/0"
REDIS_URL="redis://:XyRedisProd_xxx@服务器IP:6320/0"
```

### Docker Compose 配置

```yaml
# Dev 环境（简化配置）
redis:
  image: redis:7-alpine
  container_name: xy-dev-redis
  command: redis-server --requirepass ${REDIS_PASSWORD}
  ports:
    - "6300:6379"
  volumes:
    - xy-dev-redis:/data

# Staging/Prod 环境（启用持久化和内存限制）
redis:
  image: redis:7-alpine
  container_name: xy-${ENV}-redis
  restart: always
  command: >
    redis-server
    --requirepass ${REDIS_PASSWORD}
    --appendonly yes
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
  ports:
    - "${REDIS_PORT}:6379"
  volumes:
    - xy-${ENV}-redis:/data
  healthcheck:
    test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### Redis 用途

| 用途 | 说明 |
|------|------|
| **会话存储** | Refresh Token 存储 |
| **缓存** | 热点数据缓存 |
| **幂等性控制** | 请求去重 |
| **分布式锁** | 防止并发冲突 |
| **Socket.io 适配器** | 多实例消息同步 |

---

## 命名规则

| 项目 | 规则 | 示例 |
|------|------|------|
| 数据库名 | `xiaoyue_` + 环境 | xiaoyue_dev, {{NAME}}_staging, {{NAME}}_prod |
| 用户名 | 统一使用 `xiaoyue` | xiaoyue |
| PostgreSQL 密码 | `Xy` + 环境缩写 + `_` + 随机 | XyDev_xxx, XyStg_xxx, XyProd_xxx |
| Redis 密码 | `XyRedis` + 环境缩写 + `_` + 随机 | XyRedisDev_xxx, XyRedisStg_xxx |
| 容器名 | `xy-` + 环境 + `-` + 服务 | xy-dev-postgres, xy-prod-redis |
| Volume 名 | `xy-` + 环境 + `-` + 服务 | xy-staging-postgres |

---

## 本地开发配置

### 启动数据库

```bash
# 进入配置目录
cd deploy/dev

# 创建环境变量文件
cp .env.example .env
# 编辑 .env 设置密码

# 启动数据库服务
docker compose up -d

# 验证服务状态
docker compose ps
docker compose logs postgres
docker compose logs redis
```

### 配置应用

在 `apps/server/.env` 中设置：

```bash
DATABASE_URL="postgresql://xiaoyue:你的密码@localhost:5400/xiaoyue_dev"
REDIS_URL="redis://:你的Redis密码@localhost:6300/0"
```

### 停止和清理

```bash
# 停止服务（保留数据）
docker compose down

# 停止并删除数据（谨慎！）
docker compose down -v
```

---

## 常用命令

### 连接数据库

```bash
# ========== PostgreSQL ==========
# Dev 环境
docker exec -it xy-dev-postgres psql -U xiaoyue -d xiaoyue_dev

# Staging 环境
docker exec -it xy-staging-postgres psql -U xiaoyue -d {{NAME}}_staging

# 使用 psql 客户端（需安装）
psql "postgresql://xiaoyue:密码@localhost:5400/xiaoyue_dev"

# ========== Redis ==========
# Dev 环境
docker exec -it xy-dev-redis redis-cli -a 密码

# Staging 环境
docker exec -it xy-staging-redis redis-cli -a 密码
```

### Prisma 迁移

```bash
# ========== 本地开发 ==========
# 创建迁移
pnpm --filter server prisma migrate dev --name add_user_table

# 生成 Prisma Client
pnpm --filter server prisma:generate

# 重置数据库（谨慎！会删除所有数据）
pnpm --filter server prisma migrate reset

# 打开 Prisma Studio
pnpm --filter server prisma studio

# ========== Staging/Prod ==========
# 应用迁移（在容器内）
docker compose exec -T server pnpm prisma migrate deploy

# 查看迁移状态
docker compose exec -T server pnpm prisma migrate status
```

### 数据备份与恢复

```bash
# ========== 备份 ==========
# PostgreSQL 备份
docker exec xy-staging-postgres pg_dump -U xiaoyue {{NAME}}_staging > backup_$(date +%Y%m%d).sql
docker exec xy-staging-postgres pg_dump -U xiaoyue {{NAME}}_staging | gzip > backup_$(date +%Y%m%d).sql.gz

# Redis 备份（触发 RDB 快照）
docker exec xy-staging-redis redis-cli -a 密码 BGSAVE
docker cp xy-staging-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb

# ========== 恢复 ==========
# PostgreSQL 恢复
cat backup_20250104.sql | docker exec -i xy-staging-postgres psql -U xiaoyue -d {{NAME}}_staging
gunzip -c backup_20250104.sql.gz | docker exec -i xy-staging-postgres psql -U xiaoyue -d {{NAME}}_staging

# Redis 恢复
docker compose stop redis
docker cp redis_backup.rdb xy-staging-redis:/data/dump.rdb
docker compose start redis
```

---

## 备份策略

### 备份架构

```
┌─────────────────────────────────────────────────────────────┐
│                     服务器 (lxx_aliyun)                      │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Crontab                                                 ││
│  │   03:00 → backup.sh staging                             ││
│  │   04:00 → backup.sh prod 30                             ││
│  └──────────────────────┬──────────────────────────────────┘│
│                         ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ /opt/xiaoyue/backups/                                   ││
│  │   staging/ (本地保留 7 天)                               ││
│  │   prod/    (本地保留 30 天)                              ││
│  └──────────────────────┬──────────────────────────────────┘│
└─────────────────────────┼───────────────────────────────────┘
                          ↓ ossutil 自动上传
┌─────────────────────────────────────────────────────────────┐
│             阿里云 OSS (xyht-backup) - 异地备份              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ staging/  → 30 天后自动删除 (生命周期规则)               ││
│  │ prod/     → 360 天后转归档存储 (生命周期规则)            ││
│  └─────────────────────────────────────────────────────────┘│
│  Bucket: xyht-backup                                        │
│  地域: 华东1（杭州）                                         │
│  存储类型: 低频访问 (IA)                                     │
│  冗余类型: 同城冗余存储                                      │
└─────────────────────────────────────────────────────────────┘
```

### 备份保留策略

| 环境 | 本地保留 | OSS 保留 | 备份内容 |
|------|---------|---------|---------|
| **dev** | 无 | 无 | - |
| **staging** | 7 天 | 30 天后删除 | PostgreSQL + Redis |
| **prod** | 30 天 | 360 天后转归档 | PostgreSQL + Redis |

### 备份脚本

脚本位置: `deploy/scripts/backup.sh`

```bash
# 备份 staging（本地保留 7 天）
/opt/xiaoyue/scripts/backup.sh staging

# 备份 prod（本地保留 30 天）
/opt/xiaoyue/scripts/backup.sh prod 30
```

备份流程：
1. 使用 `pg_dump` 导出 PostgreSQL，gzip 压缩
2. 触发 Redis `BGSAVE`，等待完成后复制 RDB 文件
3. 清理本地过期备份
4. 使用 `ossutil` 上传到阿里云 OSS

### 恢复脚本

脚本位置: `deploy/scripts/restore.sh`

```bash
# 恢复 PostgreSQL
/opt/xiaoyue/scripts/restore.sh staging pg_20260105_125729.sql.gz

# 恢复 Redis
/opt/xiaoyue/scripts/restore.sh staging redis_20260105_125729.rdb

# 跳过确认（用于自动化）
/opt/xiaoyue/scripts/restore.sh staging pg_xxx.sql.gz --force
```

### Crontab 配置

```bash
# 每日凌晨 3 点备份 staging
0 3 * * * /opt/xiaoyue/scripts/backup.sh staging >> /var/log/xiaoyue-backup.log 2>&1

# 每日凌晨 4 点备份 prod
0 4 * * * /opt/xiaoyue/scripts/backup.sh prod 30 >> /var/log/xiaoyue-backup.log 2>&1
```

### OSS 配置

**Bucket 信息**：
- 名称: `xyht-backup`
- Endpoint: `oss-cn-hangzhou.aliyuncs.com`
- 存储类型: 低频访问
- 读写权限: 私有

**ossutil 配置**（服务器 `~/.ossutilconfig`）：
```ini
[Credentials]
language=CH
endpoint=oss-cn-hangzhou.aliyuncs.com
accessKeyID=<RAM用户AccessKey>
accessKeySecret=<RAM用户Secret>
```

**RAM 权限策略**（仅授予备份 bucket 读写权限）：
```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "oss:PutObject",
        "oss:GetObject",
        "oss:DeleteObject",
        "oss:ListObjects",
        "oss:GetBucketInfo"
      ],
      "Resource": [
        "acs:oss:*:*:xyht-backup",
        "acs:oss:*:*:xyht-backup/*"
      ]
    }
  ]
}
```

### 从 OSS 恢复备份

```bash
# 列出 OSS 备份文件
ossutil ls oss://xyht-backup/prod/

# 下载备份文件
ossutil cp oss://xyht-backup/prod/pg_20260105_131912.sql.gz /opt/xiaoyue/backups/prod/

# 使用恢复脚本恢复
/opt/xiaoyue/scripts/restore.sh prod pg_20260105_131912.sql.gz
```

---

## 安全注意事项

### 密码安全

- **【强制】** 各环境使用不同密码
- **【强制】** 密码长度至少 16 字符
- **【强制】** `.env` 文件权限设置为 `600`
- **【推荐】** 定期轮换生产密码（90 天）

### 密码生成

```bash
# 生成 32 位随机密码
openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32
```

### 网络安全

- **【强制】** 数据库端口不暴露公网
- **【强制】** 仅通过 Docker 内部网络或 VPN 访问
- **【推荐】** 使用防火墙限制可访问 IP

### 备份安全

- **【强制】** 备份文件权限设置为 `600`
- **【推荐】** 备份文件加密存储
- **【推荐】** 定期测试备份恢复流程
- **【推荐】** 重要备份异地存储

---

## 故障排查

### PostgreSQL 连接失败

```bash
# 检查容器状态
docker ps | grep postgres
docker logs xy-dev-postgres

# 检查端口监听
lsof -i :5400

# 测试连接
docker exec xy-dev-postgres pg_isready -U xiaoyue
```

### Redis 连接失败

```bash
# 检查容器状态
docker ps | grep redis
docker logs xy-dev-redis

# 测试连接
docker exec xy-dev-redis redis-cli -a 密码 ping
```

### 磁盘空间不足

```bash
# 检查 Docker 磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a

# 检查 Volume 大小
docker volume ls
```

---

## 相关文档

- [Docker 基础设施部署方案](./docker-infrastructure.md) - 完整 Docker 配置
- [环境说明](./environments.md) - 各环境配置差异
- [密钥管理](./secrets-management.md) - 密钥生成和管理
