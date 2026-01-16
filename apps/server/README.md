# @{{NAME}}/server

{{TITLE}}后端服务，基于 NestJS 11。

## 技术栈

- NestJS 11 + TypeScript
- Prisma 5 + PostgreSQL
- Redis (ioredis)
- Zod + nestjs-zod
- Socket.io
- Pino + Prometheus

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm start:dev

# 构建
pnpm build

# 运行测试
pnpm test
```

## 数据库

```bash
# 生成 Prisma Client
pnpm prisma:generate

# 创建并应用迁移
pnpm prisma migrate dev

# 初始化种子数据（角色、权限）
pnpm prisma:seed
```

### 首次初始化说明

种子数据会创建：

- **角色**: SUPER_ADMIN（超管）、ADMIN（管理员）、USER（普通用户）
- **权限**: 用户管理、角色管理、权限管理、审计日志、字典配置等 16 个权限
- **角色-权限关联**: ADMIN 角色关联所有权限，SUPER_ADMIN 跳过权限检查

> **首个用户**: 系统中第一个注册的用户会自动成为超级管理员 (SUPER_ADMIN)

## 目录结构

```
src/
├── modules/          # 业务模块
│   ├── auth/        # 认证授权
│   ├── user/        # 用户管理
│   ├── role/        # 角色管理
│   ├── permission/  # 权限管理
│   ├── identity/    # 身份认证
│   ├── dictionary/  # 字典管理
│   ├── config-center/ # 配置中心
│   ├── health/      # 健康检查
│   └── ws/          # WebSocket
├── common/          # 公共基础设施
├── config/          # 配置服务
├── database/        # 数据库层
└── main.ts          # 入口
```

## 端点

> 本地开发需要先配置 hosts + Caddy，详见 [本地 Hosts 配置指南](../../docs/runbooks/development/local-hosts-setup.md)

- Swagger: https://api-dev.{{DOMAIN}}/api
- Health: https://api-dev.{{DOMAIN}}/health
- Metrics: https://api-dev.{{DOMAIN}}/metrics

详细开发规范请参考 [CLAUDE.md](./CLAUDE.md)
