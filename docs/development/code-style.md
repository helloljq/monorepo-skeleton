# 代码风格规范

> 本文档是代码风格的**唯一事实来源**。

## 强制级别说明

| 标记 | 含义 | PR 影响 |
|------|------|---------|
| 🔴 | 阻塞 - 违反即拒绝 PR | 必须修复 |
| 🟡 | 建议修复 - 允许例外但需说明理由 | 应当修复 |
| 🟢 | 建议 - 经验性最佳实践 | 可选 |

---

## 通用原则

### 强制规则 🔴

| 规则 | 说明 |
|------|------|
| 🔴 TypeScript Strict | 所有项目启用 `strict: true` |
| 🔴 禁止 `any` | 除非有充分理由并注释说明 |
| 🔴 禁止 `console.log` | 使用 Logger（后端）或专用调试工具（前端） |
| 🔴 禁止魔法数字 | 抽取为常量或枚举 |
| 🔴 禁止未处理的 Promise | 必须 `await` 或正确处理 |

### 命名规范

| 类型 | 风格 | 示例 | 级别 |
|------|------|------|------|
| 文件名 | kebab-case | `user-profile.service.ts` | 🔴 |
| 类/接口 | PascalCase | `UserProfileService` | 🔴 |
| 变量/函数 | camelCase | `getUserById` | 🔴 |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` | 🟡 |
| 布尔变量 | is/has/can/should 前缀 | `isEnabled`, `hasPermission` | 🟡 |

### 函数规范

```typescript
// 🔴 函数保持短小，职责单一（建议 < 50 行）
async function validateUser(userId: string): Promise<User> {
  const user = await this.findById(userId);
  if (!user) {
    throw new NotFoundException('用户不存在');
  }
  return user;
}

// 🔴 禁止：函数过长，职责混乱
async function processUser(data: any) {
  // 50+ 行混合验证、业务逻辑、数据库操作...
}
```

---

## 后端规范 (NestJS)

### 分层职责 🔴

| 层 | 职责 | 禁止 |
|----|------|------|
| Controller | 路由、DTO、注解、调用 Service | 业务逻辑、数据库操作 |
| Service | 业务编排、领域规则 | 直接返回 HTTP 响应 |
| Module | 依赖组装 | 业务逻辑 |

### DTO 规范 🔴

```typescript
// 🔴 使用 Zod 定义 schema，错误消息必须中文
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email('邮箱格式不正确').trim(),
  password: z.string().min(8, '密码至少 8 位'),
  name: z.string().min(1, '姓名不能为空').max(50, '姓名最多 50 字'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
```

### 错误处理 🔴

```typescript
// 🔴 使用内置异常 + 业务错误码
throw new BadRequestException('参数错误');
throw new NotFoundException('用户不存在');
throw new BusinessException(ApiErrorCode.USER_DISABLED, '账号已被禁用');

// 🔴 禁止
throw new Error('something wrong');  // 缺少类型
throw { code: 400, message: '...' }; // 非标准格式
```

---

## 前端规范 (React)

### 组件规范 🔴

```tsx
// 🔴 函数组件 + TypeScript 类型定义
interface UserCardProps {
  user: User;
  onEdit: (id: string) => void;
}

export function UserCard({ user, onEdit }: UserCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <h3>{user.name}</h3>
      <Button onClick={() => onEdit(user.id)}>编辑</Button>
    </div>
  );
}

// 🔴 禁止
export default function(props: any) { ... }  // 无类型、默认导出
```

### 状态管理边界 🟡

| 状态类型 | 存储位置 | 示例 |
|----------|----------|------|
| 服务端数据 | TanStack Query | 用户列表、配置项 |
| 全局 UI 状态 | Zustand | 侧边栏折叠、主题 |
| 局部 UI 状态 | useState | 对话框开关、表单值 |
| URL 状态 | URL 参数 | 分页、筛选条件 |

### 样式规范 🔴

```tsx
// 🔴 使用 Tailwind + cn() 合并类名
import { cn } from '@/lib/utils';

<div className={cn(
  "rounded-lg border p-4",
  isActive && "border-primary bg-primary/10"
)} />

// 🔴 禁止内联样式
<div style={{ padding: '16px', borderRadius: '8px' }} />
```

---

## 小程序规范 (Taro)

### 组件规范 🔴

```tsx
// 🔴 使用 Taro 组件
import { View, Text } from '@tarojs/components';

function UserCard({ user }: { user: User }) {
  return (
    <View className="card">
      <Text className="name">{user.name}</Text>
    </View>
  );
}

// 🔴 禁止使用 HTML 标签
<div><span>{user.name}</span></div>
```

### 样式单位 🔴

```scss
// 🔴 使用 rpx（750 设计稿）
.card {
  width: 702rpx;
  padding: 24rpx;
  border-radius: 16rpx;
}

// 🔴 禁止使用 px（除非特殊需求）
.card {
  width: 351px;
}
```

---

## 工具配置

### 提交前检查 🔴

```bash
# husky + lint-staged 自动执行
pnpm lint        # ESLint 检查
pnpm typecheck   # TypeScript 类型检查
```

---

## 检查清单

提交代码前确认：

- [ ] 🔴 无 `any` 类型（除非有注释说明）
- [ ] 🔴 无 `console.log`
- [ ] 🔴 无魔法数字/字符串
- [ ] 🟡 函数 < 50 行
- [ ] 🟡 变量命名有意义
- [ ] 🔴 通过 `pnpm lint` 和 `pnpm typecheck`
