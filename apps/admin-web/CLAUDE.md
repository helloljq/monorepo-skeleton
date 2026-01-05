# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

React 管理后台 Web 应用，技术栈：React 19 + TypeScript + Vite + shadcn/ui + Tailwind CSS。

详细架构设计见 `docs/` 目录。

## 常用命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建生产版本
pnpm typecheck    # 类型检查
pnpm lint         # 代码检查
pnpm lint:fix     # 代码检查并修复
pnpm format       # 代码格式化
pnpm test         # 运行测试
pnpm test src/path/to/file.test.ts  # 运行单个测试文件
pnpm test:coverage # 测试覆盖率
pnpm api:generate # 从 Swagger 生成 API 代码和类型
```

## 添加 shadcn/ui 组件

```bash
pnpm dlx shadcn@latest add [component-name]
```

## 关键架构决策

### 状态管理边界

- **Zustand**: 仅存全局 UI/会话态（侧边栏折叠、主题、当前用户），**不存服务端数据**
- **TanStack Query**: 所有服务端数据（列表、详情、字典），**不承担 UI 状态**
- **组件 useState**: 局部 UI 状态（对话框开关、表单临时值）
- **URL 参数**: 分页、筛选条件（便于分享和刷新保持）

### API 代码自动生成（Orval）

从后端 Swagger 生成代码：`pnpm api:generate`

生成目录：

- `src/api/generated/` - API 函数和 TanStack Query hooks（禁止手动修改）
- `src/api/model/` - DTO 类型定义（禁止手动修改）

使用示例：

```typescript
// 直接使用生成的 hooks
import { useAuthControllerLogin } from '@/api/generated/auth/auth'
import type { LoginDto } from '@/api/model'

function LoginForm() {
  const mutation = useAuthControllerLogin()

  const handleLogin = (data: LoginDto) => {
    mutation.mutate({ data })
  }
}
```

### 表单与类型

以 Zod schema 作为单一事实来源，推导 TS 类型：

```typescript
const userSchema = z.object({ name: z.string(), email: z.string().email() })
type UserFormData = z.infer<typeof userSchema>
```

## 代码组织

- 功能模块放 `features/[module]/`，包含 components、hooks、services、types.ts
- 通用组件放 `components/`（ui/ 为 shadcn，common/ 为业务通用，layout/ 为布局）
- 路径别名: `@/` 指向 `src/`
- 组件使用命名导出，文件名 PascalCase
- 图标统一使用 `lucide-react`
- 使用 `cn()` 合并 Tailwind class

## 提交规范

`feat(user): 添加用户列表分页功能` / `fix(auth): 修复登录token过期问题`

类型：feat / fix / docs / style / refactor / perf / test / chore

## Language Preference

Always respond in Simplified Chinese (简体中文).

---

## AI 快速参考

> 本节为 AI 辅助开发优化，包含最常用的操作步骤和模式参考。

### 新增功能模块速查

**1. 创建目录结构**：
```
src/features/{name}/
├── components/
│   ├── {Name}ListPage.tsx      # 列表页（路由组件）
│   ├── {Name}FormPage.tsx      # 新建/编辑页（路由组件）
│   ├── {Name}Table.tsx         # 表格组件
│   ├── DeleteConfirmDialog.tsx # 删除确认对话框
│   └── index.ts                # 统一导出
├── types.ts                    # 模块类型定义（如有）
└── hooks/                      # 自定义 hooks（可选）
```

**2. 添加路由** 到 `src/router/index.tsx`

**3. 添加菜单项**（如需要）

**4. 重新生成 API**（如后端有新接口）：
```bash
pnpm api:generate
```

### 列表页模板

```tsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { use{Name}ControllerFindAll } from '@/api/generated/{name}/{name}'
import { Button } from '@/components/ui/button'
import { {Name}Table } from './{Name}Table'

export function {Name}ListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Number(searchParams.get('page')) || 1
  const limit = Number(searchParams.get('limit')) || 10

  const { data, isLoading } = use{Name}ControllerFindAll({ page, limit })

  const handlePageChange = (newPage: number) => {
    setSearchParams({ page: String(newPage), limit: String(limit) })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{中文名}管理</h1>
        <Button asChild>
          <Link to="/{name}/new">
            <Plus className="mr-2 h-4 w-4" />
            新建{中文名}
          </Link>
        </Button>
      </div>

      <{Name}Table
        data={data?.data ?? []}
        isLoading={isLoading}
      />

      {/* 分页组件 */}
    </div>
  )
}
```

### 表单页模板

```tsx
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  use{Name}ControllerCreate,
  use{Name}ControllerUpdate,
  use{Name}ControllerFindOne,
} from '@/api/generated/{name}/{name}'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form'

const formSchema = z.object({
  name: z.string().min(1, '请输入名称'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

export function {Name}FormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = !!id

  // 编辑模式：获取详情
  const { data: detail } = use{Name}ControllerFindOne(Number(id), {
    query: { enabled: isEdit },
  })

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
    values: detail?.data
      ? { name: detail.data.name, description: detail.data.description ?? '' }
      : undefined,
  })

  const createMutation = use{Name}ControllerCreate()
  const updateMutation = use{Name}ControllerUpdate()

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data })
        toast.success('更新成功')
      } else {
        await createMutation.mutateAsync({ data })
        toast.success('创建成功')
      }
      navigate('/{name}')
    } catch {
      toast.error(isEdit ? '更新失败' : '创建失败')
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">
        {isEdit ? '编辑' : '新建'}{中文名}
      </h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>名称</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {isEdit ? '保存' : '创建'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              取消
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
```

### 表格组件模板

```tsx
import { Link } from 'react-router-dom'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { {Name}ResponseDto } from '@/api/model'

interface Props {
  data: {Name}ResponseDto[]
  isLoading: boolean
  onDelete?: (id: number) => void
}

export function {Name}Table({ data, isLoading, onDelete }: Props) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>
  }

  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">暂无数据</div>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>名称</TableHead>
          <TableHead>创建时间</TableHead>
          <TableHead className="w-[80px]">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.id}</TableCell>
            <TableCell>{item.name}</TableCell>
            <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/{name}/${item.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      编辑
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete?.(item.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### API 调用模式

```typescript
// ✅ 正确：使用 Orval 生成的 hooks
import { useUserControllerFindAll } from '@/api/generated/user/user'
import type { UserResponseDto } from '@/api/model'

// 查询列表
const { data, isLoading, error } = useUserControllerFindAll({ page: 1, limit: 10 })

// 查询详情
const { data: user } = useUserControllerFindOne(userId)

// 创建
const createMutation = useUserControllerCreate()
await createMutation.mutateAsync({ data: { email, password } })

// 更新
const updateMutation = useUserControllerUpdate()
await updateMutation.mutateAsync({ id: userId, data: { name } })

// 删除
const deleteMutation = useUserControllerRemove()
await deleteMutation.mutateAsync({ id: userId })

// ❌ 错误：手写 fetch/axios
fetch('/api/v1/users')  // 不要这样做
axios.get('/api/v1/users')  // 不要这样做
```

### 状态管理速查

| 数据类型 | 方案 | 示例 |
|---------|------|------|
| 服务端列表 | TanStack Query | `useUserControllerFindAll()` |
| 服务端详情 | TanStack Query | `useUserControllerFindOne(id)` |
| 全局 UI 状态 | Zustand | `useAuthStore()`, `useUiStore()` |
| 表单临时状态 | useState/useForm | `const [open, setOpen] = useState(false)` |
| 分页/筛选参数 | URL searchParams | `useSearchParams()` |
| 主题设置 | Zustand (persist) | `useSettingsStore()` |

### 常用组件导入

```typescript
// UI 基础组件 (shadcn/ui)
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

// 图标 (lucide-react)
import { Plus, Pencil, Trash2, Search, MoreHorizontal, ChevronLeft } from 'lucide-react'

// 工具函数
import { cn } from '@/lib/utils'

// Toast 通知
import { toast } from 'sonner'
```

### 常见任务命令

| 任务 | 命令 |
|------|------|
| 启动开发服务 | `pnpm dev` |
| 构建生产版本 | `pnpm build` |
| 类型检查 | `pnpm typecheck` |
| 代码检查 | `pnpm lint` |
| 运行测试 | `pnpm test` |
| 重新生成 API | `pnpm api:generate` |
| 添加 shadcn 组件 | `pnpm dlx shadcn@latest add [component]` |

### AI 常见错误提醒

| 错误 | 正确做法 |
|------|---------|
| 手写 API 请求 | 使用 Orval 生成的 hooks |
| 服务端数据存 Zustand | 服务端数据用 TanStack Query |
| 硬编码 API 地址 | API 地址在 `.env` 和 Orval 配置中 |
| 忘记处理 loading 状态 | 使用 `isLoading` 显示加载状态 |
| 忘记处理 error 状态 | 使用 `error` 显示错误信息 |
| 使用 `index.css` 写样式 | 使用 Tailwind CSS 类名 |
| 图标使用其他库 | 统一使用 `lucide-react` |
| 直接修改 `src/api/generated/` | 这是自动生成的，禁止手动修改 |
