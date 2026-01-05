# CLAUDE.md

This file provides guidance to Claude Code when working with this WeChat miniprogram.

## 项目概述

{{TITLE}}微信小程序，基于 Taro 4 + React + TypeScript。

## 常用命令

```bash
pnpm dev          # 启动开发模式 (微信小程序)
pnpm build        # 构建生产版本
pnpm typecheck    # 类型检查
pnpm lint         # 代码检查
```

## 技术栈

- Taro 4
- React 18 + TypeScript
- Sass

## 项目结构

```
src/
├── pages/         # 页面
│   └── index/    # 首页
├── app.ts        # 应用入口
├── app.config.ts # 应用配置
└── app.scss      # 全局样式
```

## 开发规范

- 使用 Taro 组件而非原生小程序组件
- 页面文件放在 `src/pages/[name]/` 目录
- 每个页面需要有 `index.tsx`, `index.scss`, `index.config.ts`
- 样式使用 rpx 单位 (750 设计稿)

## 注意事项

- 此项目只用于微信小程序，不负责 H5
- 使用微信开发者工具打开 `dist` 目录进行预览

## Language Preference

Always respond in Simplified Chinese (简体中文).

---

## AI 快速参考

> 本节为 AI 辅助开发优化，包含最常用的操作步骤和模式参考。

### 项目结构（完整）

```
src/
├── pages/              # 页面目录
│   ├── index/         # 首页
│   │   ├── index.tsx
│   │   ├── index.scss
│   │   └── index.config.ts
│   └── [page-name]/   # 其他页面
├── components/         # 公共组件
│   ├── ui/            # 基础 UI 组件
│   └── common/        # 业务通用组件
├── hooks/              # 自定义 Hooks
├── stores/             # Zustand 状态管理（如有）
├── api/                # API 相关
│   ├── client.ts      # 请求封装
│   └── [module].ts    # 各模块 API
├── utils/              # 工具函数
├── types/              # 类型定义
├── app.ts              # 应用入口
├── app.config.ts       # 全局配置（tabBar、pages 等）
└── app.scss            # 全局样式
```

### 新增页面速查

**1. 创建页面文件**：

```
src/pages/{name}/
├── index.tsx        # 页面组件
├── index.scss       # 页面样式
└── index.config.ts  # 页面配置
```

**2. 注册路由** 到 `src/app.config.ts`：

```typescript
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/{name}/index',  // 新增页面
  ],
  // ...
})
```

### 页面模板

```tsx
// src/pages/{name}/index.tsx
import { View, Text } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import './index.scss'

export default function PageName() {
  useLoad(() => {
    console.log('Page loaded.')
  })

  return (
    <View className="page-name">
      <Text>页面内容</Text>
    </View>
  )
}
```

```typescript
// src/pages/{name}/index.config.ts
export default definePageConfig({
  navigationBarTitleText: '页面标题',
  enableShareAppMessage: true,  // 允许分享
  enableShareTimeline: true,    // 允许分享朋友圈
})
```

```scss
// src/pages/{name}/index.scss
.page-name {
  padding: 32rpx;
  min-height: 100vh;
  background-color: #f5f5f5;
}
```

### 列表页模板

```tsx
import { View, Text, ScrollView } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import './index.scss'

export default function ListPage() {
  const [list, setList] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchList = async () => {
    try {
      const res = await api.getList()
      setList(res.data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchList()
  }

  return (
    <ScrollView
      className="list-page"
      scrollY
      refresherEnabled
      refresherTriggered={refreshing}
      onRefresherRefresh={handleRefresh}
    >
      {loading ? (
        <View className="loading">加载中...</View>
      ) : list.length === 0 ? (
        <View className="empty">暂无数据</View>
      ) : (
        list.map((item) => (
          <View key={item.id} className="list-item">
            <Text>{item.name}</Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}
```

### Taro API 常用操作

```typescript
import Taro from '@tarojs/taro'

// 页面导航
Taro.navigateTo({ url: '/pages/detail/index?id=123' })
Taro.redirectTo({ url: '/pages/login/index' })
Taro.switchTab({ url: '/pages/index/index' })  // tabBar 页面
Taro.navigateBack({ delta: 1 })

// 获取页面参数
import { useRouter } from '@tarojs/taro'
const router = useRouter()
const { id } = router.params

// 显示提示
Taro.showToast({ title: '操作成功', icon: 'success' })
Taro.showLoading({ title: '加载中' })
Taro.hideLoading()

// 弹窗确认
const { confirm } = await Taro.showModal({
  title: '提示',
  content: '确定要删除吗？',
})

// 本地存储
Taro.setStorageSync('key', value)
const value = Taro.getStorageSync('key')

// 获取用户信息
const { code } = await Taro.login()  // 获取登录 code

// 系统信息
const systemInfo = Taro.getSystemInfoSync()
const { statusBarHeight, screenHeight, safeArea } = systemInfo
```

### 组件使用规范

```tsx
// ✅ 正确：使用 Taro 组件
import { View, Text, Image, Button, Input, ScrollView } from '@tarojs/components'

// ❌ 错误：使用原生 HTML 标签
<div>...</div>   // 不要使用
<span>...</span> // 不要使用
<img />          // 不要使用

// ✅ 正确的组件对应关系
// div → View
// span/p → Text
// img → Image
// input → Input
// button → Button
// ul/ol → View + map
// a → Navigator 或 View + onClick
```

### 样式规范

```scss
// 使用 rpx 单位（基于 750 设计稿）
// 设计稿 px 值直接写成 rpx
.container {
  width: 750rpx;          // 满屏宽度
  padding: 32rpx;         // 设计稿 32px
  font-size: 28rpx;       // 设计稿 28px
  border-radius: 16rpx;   // 设计稿 16px
}

// 常用尺寸参考（750 设计稿）
// 正文字号: 28rpx
// 小字: 24rpx
// 标题: 32-36rpx
// 页面边距: 32rpx
// 组件间距: 24rpx
// 按钮高度: 88rpx
// 导航栏高度: 88rpx (不含状态栏)

// 安全区域适配
.bottom-fixed {
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
}
```

### 微信登录流程

```typescript
// 1. 获取登录 code
const login = async () => {
  const { code } = await Taro.login()

  // 2. 发送 code 到后端换取 token
  const res = await api.auth.loginByWechat({ code })

  // 3. 存储 token
  Taro.setStorageSync('accessToken', res.data.accessToken)
  Taro.setStorageSync('refreshToken', res.data.refreshToken)
}

// 获取用户手机号（需要按钮触发）
<Button openType="getPhoneNumber" onGetPhoneNumber={handleGetPhone}>
  授权手机号
</Button>

const handleGetPhone = async (e) => {
  if (e.detail.errMsg === 'getPhoneNumber:ok') {
    const { code } = e.detail
    // 发送 code 到后端解密手机号
    await api.auth.bindPhone({ code })
  }
}
```

### 常见任务命令

| 任务 | 命令 |
|------|------|
| 启动开发 | `pnpm dev` |
| 构建生产版本 | `pnpm build` |
| 类型检查 | `pnpm typecheck` |
| 代码检查 | `pnpm lint` |

### Node.js 版本兼容性

⚠️ **重要**: Taro 4 与 Node.js 22 存在兼容性问题，请使用 Node.js 20 或更低版本。

```bash
# 检查 Node 版本
node -v

# 如使用 nvm，切换版本
nvm use 20
```

### AI 常见错误提醒

| 错误 | 正确做法 |
|------|---------|
| 使用 HTML 标签 | 使用 Taro 组件 (View, Text, Image) |
| 使用 px 单位 | 使用 rpx 单位 (750 设计稿) |
| 直接用 fetch/axios | 使用 Taro.request 或封装的 api |
| 忘记注册页面路由 | 在 app.config.ts 的 pages 中添加 |
| 使用 window/document | 小程序无 DOM API，使用 Taro API |
| Node.js 22 运行 | 使用 Node.js 20 或更低版本 |
| 使用 CSS hover | 小程序不支持，用 active 或 data-* 状态 |
