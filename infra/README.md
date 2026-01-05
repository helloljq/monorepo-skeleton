# 基础设施配置

本目录包含各环境的数据库部署配置。

## 目录结构

```
infra/
├── nas/                 # NAS 服务器配置 (dev + staging)
│   ├── docker-compose.yml
│   └── .env.example
└── aliyun/              # 阿里云服务器配置 (production)
    ├── docker-compose.yml
    └── .env.example
```

## 部署说明

### NAS (dev + staging)

```bash
# 1. 在 NAS 上创建目录
mkdir -p /docker/xiaoyue

# 2. 复制配置文件
scp infra/nas/docker-compose.yml nas:/docker/xiaoyue/
scp infra/nas/.env.example nas:/docker/xiaoyue/.env

# 3. SSH 到 NAS 编辑 .env，填入实际密码
ssh nas
cd /docker/xiaoyue
nano .env

# 4. 启动服务
docker compose up -d
```

### 阿里云 (production)

```bash
# 1. 在阿里云上创建目录
mkdir -p /docker/xiaoyue

# 2. 复制配置文件
scp infra/aliyun/docker-compose.yml aliyun:/docker/xiaoyue/
scp infra/aliyun/.env.example aliyun:/docker/xiaoyue/.env

# 3. SSH 到阿里云编辑 .env，填入实际密码
ssh aliyun
cd /docker/xiaoyue
nano .env

# 4. 启动服务
docker compose up -d
```

## 端口分配

| 服务 | dev | staging | production |
|------|-----|---------|------------|
| PostgreSQL | 5400 | 5410 | 5420 |
| Redis | 6300 | 6310 | 6320 |

## 连接测试

```bash
# 通过 Tailscale 测试 PostgreSQL
psql "postgresql://xy_dev:密码@nas:5400/xy_dev"

# 通过 Tailscale 测试 Redis
redis-cli -h nas -p 6300 -a 密码 ping
```

## 详细文档

参见 [数据库配置文档](../docs/deployment/database.md)
