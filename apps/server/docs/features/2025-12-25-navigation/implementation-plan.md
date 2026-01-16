# 导航模块实现方案

## 一、数据模型设计

### 1.1 NavigationGroup（导航分组）

```prisma
model NavigationGroup {
  id           Int       @id @default(autoincrement())
  name         String    @db.VarChar(100)
  code         String    @db.VarChar(50)
  description  String?   @db.VarChar(500)
  icon         String?   @db.VarChar(500)  // 支持图标名称或 URL
  sort         Int       @default(0)
  isSystem     Boolean   @default(false)   // true=公共, false=个人
  isEnabled    Boolean   @default(true)
  userId       Int?                        // 个人分组时必填

  // 软删除
  deletedAt    DateTime?
  deletedById  Int?
  deleteReason String?   @db.VarChar(500)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  // 关联
  User            User?            @relation("NavigationGroupOwner", fields: [userId], references: [id])
  DeletedByUser   User?            @relation("NavigationGroupDeletedBy", fields: [deletedById], references: [id])
  NavigationItem  NavigationItem[]

  @@unique([code, userId])  // code 在 userId 维度唯一
  @@index([userId, isEnabled])
  @@index([isSystem, isEnabled])
}
```

### 1.2 NavigationItem（导航项）

```prisma
model NavigationItem {
  id           Int       @id @default(autoincrement())
  groupId      Int
  title        String    @db.VarChar(100)
  url          String    @db.VarChar(1000)
  description  String?   @db.VarChar(500)
  icon         String?   @db.VarChar(500)
  sort         Int       @default(0)
  isSystem     Boolean   @default(false)
  isEnabled    Boolean   @default(true)
  openInNewTab Boolean   @default(true)
  metadata     Json?
  userId       Int?

  // 软删除
  deletedAt    DateTime?
  deletedById  Int?
  deleteReason String?   @db.VarChar(500)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  // 关联
  NavigationGroup NavigationGroup @relation(fields: [groupId], references: [id])
  User            User?           @relation("NavigationItemOwner", fields: [userId], references: [id])
  DeletedByUser   User?           @relation("NavigationItemDeletedBy", fields: [deletedById], references: [id])

  @@index([groupId, isEnabled])
  @@index([userId, isEnabled])
}
```

### 1.3 字段说明

| 字段       | 说明                                                    |
| ---------- | ------------------------------------------------------- |
| `isSystem` | true=公共导航（管理员管理），false=个人导航（用户管理） |
| `userId`   | 个人导航时为用户ID，公共导航时为 null                   |
| `code`     | 分组唯一标识，在 userId 维度唯一                        |
| `sort`     | 排序权重，数值越小越靠前                                |
| `icon`     | 支持图标名称（如 `home`）或 URL（如 CDN 链接）          |
| `metadata` | JSON 扩展字段，用于存储额外配置                         |

---

## 二、模块结构

```
src/modules/navigation/
├── navigation.module.ts
├── controllers/
│   ├── admin-navigation.controller.ts   # 管理员接口
│   └── user-navigation.controller.ts    # 用户接口
├── services/
│   ├── navigation.service.ts            # 核心业务
│   └── navigation-cache.service.ts      # Redis 缓存
├── dto/
│   ├── create-navigation-group.dto.ts
│   ├── update-navigation-group.dto.ts
│   ├── create-navigation-item.dto.ts
│   ├── update-navigation-item.dto.ts
│   ├── query-navigation.dto.ts
│   ├── reorder-navigation.dto.ts
│   └── index.ts
└── __tests__/
    ├── navigation.service.spec.ts
    └── navigation-cache.service.spec.ts
```

---

## 三、API 设计

### 3.1 公共接口（无需登录）

| 方法 | 路径                    | 说明                   |
| ---- | ----------------------- | ---------------------- |
| GET  | `/v1/navigation/public` | 获取公共导航（带缓存） |

### 3.2 用户接口（需登录）

| 方法   | 路径                               | 说明                      |
| ------ | ---------------------------------- | ------------------------- |
| GET    | `/v1/navigation/merged`            | 获取合并导航（公共+个人） |
| POST   | `/v1/navigation/my/groups`         | 创建个人分组              |
| GET    | `/v1/navigation/my/groups`         | 获取个人分组列表          |
| PATCH  | `/v1/navigation/my/groups/:id`     | 更新个人分组              |
| DELETE | `/v1/navigation/my/groups/:id`     | 删除个人分组              |
| PATCH  | `/v1/navigation/my/groups/reorder` | 批量调整分组排序          |
| POST   | `/v1/navigation/my/items`          | 创建个人导航项            |
| GET    | `/v1/navigation/my/items`          | 获取个人导航项列表        |
| PATCH  | `/v1/navigation/my/items/:id`      | 更新个人导航项            |
| DELETE | `/v1/navigation/my/items/:id`      | 删除个人导航项            |
| PATCH  | `/v1/navigation/my/items/reorder`  | 批量调整导航项排序        |

### 3.3 管理员接口

| 方法   | 路径                                  | 权限                    |
| ------ | ------------------------------------- | ----------------------- |
| POST   | `/v1/admin/navigation/groups`         | navigation:group:create |
| GET    | `/v1/admin/navigation/groups`         | navigation:group:read   |
| GET    | `/v1/admin/navigation/groups/:id`     | navigation:group:read   |
| PATCH  | `/v1/admin/navigation/groups/:id`     | navigation:group:update |
| DELETE | `/v1/admin/navigation/groups/:id`     | navigation:group:delete |
| PATCH  | `/v1/admin/navigation/groups/reorder` | navigation:group:update |
| POST   | `/v1/admin/navigation/items`          | navigation:item:create  |
| GET    | `/v1/admin/navigation/items`          | navigation:item:read    |
| GET    | `/v1/admin/navigation/items/:id`      | navigation:item:read    |
| PATCH  | `/v1/admin/navigation/items/:id`      | navigation:item:update  |
| DELETE | `/v1/admin/navigation/items/:id`      | navigation:item:delete  |
| PATCH  | `/v1/admin/navigation/items/reorder`  | navigation:item:update  |
| GET    | `/v1/admin/navigation/full`           | navigation:group:read   |

---

## 四、缓存策略

| Key                 | TTL     | 失效时机              |
| ------------------- | ------- | --------------------- |
| `nav:public`        | 1 小时  | 系统导航分组/项变更时 |
| `nav:user:{userId}` | 30 分钟 | 用户个人导航变更时    |

### 缓存逻辑

1. **公共导航**：首次查询时写入缓存，管理员修改时主动失效
2. **用户导航**：首次查询时写入缓存，用户修改时主动失效
3. **合并查询**：并行获取公共和个人导航，各自走缓存
4. **降级策略**：Redis 不可用时降级为直接查库

---

## 五、错误码定义

```typescript
// 16000-16999: Navigation 域
NAV_GROUP_NOT_FOUND: 16001,
NAV_GROUP_CODE_EXISTS: 16002,
NAV_ITEM_NOT_FOUND: 16003,
NAV_GROUP_NOT_OWNER: 16004,
NAV_ITEM_NOT_OWNER: 16005,
```

---

## 六、返回数据格式

### GET /v1/navigation/merged

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "name": "常用工具",
      "code": "common_tools",
      "description": "常用的在线工具",
      "icon": "tools",
      "sort": 0,
      "isSystem": true,
      "items": [
        {
          "id": 1,
          "title": "JSON 格式化",
          "url": "https://jsonformatter.org",
          "description": "在线 JSON 格式化工具",
          "icon": "https://example.com/json-icon.png",
          "sort": 0,
          "openInNewTab": true
        }
      ]
    },
    {
      "id": 10,
      "name": "我的收藏",
      "code": "my_favorites",
      "description": null,
      "icon": "star",
      "sort": 0,
      "isSystem": false,
      "items": []
    }
  ],
  "meta": {
    "publicCount": 2,
    "userCount": 1,
    "total": 3
  },
  "timestamp": 1735000000000
}
```

---

## 七、实现步骤

1. **数据库迁移**：添加 NavigationGroup 和 NavigationItem 模型
2. **更新 PrismaService**：添加软删除配置
3. **添加错误码**：Navigation 域 (16000-16999)
4. **创建 DTO**：输入校验
5. **创建 Service**：核心业务 + 缓存服务
6. **创建 Controller**：管理员接口 + 用户接口
7. **创建 Module**：注册到 AppModule
8. **编写测试**：Service 单元测试

---

## 八、权限码定义

| 权限码                    | 说明             | 适用角色 |
| ------------------------- | ---------------- | -------- |
| `navigation:group:create` | 创建系统导航分组 | 管理员   |
| `navigation:group:read`   | 查看系统导航分组 | 管理员   |
| `navigation:group:update` | 更新系统导航分组 | 管理员   |
| `navigation:group:delete` | 删除系统导航分组 | 管理员   |
| `navigation:item:create`  | 创建系统导航项   | 管理员   |
| `navigation:item:read`    | 查看系统导航项   | 管理员   |
| `navigation:item:update`  | 更新系统导航项   | 管理员   |
| `navigation:item:delete`  | 删除系统导航项   | 管理员   |
