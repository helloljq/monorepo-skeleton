# CLAUDE.md

This file provides guidance to Claude Code when working with this WWW mobile web application.

## 项目概述

{{TITLE}} WWW 移动端应用（H5），面向 C 端用户，基于 React 19 + Vite + Tailwind CSS。

**定位**: 移动端 H5 应用，需要考虑：
- 移动端优先的 UI/UX 设计
- 触摸交互优化
- 性能优化（首屏加载、图片懒加载）
- 微信环境兼容

## 常用命令

```bash
pnpm dev          # 启动开发服务器 (端口 3200)
pnpm build        # 构建生产版本
pnpm typecheck    # 类型检查
pnpm lint         # 代码检查
pnpm api:generate # 从 Swagger 生成 API 代码（如有配置）
```

## 技术栈

- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Router v7
- TanStack Query（服务端状态）

## 代码规范

- 组件使用函数式组件 + Hooks
- 使用 TypeScript strict mode
- 移动端优先的响应式设计
- 路径别名: `@/` 指向 `src/`
- 图标统一使用 `lucide-react`

## Language Preference

Always respond in Simplified Chinese (简体中文).

---

## AI 快速参考

> 本节为 AI 辅助开发优化，包含最常用的操作步骤和模式参考。

### 项目结构

```
src/
├── components/       # 通用组件
│   ├── ui/          # 基础 UI 组件
│   └── common/      # 业务通用组件
├── pages/           # 页面组件
├── hooks/           # 自定义 hooks
├── stores/          # Zustand 状态
├── api/             # API 相关
│   ├── generated/   # Orval 生成（如有）
│   └── client.ts    # API 客户端配置
├── lib/             # 工具函数
└── styles/          # 全局样式
```

### 移动端页面模板

```tsx
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function ExamplePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-10 flex items-center h-12 px-4 bg-white border-b">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-medium">页面标题</h1>
        <div className="w-6" /> {/* 占位，保持标题居中 */}
      </header>

      {/* 页面内容 */}
      <main className="p-4">
        {/* 内容 */}
      </main>

      {/* 底部固定按钮（如需要） */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t safe-area-inset-bottom">
        <button className="w-full h-12 bg-primary text-white rounded-lg">
          确认
        </button>
      </footer>
    </div>
  )
}
```

### 列表页模板（带下拉刷新）

```tsx
import { useState } from 'react'

export function ListPage() {
  const [refreshing, setRefreshing] = useState(false)
  const { data, isLoading, refetch } = useXxxControllerFindAll()

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 列表 */}
      <div className="divide-y divide-gray-100">
        {data?.data.map((item) => (
          <div key={item.id} className="p-4 bg-white">
            {/* 列表项内容 */}
          </div>
        ))}
      </div>

      {/* 空状态 */}
      {!isLoading && data?.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-gray-400">暂无数据</p>
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
```

### 移动端设计规范

| 元素 | 规范 |
|------|------|
| 最小触摸区域 | 44x44px |
| 页面内边距 | 16px (`p-4`) |
| 卡片圆角 | 8px (`rounded-lg`) |
| 主按钮高度 | 48px (`h-12`) |
| 导航栏高度 | 48px (`h-12`) |
| 字体大小 | 正文 14px，标题 16-18px |

### 安全区域适配

```css
/* 底部安全区域（刘海屏） */
.safe-area-inset-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 或使用 Tailwind 插件 */
<div className="pb-safe">内容</div>
```

### 常见任务命令

| 任务 | 命令 |
|------|------|
| 启动开发服务 | `pnpm dev` |
| 构建生产版本 | `pnpm build` |
| 类型检查 | `pnpm typecheck` |
| 代码检查 | `pnpm lint` |

### AI 常见错误提醒

| 错误 | 正确做法 |
|------|---------|
| 使用桌面端 UI 模式 | 移动端优先，触摸友好 |
| 按钮/链接太小 | 最小触摸区域 44x44px |
| 忽略安全区域 | 使用 `safe-area-inset-*` |
| 使用 hover 效果 | 移动端应使用 active 效果 |
| 固定底部内容遮挡 | 添加对应高度的 padding-bottom |
