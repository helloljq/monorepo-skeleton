---
description: Staging 环境部署完整指南
---

# Staging 环境部署操作指南

本指南将引导你完成 staging 环境的完整部署流程。

## 📋 部署前检查清单

在开始部署前,请确认以下条件:

- [ ] 有 NAS 服务器的访问权限
- [ ] 已配置 Tailscale VPN 连接
- [ ] 有 Docker Registry 的访问权限
- [ ] 已获取 staging 环境的数据库密码

---

## 第一步:准备 NAS 数据库环境 ✅

### 1.1 检查 NAS 数据库状态

```bash
# 通过 SSH 连接到 NAS
ssh nas

# 检查 staging 数据库容器是否运行
docker ps | grep staging
```

**当前状态**: ✅ **数据库已就绪**

```
xy-postgres-staging  - 端口 5410 - 状态: healthy
xy-redis-staging     - 端口 6310 - 状态: running
```

### 1.2 验证数据库连接 (可选,如果数据库已运行可跳过部署步骤)

```bash
# 在 NAS 上创建部署目录
ssh nas "mkdir -p /docker/xiaoyue"

# 上传 docker-compose 配置
scp infra/nas/docker-compose.yml nas:/docker/xiaoyue/

# 创建 .env 文件(需要填入实际密码)
ssh nas "cat > /docker/xiaoyue/.env << 'EOF'
# Dev 环境密码
PG_DEV_PASSWORD=<从管理员获取>
REDIS_DEV_PASSWORD=<从管理员获取>

# Staging 环境密码
PG_STAGING_PASSWORD=<从管理员获取>
REDIS_STAGING_PASSWORD=<从管理员获取>
EOF"

# 启动数据库服务
ssh nas "cd /docker/xiaoyue && docker compose up -d postgres-staging redis-staging"

# 验证服务状态
ssh nas "docker ps | grep staging"
```

### 1.3 测试数据库连接

```bash
# 测试 PostgreSQL 连接
ssh nas "docker exec xy-postgres-staging pg_isready -U xy_staging -d xy_staging"

# 测试 Redis 连接
ssh nas "docker exec xy-redis-staging redis-cli -a <密码> ping"
```

---

## 第二步:准备应用服务器环境

### 2.1 创建部署目录

```bash
# 连接到应用服务器(根据实际情况替换)
ssh staging-server

# 创建部署目录
sudo mkdir -p /opt/{{NAME}}/{backup,logs}
sudo chown -R $USER:$USER /opt/{{NAME}}
```

### 2.2 配置防火墙

```bash
# 允许必要端口
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw allow 8110   # API (staging)
sudo ufw allow 3110   # Admin Web (staging)
sudo ufw allow 3210   # H5 Web (staging)
sudo ufw enable
```

---

## 第三步:配置环境变量

### 3.1 创建 staging 环境变量文件

在本地项目根目录创建 `.env.staging`:

```bash
# 在本地执行
cat > .env.staging << 'EOF'
# =============================================================================
# Staging 环境配置
# =============================================================================

# -----------------------------------------------------------------------------
# Docker Registry
# -----------------------------------------------------------------------------
DOCKER_REGISTRY=registry.cn-hangzhou.aliyuncs.com/{{NAME}}
IMAGE_TAG=staging-latest

# -----------------------------------------------------------------------------
# 服务端口 (Staging)
# -----------------------------------------------------------------------------
SERVER_PORT=8110
ADMIN_WEB_PORT=3110
WWW_WEB_PORT=3210

# -----------------------------------------------------------------------------
# 数据库配置 (连接到 NAS)
# -----------------------------------------------------------------------------
# PostgreSQL - staging 环境
DATABASE_URL=postgresql://xy_staging:<密码>@nas:5410/xy_staging

# Redis - staging 环境
REDIS_URL=redis://:<密码>@nas:6310/0

# -----------------------------------------------------------------------------
# JWT 配置 (Staging 专用密钥)
# -----------------------------------------------------------------------------
JWT_ACCESS_SECRET=<生成32位随机字符串>
JWT_REFRESH_SECRET=<生成32位随机字符串>
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# -----------------------------------------------------------------------------
# 应用配置
# -----------------------------------------------------------------------------
IDEMPOTENCY_TTL_SECONDS=86400
PRISMA_SLOW_QUERY_MS=500

# -----------------------------------------------------------------------------
# 日志级别
# -----------------------------------------------------------------------------
LOG_LEVEL=info
EOF
```

### 3.2 生成安全密钥

```bash
# 生成 JWT Access Secret
openssl rand -base64 32

# 生成 JWT Refresh Secret
openssl rand -base64 32
```

将生成的密钥填入 `.env.staging` 文件。

### 3.3 上传环境变量到服务器

```bash
# 上传到服务器
scp .env.staging staging-server:/opt/{{NAME}}/.env.staging

# 设置安全权限
ssh staging-server "chmod 600 /opt/{{NAME}}/.env.staging"
```

---

## 第四步:准备 Docker Compose 配置

### 4.1 创建 staging 专用的 docker-compose 文件

在本地创建 `docker-compose.staging.yml`:

```bash
cat > docker-compose.staging.yml << 'EOF'
# =============================================================================
# Docker Compose - Staging 环境部署
# =============================================================================

services:
  # ---------------------------------------------------------------------------
  # Server API 服务
  # ---------------------------------------------------------------------------
  server:
    image: ${DOCKER_REGISTRY}/server:${IMAGE_TAG:-staging-latest}
    container_name: xiaoyue-server-staging
    restart: unless-stopped
    ports:
      - "${SERVER_PORT:-8110}:8100"
    environment:
      - NODE_ENV=staging
      - PORT=8100
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - JWT_ACCESS_TTL=${JWT_ACCESS_TTL:-15m}
      - JWT_REFRESH_TTL=${JWT_REFRESH_TTL:-7d}
      - IDEMPOTENCY_TTL_SECONDS=${IDEMPOTENCY_TTL_SECONDS:-86400}
      - PRISMA_SLOW_QUERY_MS=${PRISMA_SLOW_QUERY_MS:-500}
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8100/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      start_period: 40s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"
    networks:
      - xiaoyue-network

  # ---------------------------------------------------------------------------
  # Admin Web 管理后台
  # ---------------------------------------------------------------------------
  admin-web:
    image: ${DOCKER_REGISTRY}/admin-web:${IMAGE_TAG:-staging-latest}
    container_name: xiaoyue-admin-web-staging
    restart: unless-stopped
    ports:
      - "${ADMIN_WEB_PORT:-3110}:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      start_period: 5s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"
    networks:
      - xiaoyue-network

  # ---------------------------------------------------------------------------
  # WWW Web 移动端
  # ---------------------------------------------------------------------------
  www-web:
    image: ${DOCKER_REGISTRY}/www-web:${IMAGE_TAG:-staging-latest}
    container_name: xiaoyue-www-web-staging
    restart: unless-stopped
    ports:
      - "${WWW_WEB_PORT:-3210}:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      start_period: 5s
      retries: 3
    logging:
      driver: "json-file"
      options:
        max-size: "50m"
        max-file: "3"
    networks:
      - xiaoyue-network

networks:
  xiaoyue-network:
    driver: bridge
EOF
```

### 4.2 上传 docker-compose 配置

```bash
scp docker-compose.staging.yml staging-server:/opt/{{NAME}}/
```

---

## 第五步:构建和推送 Docker 镜像

### 5.1 登录 Docker Registry

```bash
# 登录阿里云容器镜像服务
docker login registry.cn-hangzhou.aliyuncs.com
```

### 5.2 构建镜像

```bash
# 构建 Server API
docker build -f apps/server/Dockerfile \
  -t registry.cn-hangzhou.aliyuncs.com/{{NAME}}/server:staging-latest \
  .

# 构建 Admin Web
docker build -f apps/admin-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api-staging.{{DOMAIN}} \
  -t registry.cn-hangzhou.aliyuncs.com/{{NAME}}/admin-web:staging-latest \
  .

# 构建 WWW Web
docker build -f apps/www-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api-staging.{{DOMAIN}} \
  -t registry.cn-hangzhou.aliyuncs.com/{{NAME}}/www-web:staging-latest \
  .
```

### 5.3 推送镜像

```bash
# 推送 Server
docker push registry.cn-hangzhou.aliyuncs.com/{{NAME}}/server:staging-latest

# 推送 Admin Web
docker push registry.cn-hangzhou.aliyuncs.com/{{NAME}}/admin-web:staging-latest

# 推送 WWW Web
docker push registry.cn-hangzhou.aliyuncs.com/{{NAME}}/www-web:staging-latest
```

---

## 第六步:部署应用

### 6.1 在服务器上拉取镜像

```bash
# SSH 到服务器
ssh staging-server

# 进入部署目录
cd /opt/{{NAME}}

# 加载环境变量
export $(cat .env.staging | grep -v '^#' | xargs)

# 登录镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com

# 拉取镜像
docker-compose -f docker-compose.staging.yml pull
```

### 6.2 启动服务

```bash
# 启动所有服务
docker-compose -f docker-compose.staging.yml up -d

# 查看服务状态
docker-compose -f docker-compose.staging.yml ps
```

### 6.3 执行数据库迁移

```bash
# 执行 Prisma 迁移
docker exec xiaoyue-server-staging pnpm prisma migrate deploy

# 生成 Prisma Client (如果需要)
docker exec xiaoyue-server-staging pnpm prisma:generate
```

---

## 第七步:验证部署

### 7.1 检查服务健康状态

```bash
# 检查 API 健康
curl http://localhost:8110/health

# 预期输出: {"status":"ok"}
```

### 7.2 查看服务日志

```bash
# Server 日志
docker logs xiaoyue-server-staging --tail 50

# Admin Web 日志
docker logs xiaoyue-admin-web-staging --tail 50

# WWW Web 日志
docker logs xiaoyue-www-web-staging --tail 50
```

### 7.3 测试 API 接口

```bash
# 访问 Swagger 文档
curl http://localhost:8110/api

# 测试健康检查
curl http://localhost:8110/health

# 测试指标端点
curl http://localhost:8110/metrics
```

---

## 第八步:配置域名和反向代理

### 8.1 配置 DNS

确保以下域名解析到服务器 IP:

- `api-staging.{{DOMAIN}}` → 服务器 IP
- `admin-staging.{{DOMAIN}}` → 服务器 IP
- `www-staging.{{DOMAIN}}` → 服务器 IP

### 8.2 配置 Nginx 反向代理

```bash
# 创建 Nginx 配置
sudo cat > /etc/nginx/sites-available/xiaoyue-staging << 'EOF'
# API Server
server {
    listen 80;
    server_name api-staging.{{DOMAIN}};

    location / {
        proxy_pass http://localhost:8110;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Admin Web
server {
    listen 80;
    server_name admin-staging.{{DOMAIN}};

    location / {
        proxy_pass http://localhost:3110;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# WWW Web
server {
    listen 80;
    server_name www-staging.{{DOMAIN}};

    location / {
        proxy_pass http://localhost:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/xiaoyue-staging /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 8.3 配置 SSL 证书 (使用 Let's Encrypt)

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d api-staging.{{DOMAIN}}
sudo certbot --nginx -d admin-staging.{{DOMAIN}}
sudo certbot --nginx -d www-staging.{{DOMAIN}}

# 测试自动续期
sudo certbot renew --dry-run
```

---

## 第九步:最终验证

### 9.1 通过域名访问

```bash
# 测试 API
curl https://api-staging.{{DOMAIN}}/health

# 在浏览器中访问
# - https://admin-staging.{{DOMAIN}} (管理后台)
# - https://www-staging.{{DOMAIN}} (H5 页面)
# - https://api-staging.{{DOMAIN}}/api (Swagger 文档)
```

### 9.2 功能测试

- [ ] 管理后台可以正常登录
- [ ] API 接口响应正常
- [ ] H5 页面可以访问
- [ ] 数据库连接正常
- [ ] Redis 缓存工作正常

---

## 常用运维命令

### 查看服务状态

```bash
cd /opt/{{NAME}}
docker-compose -f docker-compose.staging.yml ps
```

### 重启服务

```bash
# 重启所有服务
docker-compose -f docker-compose.staging.yml restart

# 重启单个服务
docker-compose -f docker-compose.staging.yml restart server
```

### 查看日志

```bash
# 实时日志
docker logs -f xiaoyue-server-staging

# 最近日志
docker logs xiaoyue-server-staging --tail 100
```

### 更新部署

```bash
# 拉取最新镜像
docker-compose -f docker-compose.staging.yml pull

# 重启服务
docker-compose -f docker-compose.staging.yml up -d

# 执行数据库迁移
docker exec xiaoyue-server-staging pnpm prisma migrate deploy
```

### 停止服务

```bash
docker-compose -f docker-compose.staging.yml down
```

---

## 故障排查

### 问题 1: 容器无法启动

```bash
# 查看容器日志
docker logs xiaoyue-server-staging

# 检查环境变量
docker exec xiaoyue-server-staging env | grep DATABASE_URL
```

### 问题 2: 数据库连接失败

```bash
# 测试从容器内连接数据库
docker exec xiaoyue-server-staging sh -c "nc -zv nas 5410"

# 检查 Tailscale 连接
ping nas
```

### 问题 3: 镜像拉取失败

```bash
# 重新登录
docker login registry.cn-hangzhou.aliyuncs.com

# 手动拉取
docker pull registry.cn-hangzhou.aliyuncs.com/{{NAME}}/server:staging-latest
```

---

## 部署完成检查清单

- [ ] NAS 数据库服务运行正常
- [ ] 应用服务器环境已准备
- [ ] 环境变量配置正确
- [ ] Docker 镜像已构建并推送
- [ ] 应用服务已启动
- [ ] 数据库迁移已执行
- [ ] 健康检查通过
- [ ] 域名解析正确
- [ ] Nginx 反向代理配置完成
- [ ] SSL 证书已配置
- [ ] 功能测试通过

---

## 参考文档

- [环境说明](../../docs/deployment/environments.md)
- [完整部署指南](../../docs/deployment/DEPLOYMENT_GUIDE.md)
- [数据库管理](../../docs/deployment/database.md)
- [CI/CD 配置](../../docs/deployment/ci-cd.md)
