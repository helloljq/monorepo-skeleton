# 整体架构概览

## 项目结构

{{TITLE}}采用 Monorepo 架构，使用 pnpm workspace + Turborepo 管理。

```
{{TITLE}}/
├── apps/                    # 应用
│   ├── server/             # NestJS 后端
│   ├── admin-web/          # React 管理后台
│   ├── www-web/            # WWW 移动端
│   └── miniprogram/        # 微信小程序
├── packages/               # 共享包
│   ├── shared-types/       # 共享类型
│   └── shared-utils/       # 共享工具
├── tooling/                # 工具配置
│   ├── eslint-config/
│   ├── typescript-config/
│   └── tailwind-config/
└── docs/                   # 项目文档
```

## 应用说明

### Server (后端服务)

- 技术栈: NestJS 11 + Prisma + PostgreSQL + Redis
- 端口: {{PORT_SERVER_DEV}} (dev), {{PORT_SERVER_STAGING}} (staging), {{PORT_SERVER_PROD}} (prod)
- 职责: 提供 RESTful API、WebSocket 服务

### Admin Web (管理后台)

- 技术栈: React 18 + Vite + shadcn/ui + TanStack Query
- 端口: {{PORT_ADMIN_DEV}} (dev), {{PORT_ADMIN_STAGING}} (staging), {{PORT_ADMIN_PROD}} (prod)
- 职责: 系统管理、配置管理、用户管理

### WWW Web (移动端)

- 技术栈: React 18 + Vite + Tailwind CSS
- 端口: {{PORT_WWW_DEV}} (dev), {{PORT_WWW_STAGING}} (staging), {{PORT_WWW_PROD}} (prod)
- 职责: 用户端移动网页

### Miniprogram (小程序)

- 技术栈: Taro 4 + React
- 职责: 微信小程序端

## 数据流

```
用户 → H5/小程序/Admin → Server → PostgreSQL/Redis
```

## 部署架构

```
                    ┌─────────────┐
                    │   Nginx     │
                    │  (反向代理)  │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│   Admin Web   │  │   WWW Web     │  │    Server     │
│   (静态文件)   │  │   (静态文件)   │  │  (NestJS)    │
└───────────────┘  └───────────────┘  └───────┬───────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                          ▼                   ▼                   ▼
                   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
                   │  PostgreSQL │     │    Redis    │     │ 微信小程序   │
                   └─────────────┘     └─────────────┘     └─────────────┘
```
