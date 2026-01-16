# @{{NAME}}/shared-types

{{TITLE}}共享类型定义包，用于前后端共享的 TypeScript 类型。

## 使用

```typescript
import type {
  ApiResponse,
  PaginatedResponse,
  UserStatus,
} from "@{{NAME}}/shared-types";
```

## 包含类型

- `ApiResponse<T>` - API 响应类型
- `PaginatedResponse<T>` - 分页响应类型
- `PaginationMeta` - 分页元数据
- `PaginationParams` - 分页请求参数
- `UserStatus` - 用户状态枚举
- `RoleType` - 角色类型枚举
- `IdentityProvider` - 身份提供者枚举
- `ConfigValueType` - 配置值类型枚举
- `ConfigChangeType` - 配置变更类型枚举
