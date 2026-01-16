# @{{NAME}}/admin-web

{{TITLE}}管理后台，基于 React 18 + Vite。

## 技术栈

- React 18 + TypeScript
- Vite
- shadcn/ui + Tailwind CSS
- TanStack Query + Zustand
- React Router v7
- Vitest (单元测试)

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建
pnpm build

# 运行单元测试
pnpm test
```

## API 代码生成

```bash
# 从后端 Swagger 生成 API 代码
pnpm api:generate
```

## 目录结构

```
src/
├── features/          # 功能模块
│   ├── auth/         # 认证
│   ├── user/         # 用户管理
│   ├── role/         # 角色管理
│   ├── permission/   # 权限管理
│   ├── dictionary/   # 字典管理
│   ├── config-item/  # 配置项
│   ├── namespace/    # 命名空间
│   ├── dashboard/    # 仪表盘
│   ├── profile/      # 个人资料
│   └── settings/     # 设置
├── components/       # 组件
│   ├── ui/          # shadcn 组件
│   ├── common/      # 通用组件
│   └── layout/      # 布局组件
├── api/             # API 层
├── stores/          # Zustand 状态
├── hooks/           # 自定义 Hooks
└── lib/             # 工具库
```

详细开发规范请参考 [CLAUDE.md](./CLAUDE.md)
