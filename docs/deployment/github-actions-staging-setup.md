# Staging 环境 GitHub Actions 部署配置清单

## 📋 配置概览

当你推送代码到 `release/*` 分支时,GitHub Actions 会自动:
1. 构建 Docker 镜像 (server, admin-web, www-web)
2. 推送镜像到 Docker Registry
3. SSH 到 staging 服务器
4. 拉取最新镜像并重启服务
5. 执行数据库迁移
6. 进行健康检查

---

## 🔐 第一步: 配置 GitHub Secrets

### 1.1 进入 GitHub 仓库设置

1. 打开仓库: https://github.com/<你的用户名>/{{TITLE}}
2. 点击 **Settings** (设置)
3. 左侧菜单选择 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**

### 1.2 添加以下 Secrets

#### Docker Registry 相关 (必需)

```
名称: DOCKER_REGISTRY
值: registry.cn-hangzhou.aliyuncs.com/{{NAME}}
```

```
名称: DOCKER_USERNAME
值: <你的阿里云账号用户名>
```

```
名称: DOCKER_PASSWORD
值: <你的阿里云密码或 Access Token>
```

#### Staging 服务器 SSH 相关 (必需)

```
名称: STAGING_SERVER_HOST
值: <NAS 的 IP 地址或域名>
说明: 例如 192.168.1.100 或 nas.yourdomain.com
```

```
名称: STAGING_SERVER_USER
值: <SSH 登录用户名>
说明: 例如 ubuntu 或 admin
```

```
名称: STAGING_SERVER_SSH_KEY
值: <SSH 私钥完整内容>
说明: 包含 -----BEGIN OPENSSH PRIVATE KEY----- 和 -----END OPENSSH PRIVATE KEY-----
```

#### Staging 环境变量 (必需) - **这里填入你的数据库密码**

```
名称: STAGING_DATABASE_URL
值: postgresql://xy_staging:<你的PostgreSQL密码>@nas:5410/xy_staging
说明: PostgreSQL 连接串,替换 <你的PostgreSQL密码> 为实际密码
```

```
名称: STAGING_REDIS_URL
值: redis://:<你的Redis密码>@nas:6310/0
说明: Redis 连接串,注意冒号后面是密码
```

```
名称: STAGING_JWT_ACCESS_SECRET
值: <生成32位随机字符串>
说明: 使用 openssl rand -base64 32 生成,或使用在线工具
```

```
名称: STAGING_JWT_REFRESH_SECRET
值: <生成32位随机字符串>
说明: 使用 openssl rand -base64 32 生成,必须与 ACCESS_SECRET 不同
```

### 1.3 如何获取 SSH 私钥

如果你已经有 SSH 密钥:
```bash
# 查看现有私钥
cat ~/.ssh/id_rsa
# 或
cat ~/.ssh/id_ed25519
```

如果需要生成新的密钥对 (推荐为 GitHub Actions 单独生成):
```bash
# 生成专用密钥
ssh-keygen -t ed25519 -C "github-actions-staging" -f ~/.ssh/github_actions_staging

# 将公钥添加到服务器
ssh-copy-id -i ~/.ssh/github_actions_staging.pub <user>@<staging-server>

# 查看私钥内容 (复制到 GitHub Secret)
cat ~/.ssh/github_actions_staging
```

---

## 🌍 第二步: 配置 GitHub Environments (可选但推荐)

### 2.1 创建 Staging Environment

1. 在仓库中进入 **Settings** → **Environments**
2. 点击 **New environment**
3. 名称输入: `staging`
4. 点击 **Configure environment**

### 2.2 配置环境保护规则 (可选)

- **Required reviewers**: 添加需要审批的人员
- **Wait timer**: 设置等待时间 (如 5 分钟)
- **Deployment branches**: 限制只有 `release/*` 分支可以部署

---

## 🖥️ 第三步: 准备 Staging 服务器

### 3.1 在服务器上创建部署目录

```bash
# SSH 到 staging 服务器 (如果 staging 在 NAS 上)
ssh <user>@<staging-server>

# 创建部署目录
sudo mkdir -p /opt/{{NAME}}/{backup,logs}
sudo chown -R $USER:$USER /opt/{{NAME}}
```

或使用提供的脚本:
```bash
# 上传脚本
scp scripts/setup-staging-server.sh <user>@<staging-server>:~/

# 执行脚本
ssh <user>@<staging-server> "bash setup-staging-server.sh"
```

### 3.2 上传 docker-compose 配置

```bash
# 上传 docker-compose.prod.yml
scp docker-compose.prod.yml <user>@<staging-server>:/opt/{{NAME}}/
```

**重要说明**: 
- ✅ **不需要**在服务器上创建 `.env` 文件
- ✅ 环境变量(数据库密码、JWT密钥等)通过 GitHub Secrets 传递
- ✅ GitHub Actions 会在部署时自动设置这些环境变量

### 3.3 在服务器上登录 Docker Registry

```bash
# SSH 到服务器
ssh <user>@<staging-server>

# 登录 Docker Registry
docker login registry.cn-hangzhou.aliyuncs.com
# 输入用户名和密码
```

---

## 🚀 第四步: 触发部署

### 4.1 创建 release 分支

```bash
# 从 develop 分支创建 release 分支
git checkout develop
git pull origin develop

# 创建 release 分支 (版本号根据实际情况)
git checkout -b release/v1.0.0

# 推送到远程 (这会触发 GitHub Actions)
git push origin release/v1.0.0
```

### 4.2 观察部署过程

1. 打开 GitHub 仓库
2. 点击 **Actions** 标签
3. 查看 **CD** workflow 的运行状态
4. 点击具体的 workflow run 查看详细日志

### 4.3 部署流程

GitHub Actions 会自动执行:
1. ✅ **Prepare** - 确定部署环境为 staging
2. ✅ **Build Images** - 构建 3 个 Docker 镜像
   - server
   - admin-web
   - www-web
3. ✅ **Deploy to Staging** - SSH 到服务器部署
   - 拉取最新镜像
   - 重启服务
   - 执行数据库迁移
4. ✅ **Health Check** - 验证服务健康状态

---

## ✅ 第五步: 验证部署

### 5.1 检查 GitHub Actions 状态

确保所有步骤都显示绿色 ✅

### 5.2 在服务器上验证

```bash
# SSH 到服务器
ssh <user>@<staging-server>

# 查看容器状态
cd /opt/{{NAME}}
docker-compose -f docker-compose.prod.yml ps

# 查看服务日志
docker logs xiaoyue-server --tail 50

# 测试健康检查
curl http://localhost:8110/health
```

### 5.3 通过域名访问 (如果已配置)

- API: https://api-staging.{{DOMAIN}}/health
- Admin: https://admin-staging.{{DOMAIN}}
- H5: https://www-staging.{{DOMAIN}}

---

## 📝 完整配置检查清单

### GitHub Secrets 配置
- [ ] `DOCKER_REGISTRY` 已配置
- [ ] `DOCKER_USERNAME` 已配置
- [ ] `DOCKER_PASSWORD` 已配置
- [ ] `STAGING_SERVER_HOST` 已配置
- [ ] `STAGING_SERVER_USER` 已配置
- [ ] `STAGING_SERVER_SSH_KEY` 已配置
- [ ] `STAGING_DATABASE_URL` 已配置 (包含数据库密码)
- [ ] `STAGING_REDIS_URL` 已配置 (包含 Redis 密码)
- [ ] `STAGING_JWT_ACCESS_SECRET` 已配置
- [ ] `STAGING_JWT_REFRESH_SECRET` 已配置

### GitHub Environments
- [ ] `staging` environment 已创建
- [ ] (可选) 配置了审批规则

### 服务器准备
- [ ] `/opt/{{NAME}}` 目录已创建
- [ ] `docker-compose.prod.yml` 已上传
- [ ] Docker 已安装
- [ ] Docker Compose 已安装
- [ ] 已登录 Docker Registry
- [ ] SSH 密钥已添加到 authorized_keys

### 数据库
- [ ] PostgreSQL staging 已运行 (端口 5410)
- [ ] Redis staging 已运行 (端口 6310)
- [ ] 数据库密码已填入 GitHub Secrets

### 部署测试
- [ ] release 分支已创建并推送
- [ ] GitHub Actions workflow 运行成功
- [ ] 容器已启动
- [ ] 健康检查通过
- [ ] 可以访问 API

---

## 🔧 常见问题排查

### 问题 1: GitHub Actions 构建失败

**检查**:
- Docker Registry secrets 是否正确
- 网络是否可以访问镜像仓库

### 问题 2: SSH 连接失败

**检查**:
- `STAGING_SERVER_HOST` 是否正确
- `STAGING_SERVER_SSH_KEY` 是否完整 (包含 BEGIN/END)
- 服务器防火墙是否允许 GitHub Actions IP
- SSH 公钥是否已添加到服务器

### 问题 3: 部署后容器启动失败

**检查**:
```bash
# 查看容器日志
docker logs xiaoyue-server

# 检查环境变量
docker exec xiaoyue-server env | grep DATABASE_URL

# 测试数据库连接
docker exec xiaoyue-server sh -c "nc -zv nas 5410"
```

### 问题 4: 数据库迁移失败

**检查**:
- DATABASE_URL 是否正确
- 数据库是否可访问
- Prisma schema 是否有语法错误

---

## 📚 相关文档

- [CI/CD 流程](../../docs/deployment/ci-cd.md)
- [环境说明](../../docs/deployment/environments.md)
- [完整部署指南](../../docs/deployment/DEPLOYMENT_GUIDE.md)
- [数据库管理](../../docs/deployment/database.md)

---

## 🎯 快速参考

### 触发 staging 部署
```bash
git checkout -b release/v1.0.0
git push origin release/v1.0.0
```

### 查看部署日志
```bash
ssh <user>@<staging-server>
docker logs -f xiaoyue-server
```

### 重启服务
```bash
ssh <user>@<staging-server>
cd /opt/{{NAME}}
docker-compose -f docker-compose.prod.yml restart
```

### 回滚部署
```bash
# 在 GitHub Actions 中找到上一个成功的部署
# 或手动指定镜像版本
ssh <user>@<staging-server>
cd /opt/{{NAME}}
export IMAGE_TAG=<previous-tag>
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```
