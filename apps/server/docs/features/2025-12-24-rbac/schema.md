# RBAC 数据库设计

> 创建日期: 2025-12-24
> 状态: 设计中

## 一、设计原则

1. **身份与凭证分离**: User 表只存储用户主体信息，登录凭证存储在 UserIdentity 表
2. **标准 RBAC 模型**: User → UserRole → Role → RolePermission → Permission
3. **软删除支持**: 所有核心表支持软删除
4. **审计友好**: 所有表包含 createdAt/updatedAt，关键操作落审计日志

## 二、ER 图

```
┌─────────────────┐
│      User       │
│─────────────────│
│ id (PK)         │
│ name            │
│ avatar          │
│ status          │
│ ...             │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│  UserIdentity   │
│─────────────────│
│ id (PK)         │
│ userId (FK)     │
│ provider        │──── EMAIL | PHONE | WECHAT_OPEN | WECHAT_UNION | WECHAT_MINI
│ providerId      │
│ credential      │
│ ...             │
└─────────────────┘

┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│      User       │         │    UserRole     │         │      Role       │
│─────────────────│ 1     N │─────────────────│ N     1 │─────────────────│
│ id              │◄────────│ userId (FK)     │────────►│ id              │
│ ...             │         │ roleId (FK)     │         │ code            │
└─────────────────┘         │ ...             │         │ name            │
                            └─────────────────┘         │ ...             │
                                                        └────────┬────────┘
                                                                 │
                                                                 │ 1:N
                                                                 ▼
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   Permission    │         │ RolePermission  │         │      Role       │
│─────────────────│ 1     N │─────────────────│ N     1 │─────────────────│
│ id              │◄────────│ permissionId    │────────►│ id              │
│ code            │         │ roleId (FK)     │         │ ...             │
│ name            │         │ ...             │         └─────────────────┘
│ resource        │         └─────────────────┘
│ action          │
│ ...             │
└─────────────────┘
```

## 三、表结构设计

### 3.1 User 表 (改造)

改造现有 User 表，将登录凭证迁移到 UserIdentity。

```prisma
model User {
  id        Int       @id @default(autoincrement())

  // === 基础信息 ===
  name      String?   @db.VarChar(100)        // 显示名称
  avatar    String?   @db.VarChar(500)        // 头像 URL

  // === 状态控制 ===
  status    UserStatus @default(ACTIVE)       // 账号状态

  // === 时间戳 ===
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // === 软删除 ===
  deletedAt   DateTime?
  deletedById Int?
  deleteReason String? @db.VarChar(500)

  // === 关联 ===
  identities    UserIdentity[]
  roles         UserRole[]                              // 用户拥有的角色
  grantedRoles  UserRole[]   @relation("RoleGrantor")   // 用户授予他人的角色
  deletedRoles  Role[]       @relation("RoleDeletedBy") // 用户软删除的角色
  auditLogs     AuditLog[]   @relation("ActorAuditLogs")
  deletedBy     User?        @relation("UserDeletedBy", fields: [deletedById], references: [id])
  deletedUsers  User[]       @relation("UserDeletedBy")

  @@map("users")
}

enum UserStatus {
  ACTIVE      // 正常
  DISABLED    // 禁用
  PENDING     // 待激活
}
```

**变更说明**:

- 移除 `email` 和 `password` 字段 (迁移到 UserIdentity)
- 新增 `status` 字段控制账号状态
- 新增 `avatar` 字段

### 3.2 UserIdentity 表 (新增)

存储用户的各种登录身份凭证。

```prisma
model UserIdentity {
  id          Int       @id @default(autoincrement())
  userId      Int

  // === 身份标识 ===
  provider    IdentityProvider              // 身份提供者类型
  providerId  String    @db.VarChar(255)    // 提供者内的唯一标识

  // === 凭证信息 ===
  credential    String?   @db.VarChar(500)  // 密码哈希/无 (OAuth)
  credentialExp DateTime?                   // 凭证过期时间 (如短信验证码)

  // === 扩展信息 ===
  metadata    Json?                         // 提供者返回的原始数据

  // === 状态 ===
  verified    Boolean   @default(false)     // 是否已验证
  verifiedAt  DateTime?                     // 验证时间

  // === 时间戳 ===
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // === 关联 ===
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // === 索引 ===
  @@unique([provider, providerId])          // 同一提供者下 ID 唯一
  @@index([userId])
  @@map("user_identities")
}

enum IdentityProvider {
  EMAIL           // 邮箱登录: providerId = email
  PHONE           // 手机登录: providerId = phone
  WECHAT_OPEN     // 微信开放平台 (扫码): providerId = openid
  WECHAT_UNION    // 微信 UnionID: providerId = unionid
  WECHAT_MINI     // 微信小程序: providerId = openid
  WECHAT_MP       // 微信公众号 (网页): providerId = openid
}
```

**字段说明**:

| 字段         | 说明                   | 示例                              |
| ------------ | ---------------------- | --------------------------------- |
| `provider`   | 身份提供者类型         | `EMAIL`, `PHONE`, `WECHAT_OPEN`   |
| `providerId` | 在该提供者下的唯一标识 | 邮箱地址、手机号、微信 openid     |
| `credential` | 凭证 (密码哈希)        | bcrypt hash，OAuth 登录为空       |
| `metadata`   | 扩展元数据             | 微信返回的 nickname/headimgurl 等 |
| `verified`   | 是否已验证             | 邮箱/手机是否验证过               |

### 3.3 Role 表 (新增)

```prisma
model Role {
  id          Int       @id @default(autoincrement())

  // === 基础信息 ===
  code        String    @unique @db.VarChar(50)   // 角色代码 (程序使用)
  name        String    @db.VarChar(100)          // 角色名称 (显示用)
  description String?   @db.VarChar(500)          // 角色描述

  // === 分类 ===
  type        RoleType  @default(CUSTOM)          // 角色类型

  // === 状态 ===
  isEnabled   Boolean   @default(true)            // 是否启用

  // === 时间戳 ===
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // === 软删除 ===
  deletedAt     DateTime?
  deletedById   Int?
  deleteReason  String?   @db.VarChar(500)

  // === 关联 ===
  users       UserRole[]
  permissions RolePermission[]
  deletedBy   User?     @relation("RoleDeletedBy", fields: [deletedById], references: [id])

  @@map("roles")
}

enum RoleType {
  SYSTEM    // 系统内置角色 (不可删除)
  CUSTOM    // 自定义角色
}
```

**预置系统角色**:

| code          | name       | 说明                           |
| ------------- | ---------- | ------------------------------ |
| `SUPER_ADMIN` | 超级管理员 | 拥有所有权限，不受权限检查约束 |
| `ADMIN`       | 管理员     | 后台管理权限                   |
| `USER`        | 普通用户   | 默认角色，基础权限             |
| `GUEST`       | 访客       | 只读权限                       |

### 3.4 Permission 表 (新增)

```prisma
model Permission {
  id          Int       @id @default(autoincrement())

  // === 基础信息 ===
  code        String    @unique @db.VarChar(100)  // 权限代码
  name        String    @db.VarChar(100)          // 权限名称
  description String?   @db.VarChar(500)          // 权限描述

  // === 资源与动作 ===
  resource    String    @db.VarChar(50)           // 资源类型 (如 user, order)
  action      String    @db.VarChar(50)           // 操作类型 (如 create, read, update, delete)

  // === 分组 ===
  module      String?   @db.VarChar(50)           // 所属模块 (如 system, business)

  // === 状态 ===
  isEnabled   Boolean   @default(true)

  // === 时间戳 ===
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // === 关联 ===
  roles       RolePermission[]

  // === 索引 ===
  @@index([resource, action])
  @@index([module])
  @@map("permissions")
}
```

**权限命名规范**:

- `code` 格式: `{resource}:{action}` 或 `{resource}:{action}:{scope}`
- 示例: `user:create`, `user:read:self`, `order:delete:any`

**预置权限示例**:

| code                | resource   | action | 说明     |
| ------------------- | ---------- | ------ | -------- |
| `user:create`       | user       | create | 创建用户 |
| `user:read`         | user       | read   | 查看用户 |
| `user:read:self`    | user       | read   | 查看自己 |
| `user:update`       | user       | update | 修改用户 |
| `user:delete`       | user       | delete | 删除用户 |
| `role:manage`       | role       | manage | 管理角色 |
| `permission:manage` | permission | manage | 管理权限 |

### 3.5 UserRole 表 (新增)

用户与角色的多对多关联表。

```prisma
model UserRole {
  id        Int       @id @default(autoincrement())
  userId    Int
  roleId    Int

  // === 授权信息 ===
  grantedBy   Int?                            // 授权人
  grantedAt   DateTime  @default(now())       // 授权时间
  expiresAt   DateTime?                       // 过期时间 (临时角色)

  // === 关联 ===
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  role      Role      @relation(fields: [roleId], references: [id], onDelete: Cascade)
  grantor   User?     @relation("RoleGrantor", fields: [grantedBy], references: [id], onDelete: SetNull)

  // === 约束 ===
  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
  @@map("user_roles")
}
```

### 3.6 RolePermission 表 (新增)

角色与权限的多对多关联表。

```prisma
model RolePermission {
  id            Int       @id @default(autoincrement())
  roleId        Int
  permissionId  Int

  // === 授权信息 ===
  grantedBy   Int?
  grantedAt   DateTime  @default(now())

  // === 关联 ===
  role        Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission  Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  // === 约束 ===
  @@unique([roleId, permissionId])
  @@index([roleId])
  @@index([permissionId])
  @@map("role_permissions")
}
```

## 四、微信登录身份映射

### 4.1 微信开放平台体系

```
┌────────────────────────────────────────────────────────┐
│                    微信开放平台                         │
│                    (UnionID 体系)                       │
├──────────────────┬──────────────────┬─────────────────┤
│   微信 APP       │   公众号/H5      │   小程序         │
│  (WECHAT_OPEN)   │  (WECHAT_MP)     │  (WECHAT_MINI)  │
│                  │                   │                 │
│  OpenID: xxx1    │  OpenID: xxx2     │  OpenID: xxx3   │
│        ↘         │        ↓          │        ↙        │
│                  UnionID: yyy                          │
└────────────────────────────────────────────────────────┘
```

### 4.2 身份绑定策略

**场景 1: 新用户首次微信登录**

```
1. 用户扫码/授权登录
2. 获取 openid + unionid
3. 查询 UserIdentity: provider=WECHAT_UNION, providerId=unionid
   - 不存在 → 创建新 User + 两条 UserIdentity (UNION + OPEN/MINI/MP)
   - 存在 → 获取 User，补充当前渠道的 UserIdentity
4. 返回 JWT Token
```

**场景 2: 已有邮箱用户绑定微信**

```
1. 用户已登录 (JWT)
2. 发起微信绑定请求
3. 获取 openid + unionid
4. 检查 unionid 是否已被其他账号绑定
   - 已绑定 → 返回错误 (需账号合并或解绑)
   - 未绑定 → 创建 UserIdentity 关联到当前用户
```

### 4.3 UserIdentity 数据示例

同一用户通过多种方式登录后的数据:

| id  | userId | provider     | providerId       | credential    | metadata            |
| --- | ------ | ------------ | ---------------- | ------------- | ------------------- |
| 1   | 100    | EMAIL        | john@example.com | $2b$10$xxx... | null                |
| 2   | 100    | PHONE        | 13800138000      | null          | null                |
| 3   | 100    | WECHAT_UNION | o6_xxx_unionid   | null          | {"nickname":"John"} |
| 4   | 100    | WECHAT_OPEN  | oXXX_openid_app  | null          | {"subscribe":1}     |
| 5   | 100    | WECHAT_MINI  | oYYY_openid_mini | null          | {}                  |

## 五、索引设计

### 5.1 主要查询场景与索引

| 查询场景     | 涉及表         | 索引                               |
| ------------ | -------------- | ---------------------------------- |
| 邮箱登录     | UserIdentity   | `@@unique([provider, providerId])` |
| 手机号登录   | UserIdentity   | 同上                               |
| 微信登录     | UserIdentity   | 同上                               |
| 获取用户角色 | UserRole       | `@@index([userId])`                |
| 获取角色权限 | RolePermission | `@@index([roleId])`                |
| 按资源查权限 | Permission     | `@@index([resource, action])`      |

### 5.2 复合索引建议

```sql
-- 高频查询: 获取用户所有有效角色
CREATE INDEX idx_user_role_active ON user_roles(user_id)
WHERE expires_at IS NULL OR expires_at > NOW();

-- 权限检查: 检查角色是否有某权限
CREATE INDEX idx_role_permission_lookup ON role_permissions(role_id, permission_id);
```

## 六、数据迁移策略

### 6.1 迁移步骤

```
Phase 1: 准备
├── 1.1 创建新表 (UserIdentity, Role, Permission, UserRole, RolePermission)
├── 1.2 User 表新增 status, avatar 字段
└── 1.3 创建预置角色和权限

Phase 2: 数据迁移
├── 2.1 将 User.email + User.password 迁移到 UserIdentity (provider=EMAIL)
├── 2.2 为所有现有用户分配默认角色 (USER)
└── 2.3 验证数据完整性

Phase 3: 切换
├── 3.1 更新 AuthService 使用 UserIdentity 认证
├── 3.2 更新 JWT Payload 包含角色信息
└── 3.3 启用权限检查 Guard

Phase 4: 清理
├── 4.1 User 表移除 email, password 字段
└── 4.2 清理旧代码
```

### 6.2 迁移脚本示例

```sql
-- Phase 2.1: 迁移邮箱登录凭证
INSERT INTO user_identities (user_id, provider, provider_id, credential, verified, created_at, updated_at)
SELECT id, 'EMAIL', email, password, true, created_at, updated_at
FROM users
WHERE email IS NOT NULL AND deleted_at IS NULL;

-- Phase 2.2: 分配默认角色
INSERT INTO user_roles (user_id, role_id, granted_at)
SELECT u.id, r.id, NOW()
FROM users u
CROSS JOIN roles r
WHERE r.code = 'USER' AND u.deleted_at IS NULL;
```

### 6.3 回滚方案

- Phase 1-2: 直接删除新表和新字段
- Phase 3: 回退代码到旧版本
- Phase 4: 该阶段不可回滚，执行前需充分测试

## 七、软删除配置

需要更新 `PrismaService` 中的 `SOFT_DELETE_MODELS`:

```typescript
const SOFT_DELETE_MODELS = new Set<SoftDeleteModelName>([
  "User",
  "Role", // 新增
]);
```

**说明**:

- `Permission` 不需要软删除 (直接硬删或标记 isEnabled=false)
- `UserIdentity` 不需要软删除 (解绑即硬删)
- `UserRole`/`RolePermission` 不需要软删除 (关联表)
