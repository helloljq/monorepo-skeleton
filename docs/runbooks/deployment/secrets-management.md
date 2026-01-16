# 密钥与环境变量管理规范

本文档定义了{{TITLE}}项目所有密钥和环境变量的管理规范。

---

## 密钥存放位置

| 密钥类型   | 存放位置                   | 说明                    |
| ---------- | -------------------------- | ----------------------- |
| CI/CD 相关 | GitHub Secrets             | 镜像仓库、服务器 SSH 等 |
| 应用运行时 | 服务器 `.env.prod` 文件    | 数据库、Redis、JWT 等   |
| 小程序相关 | 微信公众平台 + `.env.prod` | AppID、AppSecret        |
| 本地开发   | `.env` 文件                | 本地测试配置            |

---

## 一、GitHub Secrets 配置清单

在仓库的 `Settings → Secrets and variables → Actions` 中配置：

### 1.1 Docker 镜像仓库（必需）

| Secret 名称       | 说明               | 示例值                                       |
| ----------------- | ------------------ | -------------------------------------------- |
| `DOCKER_REGISTRY` | 镜像仓库地址       | `registry.cn-hangzhou.aliyuncs.com/{{NAME}}` |
| `DOCKER_USERNAME` | 仓库用户名         | `your-username`                              |
| `DOCKER_PASSWORD` | 仓库密码或访问令牌 | `your-password`                              |

**支持的镜像仓库：**

- 阿里云 ACR: `registry.cn-hangzhou.aliyuncs.com/命名空间`
- Docker Hub: `docker.io/用户名`
- 腾讯云 TCR: `ccr.ccs.tencentyun.com/命名空间`

### 1.2 Dev 环境服务器（必需）

| Secret 名称          | 说明             | 示例值                                   |
| -------------------- | ---------------- | ---------------------------------------- |
| `DEV_SERVER_HOST`    | 服务器 IP 或域名 | `192.168.1.100`                          |
| `DEV_SERVER_USER`    | SSH 登录用户名   | `deploy`                                 |
| `DEV_SERVER_SSH_KEY` | SSH 私钥（全文） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### 1.3 Staging 环境服务器（可选）

| Secret 名称              | 说明               |
| ------------------------ | ------------------ |
| `STAGING_SERVER_HOST`    | Staging 服务器地址 |
| `STAGING_SERVER_USER`    | SSH 用户名         |
| `STAGING_SERVER_SSH_KEY` | SSH 私钥           |

### 1.4 Production 环境服务器（必需）

| Secret 名称           | 说明           |
| --------------------- | -------------- |
| `PROD_SERVER_HOST`    | 生产服务器地址 |
| `PROD_SERVER_USER`    | SSH 用户名     |
| `PROD_SERVER_SSH_KEY` | SSH 私钥       |

---

## 二、服务器环境变量配置

在服务器 `/opt/{{NAME}}/.env.prod` 文件中配置：

### 2.1 必需配置

```bash
# Docker 镜像
DOCKER_REGISTRY=registry.cn-hangzhou.aliyuncs.com/{{NAME}}
IMAGE_TAG=latest

# 数据库（PostgreSQL）
DATABASE_URL=postgresql://用户名:密码@主机:5432/数据库名

# 缓存（Redis）
REDIS_URL=redis://:密码@主机:6379

# JWT 密钥（使用强随机字符串）
JWT_ACCESS_SECRET=生成的随机字符串
JWT_REFRESH_SECRET=生成的随机字符串
```

### 2.2 可选配置

```bash
# Token 有效期
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# 幂等性 TTL
IDEMPOTENCY_TTL_SECONDS=86400

# 慢查询阈值
PRISMA_SLOW_QUERY_MS=500
```

### 2.3 密钥生成方法

```bash
# 生成 JWT 密钥（64 字节 Base64）
openssl rand -base64 64 | tr -d '\n'

# 生成数据库密码（32 字符）
openssl rand -base64 32 | tr -d '/+=' | head -c 32

# 生成 SSH 密钥对
ssh-keygen -t ed25519 -C "deploy@{{DOMAIN}}" -f ~/.ssh/xiaoyue_deploy
```

---

## 三、微信小程序配置

### 3.1 配置来源

从 [微信公众平台](https://mp.weixin.qq.com/) 获取：

| 配置项    | 获取路径                   | 用途             |
| --------- | -------------------------- | ---------------- |
| AppID     | 开发管理 → 开发设置        | 小程序唯一标识   |
| AppSecret | 开发管理 → 开发设置 → 重置 | 后端登录凭证校验 |

### 3.2 配置存放

**项目配置文件**（需手动更新）：

```
apps/miniprogram/project.config.json
```

```json
{
  "appid": "wx1234567890abcdef" // 替换为真实 AppID
}
```

**服务器环境变量**（添加到 `.env.prod`）：

```bash
# 微信小程序
WECHAT_MINIPROGRAM_APPID=wx1234567890abcdef
WECHAT_MINIPROGRAM_SECRET=你的AppSecret
```

### 3.3 CI 自动上传（可选）

如需 CI 自动上传小程序，需在 GitHub Secrets 添加：

| Secret 名称              | 说明         | 获取方式         |
| ------------------------ | ------------ | ---------------- |
| `MINIPROGRAM_APPID`      | 小程序 AppID | 微信公众平台     |
| `MINIPROGRAM_UPLOAD_KEY` | 上传私钥     | 微信公众平台下载 |

---

## 四、本地开发配置

### 4.1 环境文件命名规范

各应用独立管理环境变量，命名规范如下：

| 应用      | 本地开发           | staging        | production        |
| --------- | ------------------ | -------------- | ----------------- |
| server    | `.env`             | `.env.staging` | `.env.production` |
| admin-web | `.env.development` | `.env.staging` | `.env.production` |
| www-web   | `.env.development` | `.env.staging` | `.env.production` |

> **注意**: Server 使用 `.env` 是因为 Prisma CLI 默认只读取此文件，不支持 `.env.development`

### 4.2 方式 A：连接 NAS 数据库（推荐）

> 需要已配置 Tailscale 并能访问 NAS

```bash
# Server 配置
cd apps/server
cp .env.example .env
# 编辑 .env，填入实际密码

# 前端配置
cd ../admin-web && cp .env.example .env.development
cd ../www-web && cp .env.example .env.development
```

Server 配置示例 (`apps/server/.env`)：

```bash
DATABASE_URL=postgresql://xy_dev:XyDev_xxx@nas:5400/xy_dev
REDIS_URL=redis://:XyRedisDev_xxx@nas:6300/0
JWT_ACCESS_SECRET=dev-access-secret-not-for-production
JWT_REFRESH_SECRET=dev-refresh-secret-not-for-production
```

### 4.3 方式 B：本地 Docker 数据库（备选）

> 适用于：无法访问 NAS、Tailscale 未配置、需要独立环境

```bash
# 1. 启动本地数据库
docker-compose up -d

# 2. Server 配置
cd apps/server
cp .env.example .env
# 编辑 .env，改为本地数据库配置

# 3. 前端配置
cd ../admin-web && cp .env.example .env.development
cd ../www-web && cp .env.example .env.development
```

Server 配置示例 (`apps/server/.env`)：

```bash
DATABASE_URL=postgresql://xiaoyue:xiaoyue123@localhost:5432/xiaoyue_health
REDIS_URL=redis://localhost:6379/0
JWT_ACCESS_SECRET=dev-access-secret-not-for-production
JWT_REFRESH_SECRET=dev-refresh-secret-not-for-production
```

---

## 五、安全规范

### 5.1 密钥管理原则

- **【强制】** 密钥禁止硬编码在代码中
- **【强制】** 密钥禁止提交到 Git 仓库
- **【强制】** 不同环境使用不同密钥
- **【强制】** 服务器 `.env` 文件权限设置为 `600`
- **【推荐】** 定期轮换生产密钥（建议每 90 天）

### 5.2 .gitignore 确认

确保以下文件已添加到 `.gitignore`：

```
.env
.env.prod
.env.local
.env.*.local
```

### 5.3 密钥泄露应急处理

如发现密钥泄露：

1. **立即轮换**受影响的密钥
2. **审查日志**检查是否有异常访问
3. **通知团队**记录事件
4. **更新部署**使用新密钥重新部署

---

## 六、环境变量完整清单

### 服务器必需

| 变量名               | 说明               | 必需 |
| -------------------- | ------------------ | ---- |
| `DOCKER_REGISTRY`    | 镜像仓库地址       | ✅   |
| `IMAGE_TAG`          | 镜像版本标签       | ✅   |
| `DATABASE_URL`       | PostgreSQL 连接串  | ✅   |
| `REDIS_URL`          | Redis 连接串       | ✅   |
| `JWT_ACCESS_SECRET`  | Access Token 密钥  | ✅   |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥 | ✅   |

### 服务器可选

| 变量名                    | 说明                 | 默认值  |
| ------------------------- | -------------------- | ------- |
| `JWT_ACCESS_TTL`          | Access Token 有效期  | `15m`   |
| `JWT_REFRESH_TTL`         | Refresh Token 有效期 | `7d`    |
| `IDEMPOTENCY_TTL_SECONDS` | 幂等性 TTL           | `86400` |
| `PRISMA_SLOW_QUERY_MS`    | 慢查询阈值           | `500`   |

### 小程序相关

| 变量名                      | 说明             | 必需 |
| --------------------------- | ---------------- | ---- |
| `WECHAT_MINIPROGRAM_APPID`  | 小程序 AppID     | ✅   |
| `WECHAT_MINIPROGRAM_SECRET` | 小程序 AppSecret | ✅   |

---

## 七、需向前团队获取的信息

| 项目              | 说明                     | 状态      |
| ----------------- | ------------------------ | --------- |
| 生产数据库连接串  | `DATABASE_URL`           | ⏳ 待获取 |
| 生产 Redis 连接串 | `REDIS_URL`              | ⏳ 待获取 |
| 生产 JWT 密钥     | 如已有用户，需复用旧密钥 | ⏳ 待确认 |
| 小程序 AppID      | 真实的微信小程序标识     | ⏳ 待获取 |
| 小程序 AppSecret  | 用于后端登录校验         | ⏳ 待获取 |
| 服务器 SSH 访问   | IP、用户名、SSH 密钥     | ⏳ 待获取 |
| 镜像仓库账号      | 阿里云/腾讯云 ACR 账号   | ⏳ 待获取 |
