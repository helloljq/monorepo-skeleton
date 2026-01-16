# Server 部署指南

本文档是 Server 应用的部署补充说明。完整的部署指南请参考项目级文档。

## 相关文档

| 文档                                                          | 说明                            |
| ------------------------------------------------------------- | ------------------------------- |
| [快速参考指南](/docs/runbooks/deployment/quickstart.md)       | 本地开发、Staging/Prod 部署速查 |
| [完整部署手册](/docs/runbooks/deployment/deployment-guide.md) | 从零开始的详细部署步骤          |
| [CI/CD 流程](/docs/runbooks/deployment/ci-cd.md)              | 自动化部署流程                  |
| [环境说明](/docs/runbooks/deployment/environments.md)         | 各环境配置差异                  |

---

## Server 特定配置

### 端口映射

| 环境       | 容器内端口 | 外部端口 |
| ---------- | ---------- | -------- |
| dev        | 8100       | 8100     |
| staging    | 8100       | 8110     |
| production | 8100       | 8120     |

### 容器资源限制

```yaml
resources:
  limits:
    memory: 1g
    cpus: "1.0"
```

### 健康检查配置

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8100/health"]
  interval: 30s
  timeout: 10s
  start_period: 40s
  retries: 3
```

---

## Server 环境变量

### 必需变量

| 变量                 | 说明               | 示例                                 |
| -------------------- | ------------------ | ------------------------------------ |
| `DATABASE_URL`       | PostgreSQL 连接串  | `postgresql://user:pwd@host:5432/db` |
| `REDIS_URL`          | Redis 连接串       | `redis://:pwd@host:6379/0`           |
| `JWT_ACCESS_SECRET`  | Access Token 密钥  | 32+ 字符随机串                       |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥 | 32+ 字符随机串                       |

### 可选变量

| 变量                   | 默认值 | 说明                 |
| ---------------------- | ------ | -------------------- |
| `PORT`                 | 8100   | 服务端口             |
| `JWT_ACCESS_TTL`       | 15m    | Access Token 有效期  |
| `JWT_REFRESH_TTL`      | 7d     | Refresh Token 有效期 |
| `PRISMA_SLOW_QUERY_MS` | 500    | 慢查询阈值 (ms)      |

---

## 数据库迁移

### 部署时自动执行

```bash
docker-compose exec -T server pnpm prisma migrate deploy
```

### 注意事项

- 确保 migrations 文件已提交到 Git
- 生产环境部署前先在 staging 验证迁移
- 重要更新前备份数据库
- **禁止**对生产库使用 `prisma migrate dev`

---

## 验证部署

```bash
# 健康检查
curl https://api-staging.{{DOMAIN}}/health

# API 文档
open https://api-staging.{{DOMAIN}}/api

# 容器日志
docker logs xiaoyue-server-staging --tail 100 -f
```

---

## 故障排查

### 容器无法启动

```bash
# 查看日志
docker logs xiaoyue-server-staging

# 常见原因
# - 环境变量缺失
# - 数据库连接失败
# - 端口冲突
```

### 数据库迁移失败

```bash
# 检查迁移状态
docker-compose exec -T server pnpm prisma migrate status

# 手动执行迁移
docker-compose exec -T server pnpm prisma migrate deploy
```

---

## 更多信息

完整的部署说明（包括服务器准备、GitHub Secrets 配置、回滚操作等）请参考：

- [完整部署手册](/docs/runbooks/deployment/deployment-guide.md)
- [Staging 故障排查](/docs/runbooks/deployment/staging-troubleshooting.md)
