# 新同事入职指南

欢迎加入{{TITLE}}项目！本文档帮助你快速了解项目规范和开发流程。

---

## ⚠️ 开发规范速查（必读）

**每次开发前，确保你已阅读：**

| 文档                                        | 必读内容                    |
| ------------------------------------------- | --------------------------- |
| [Git 工作流](./development/git-workflow.md) | 分支命名、提交格式、PR 规范 |
| [代码风格](./development/code-style.md)     | 命名规范、代码规范          |
| 你负责的应用 CLAUDE.md                      | `apps/<应用名>/CLAUDE.md`   |

**每次提交前，必须通过：**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

**分支命名**：`feat/server/add-xxx` 或 `fix/admin-web/fix-xxx`

**提交格式**：`feat(server): add user api`

> 💡 不确定的事情先问，不要自己乱改。

---

## 第一天

### 1. 环境准备

```bash
# 必需软件
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- PostgreSQL >= 14
- Redis >= 6
- Git
- VS Code (推荐)
```

### 2. 项目初始化

```bash
# 克隆仓库
git clone <repo-url>
cd {{TITLE}}

# 安装依赖
pnpm install

# 配置本地 hosts
# macOS/Linux: sudo vim /etc/hosts
# Windows: C:\Windows\System32\drivers\etc\hosts
# 添加以下内容：
# 127.0.0.1 api-dev.{{DOMAIN}}
# 127.0.0.1 www-dev.{{DOMAIN}}
# 127.0.0.1 admin-dev.{{DOMAIN}}
```

> **重要**: 必须配置 hosts 才能正常访问本地服务，详细步骤请参考 [本地 Hosts 配置指南](./development/local-hosts-setup.md)

#### 方式 A：连接 NAS 数据库（推荐）

> 需要已配置 Tailscale 并能访问 NAS

```bash
# 1. 验证 NAS 连通性
nc -zv nas {{PORT_POSTGRES_DEV}} && nc -zv nas {{PORT_REDIS_DEV}}

# 2. 配置各应用环境变量
# 注意: server 使用 .env (Prisma CLI 要求)，前端使用 .env.development (Vite 支持)
cd apps/server && cp .env.example .env
cd ../admin-web && cp .env.example .env.development
cd ../www-web && cp .env.example .env.development
cd ../..

# 3. 编辑 apps/server/.env，填入实际数据库密码

# 4. 初始化数据库
pnpm --filter server prisma:generate
pnpm --filter server exec prisma migrate dev

# 5. 初始化种子数据（角色和权限）
pnpm --filter server prisma:seed

# 6. 启动开发
pnpm --filter server start:dev      # 终端 1
pnpm --filter admin-web dev         # 终端 2
pnpm --filter www-web dev           # 终端 3
```

> **首个用户**: 系统初始化后，第一个注册的用户会自动成为超级管理员 (SUPER_ADMIN)

#### 方式 B：本地 Docker 数据库（备选）

> 适用于：无法访问 NAS、Tailscale 未配置、需要独立环境

```bash
# 1. 启动本地数据库
docker-compose up -d

# 2. 配置各应用环境变量
# 注意: server 使用 .env (Prisma CLI 要求)，前端使用 .env.development (Vite 支持)
cd apps/server && cp .env.example .env
cd ../admin-web && cp .env.example .env.development
cd ../www-web && cp .env.example .env.development
cd ../..

# 3. 编辑 apps/server/.env，改为本地数据库配置：
#    DATABASE_URL=postgresql://xiaoyue:xiaoyue123@localhost:5432/xiaoyue_health
#    REDIS_URL=redis://localhost:6379/0

# 4. 初始化数据库
pnpm --filter server prisma:generate
pnpm --filter server exec prisma migrate dev

# 5. 初始化种子数据（角色和权限）
pnpm --filter server prisma:seed

# 6. 启动开发
pnpm --filter server start:dev      # 终端 1
pnpm --filter admin-web dev         # 终端 2
pnpm --filter www-web dev           # 终端 3
```

> **首个用户**: 系统初始化后，第一个注册的用户会自动成为超级管理员 (SUPER_ADMIN)

### 3. 验证环境

| 服务     | 地址                              | 预期结果          |
| -------- | --------------------------------- | ----------------- |
| API 文档 | https://api-dev.{{DOMAIN}}/api    | Swagger UI        |
| 管理后台 | https://admin-dev.{{DOMAIN}}      | 登录页面          |
| 健康检查 | https://api-dev.{{DOMAIN}}/health | `{"status":"ok"}` |

---

## 必读文档

### 第一周必读

| 文档       | 位置                                                                          | 说明              |
| ---------- | ----------------------------------------------------------------------------- | ----------------- |
| 贡献指南   | [CONTRIBUTING.md](../../../CONTRIBUTING.md)                                   | 提交规范、PR 流程 |
| 代码风格   | [docs/runbooks/development/code-style.md](./code-style.md)                    | 代码规范          |
| Git 工作流 | [docs/runbooks/development/git-workflow.md](./git-workflow.md)                | 分支策略          |
| 项目架构   | [docs/design/architecture/overview.md](../../design/architecture/overview.md) | 整体架构          |

### 按角色阅读

#### 后端开发

| 文档         | 位置                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------- |
| 后端开发规范 | [apps/server/CLAUDE.md](../../../apps/server/CLAUDE.md)                                           |
| 详细开发指南 | [apps/server/docs/development-guidelines.md](../../../apps/server/docs/development-guidelines.md) |

#### 前端开发

| 文档           | 位置                                                          |
| -------------- | ------------------------------------------------------------- |
| Admin Web 规范 | [apps/admin-web/CLAUDE.md](../../../apps/admin-web/CLAUDE.md) |
| WWW Web 规范   | [apps/www-web/CLAUDE.md](../../../apps/www-web/CLAUDE.md)     |

#### 小程序开发

| 文档       | 位置                                                              |
| ---------- | ----------------------------------------------------------------- |
| 小程序规范 | [apps/miniprogram/CLAUDE.md](../../../apps/miniprogram/CLAUDE.md) |

---

## 开发流程

### 日常开发流程

```
1. 领取任务
   └─ 从 Issue 或产品需求获取任务

2. 创建分支
   └─ git checkout -b feat/server/add-user-api

3. 开发实现
   ├─ 编写代码
   ├─ 编写测试
   └─ 本地验证

4. 提交代码
   ├─ pnpm lint && pnpm typecheck
   ├─ git add .
   └─ git commit -m "feat(server): add user registration API"

5. 创建 PR
   ├─ 填写 PR 描述
   ├─ 指定 Reviewer
   └─ 等待 CI 通过

6. Code Review
   ├─ 响应评论
   └─ 修改代码

7. 合并
   └─ Squash and Merge
```

### 提交规范速查

> 详细规范请参考 [Git 工作流](./development/git-workflow.md)

```bash
# 格式
<type>(<scope>): <description>

# 示例
feat(server): add user registration API
fix(admin-web): fix login page redirect
```

---

## 常见问题

### Q: 依赖安装失败？

```bash
# 清除缓存重试
pnpm store prune
rm -rf node_modules
pnpm install
```

### Q: 数据库连接失败？

```bash
# 方式 A (NAS): 检查 Tailscale 连通性
nc -zv nas {{PORT_POSTGRES_DEV}}
nc -zv nas {{PORT_REDIS_DEV}}

# 方式 B (本地 Docker): 检查容器状态
docker-compose ps

# 检查环境变量是否正确
echo $DATABASE_URL
echo $REDIS_URL
```

### Q: Prisma Client 报错？

```bash
# 重新生成
pnpm --filter server prisma:generate
```

### Q: ESLint 报错？

```bash
# 自动修复
pnpm lint --fix

# 格式化
pnpm format
```

---

## 寻求帮助

1. **查阅文档**：先搜索 `docs/` 目录
2. **搜索 Issue**：可能已有解决方案
3. **询问同事**：Slack/钉钉群组
4. **创建 Issue**：记录新问题

---

## 第一天实战任务

完成以下任务来验证环境并熟悉工作流程：

### 任务 1：运行并验证项目 ✅

```bash
# 启动所有服务
pnpm dev

# 验证以下地址可访问
# - https://api-dev.{{DOMAIN}}/api (Swagger)
# - https://admin-dev.{{DOMAIN}} (Admin)
# - https://api-dev.{{DOMAIN}}/health (返回 {"status":"ok"})
```

### 任务 2：配置 IDE 环境 ✅

安装 VS Code 插件：

- [ ] ESLint (`dbaeumer.vscode-eslint`)
- [ ] Prettier (`esbenp.prettier-vscode`)
- [ ] Prisma (`Prisma.prisma`)
- [ ] Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)

验证：打开任意 `.ts` 文件，故意写错格式，确认 ESLint 能标红报错

### 任务 3：提交练习 PR ✅

目的：熟悉 Git 工作流和 PR 流程

```bash
# 1. 创建分支
git checkout -b chore/onboarding-<你的名字>

# 2. 在 ONBOARDING.md 末尾添加你的入职日期
echo "<!-- <你的名字> onboarded on $(date +%Y-%m-%d) -->" >> docs/runbooks/development/onboarding.md

# 3. 提交
git add docs/runbooks/development/onboarding.md
git commit -m "chore(docs): add onboarding record for <你的名字>"

# 4. 推送并创建 PR
git push -u origin chore/onboarding-<你的名字>
# 在 GitHub 创建 PR，描述填写"入职练习 PR"
```

等待 CI 通过 + Code Review 后合并。

### 任务 4：查看 API 文档 ✅

1. 访问 https://api-dev.{{DOMAIN}}/api
2. 找到 `Auth` 模块，查看登录接口
3. 使用 Swagger 的 "Try it out" 调用健康检查接口

---

## 检查清单

### 入职第一天

- [ ] 环境搭建完成（任务 1）
- [ ] IDE 插件配置完成（任务 2）
- [ ] 练习 PR 已提交（任务 3）
- [ ] 熟悉 API 文档（任务 4）

### 入职第一周

- [ ] 阅读必读文档
- [ ] 练习 PR 已合并
- [ ] 领取第一个真实任务
- [ ] 参与一次 Code Review

### 入职第一月

- [ ] 熟悉项目架构
- [ ] 独立完成功能开发
- [ ] 参与技术讨论
- [ ] 贡献文档改进
