---
description: Staging 环境快速部署清单 (数据库已就绪)
---

# Staging 环境快速部署清单

> ✅ **前提条件**: NAS 数据库已就绪 (xy-postgres-staging:5410, xy-redis-staging:6310)

## 📝 部署步骤概览

1. ✅ **数据库准备** - 已完成
2. ⏳ **配置环境变量** - 需要执行
3. ⏳ **构建 Docker 镜像** - 需要执行
4. ⏳ **推送镜像到仓库** - 需要执行
5. ⏳ **服务器部署** - 需要执行
6. ⏳ **执行数据库迁移** - 需要执行
7. ⏳ **配置域名和 SSL** - 需要执行

---

## 第一步:配置本地环境变量

### 1.1 获取必要的密码信息

你需要从管理员或密码管理系统获取:
- [ ] PostgreSQL staging 密码
- [ ] Redis staging 密码
- [ ] Docker Registry 登录凭证

### 1.2 创建 .env.staging 文件

在项目根目录执行:

```bash
cd /Users/ljq/repo/{{TITLE}}

# 生成 JWT 密钥
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# 创建环境变量文件
cat > .env.staging << EOF
# =============================================================================
# Staging 环境配置
# =============================================================================

# -----------------------------------------------------------------------------
# Docker Registry
# -----------------------------------------------------------------------------
DOCKER_REGISTRY=registry.cn-hangzhou.aliyuncs.com/{{NAME}}
IMAGE_TAG=staging-$(date +%Y%m%d-%H%M%S)

# -----------------------------------------------------------------------------
# 服务端口 (Staging)
# -----------------------------------------------------------------------------
SERVER_PORT=8110
ADMIN_WEB_PORT=3110
WWW_WEB_PORT=3210

# -----------------------------------------------------------------------------
# 数据库配置 (连接到 NAS)
# -----------------------------------------------------------------------------
# 请替换 <PG_STAGING_PASSWORD> 和 <REDIS_STAGING_PASSWORD>
DATABASE_URL=postgresql://xy_staging:<PG_STAGING_PASSWORD>@nas:5410/xy_staging
REDIS_URL=redis://:<REDIS_STAGING_PASSWORD>@nas:6310/0

# -----------------------------------------------------------------------------
# JWT 配置 (自动生成)
# -----------------------------------------------------------------------------
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# -----------------------------------------------------------------------------
# 应用配置
# -----------------------------------------------------------------------------
IDEMPOTENCY_TTL_SECONDS=86400
PRISMA_SLOW_QUERY_MS=500
LOG_LEVEL=info
EOF

echo "✅ .env.staging 已创建"
echo "⚠️  请手动编辑文件,填入数据库密码"
```

### 1.3 编辑并验证配置

```bash
# 编辑文件,填入实际密码
code .env.staging

# 验证配置
cat .env.staging | grep -E "(DATABASE_URL|REDIS_URL|JWT_)"
```

---

## 第二步:创建 Staging Docker Compose 配置

```bash
# 创建 staging 专用的 docker-compose 文件
cat > docker-compose.staging.yml << 'EOF'
# =============================================================================
# Docker Compose - Staging 环境部署
# =============================================================================

services:
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

  admin-web:
    image: ${DOCKER_REGISTRY}/admin-web:${IMAGE_TAG:-staging-latest}
    container_name: xiaoyue-admin-web-staging
    restart: unless-stopped
    ports:
      - "${ADMIN_WEB_PORT:-3110}:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
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

  www-web:
    image: ${DOCKER_REGISTRY}/www-web:${IMAGE_TAG:-staging-latest}
    container_name: xiaoyue-www-web-staging
    restart: unless-stopped
    ports:
      - "${WWW_WEB_PORT:-3210}:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
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

echo "✅ docker-compose.staging.yml 已创建"
```

---

## 第三步:构建 Docker 镜像

### 3.1 登录 Docker Registry

```bash
# 登录阿里云容器镜像服务
docker login registry.cn-hangzhou.aliyuncs.com
```

### 3.2 构建所有镜像

```bash
# 加载环境变量
export $(cat .env.staging | grep -v '^#' | xargs)

# 构建 Server API
echo "🔨 构建 Server API..."
docker build -f apps/server/Dockerfile \
  -t ${DOCKER_REGISTRY}/server:${IMAGE_TAG} \
  -t ${DOCKER_REGISTRY}/server:staging-latest \
  .

# 构建 Admin Web
echo "🔨 构建 Admin Web..."
docker build -f apps/admin-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api-staging.{{DOMAIN}} \
  -t ${DOCKER_REGISTRY}/admin-web:${IMAGE_TAG} \
  -t ${DOCKER_REGISTRY}/admin-web:staging-latest \
  .

# 构建 WWW Web
echo "🔨 构建 WWW Web..."
docker build -f apps/www-web/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://api-staging.{{DOMAIN}} \
  -t ${DOCKER_REGISTRY}/www-web:${IMAGE_TAG} \
  -t ${DOCKER_REGISTRY}/www-web:staging-latest \
  .

echo "✅ 所有镜像构建完成"
```

---

## 第四步:推送镜像到仓库

```bash
# 推送所有镜像
echo "📤 推送镜像..."

docker push ${DOCKER_REGISTRY}/server:${IMAGE_TAG}
docker push ${DOCKER_REGISTRY}/server:staging-latest

docker push ${DOCKER_REGISTRY}/admin-web:${IMAGE_TAG}
docker push ${DOCKER_REGISTRY}/admin-web:staging-latest

docker push ${DOCKER_REGISTRY}/www-web:${IMAGE_TAG}
docker push ${DOCKER_REGISTRY}/www-web:staging-latest

echo "✅ 所有镜像已推送"
```

---

## 第五步:服务器部署

### 5.1 准备服务器环境

```bash
# 连接到 staging 服务器 (根据实际情况替换)
# 如果 staging 就在 NAS 上,则:
ssh nas

# 创建部署目录
sudo mkdir -p /opt/xiaoyue-staging/{backup,logs}
sudo chown -R $USER:$USER /opt/xiaoyue-staging
```

### 5.2 上传配置文件

```bash
# 在本地执行,上传配置到服务器
scp .env.staging nas:/opt/xiaoyue-staging/.env
scp docker-compose.staging.yml nas:/opt/xiaoyue-staging/docker-compose.yml

# 设置安全权限
ssh nas "chmod 600 /opt/xiaoyue-staging/.env"
```

### 5.3 在服务器上部署

```bash
# SSH 到服务器
ssh nas

# 进入部署目录
cd /opt/xiaoyue-staging

# 加载环境变量
export $(cat .env | grep -v '^#' | xargs)

# 登录镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com

# 拉取镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

---

## 第六步:执行数据库迁移

```bash
# 在服务器上执行
ssh nas

# 执行 Prisma 迁移
docker exec xiaoyue-server-staging pnpm prisma migrate deploy

# 验证迁移状态
docker exec xiaoyue-server-staging pnpm prisma migrate status
```

---

## 第七步:验证部署

### 7.1 检查服务健康

```bash
# 在服务器上执行
ssh nas

# 检查容器状态
docker ps | grep staging

# 检查 API 健康
curl http://localhost:8110/health

# 查看日志
docker logs xiaoyue-server-staging --tail 50
```

### 7.2 测试功能

```bash
# 测试 API
curl http://localhost:8110/api

# 测试 Admin Web
curl http://localhost:3110

# 测试 WWW Web
curl http://localhost:3210
```

---

## 第八步:配置域名访问 (可选)

### 8.1 配置 Nginx 反向代理

如果需要通过域名访问,配置 Nginx:

```bash
# 在服务器上创建 Nginx 配置
sudo cat > /etc/nginx/sites-available/xiaoyue-staging << 'EOF'
server {
    listen 80;
    server_name api-staging.{{DOMAIN}};
    
    location / {
        proxy_pass http://localhost:8110;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name admin-staging.{{DOMAIN}};
    
    location / {
        proxy_pass http://localhost:3110;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name www-staging.{{DOMAIN}};
    
    location / {
        proxy_pass http://localhost:3210;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

# 启用配置
sudo ln -s /etc/nginx/sites-available/xiaoyue-staging /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8.2 配置 SSL (可选)

```bash
# 使用 Certbot 获取 SSL 证书
sudo certbot --nginx -d api-staging.{{DOMAIN}}
sudo certbot --nginx -d admin-staging.{{DOMAIN}}
sudo certbot --nginx -d www-staging.{{DOMAIN}}
```

---

## ✅ 部署完成检查清单

- [ ] .env.staging 已创建并填入正确密码
- [ ] docker-compose.staging.yml 已创建
- [ ] Docker 镜像已构建
- [ ] 镜像已推送到仓库
- [ ] 配置文件已上传到服务器
- [ ] 服务已启动
- [ ] 数据库迁移已执行
- [ ] 健康检查通过
- [ ] API 可以访问
- [ ] Admin Web 可以访问
- [ ] WWW Web 可以访问

---

## 🔧 常用运维命令

```bash
# 查看服务状态
ssh nas "cd /opt/xiaoyue-staging && docker-compose ps"

# 查看日志
ssh nas "docker logs -f xiaoyue-server-staging"

# 重启服务
ssh nas "cd /opt/xiaoyue-staging && docker-compose restart"

# 更新部署
ssh nas "cd /opt/xiaoyue-staging && docker-compose pull && docker-compose up -d"

# 停止服务
ssh nas "cd /opt/xiaoyue-staging && docker-compose down"
```

---

## 📚 参考文档

- [完整部署指南](./staging-deployment.md)
- [环境说明](../../docs/deployment/environments.md)
- [数据库管理](../../docs/deployment/database.md)
