# 业务词汇表

供 AI 和开发者理解项目业务术语。

---

## 核心业务概念

| 术语      | 英文        | 说明                         |
| --------- | ----------- | ---------------------------- |
| {{TITLE}} | {{TITLE}}   | 项目名称，企业级健康管理平台 |
| 管理后台  | Admin Web   | 运营人员使用的 Web 管理系统  |
| 移动端    | WWW Web     | 面向 C 端用户的 H5 应用      |
| 小程序    | Miniprogram | 微信小程序客户端             |

---

## 用户与权限

| 术语       | 英文        | 说明                                                     |
| ---------- | ----------- | -------------------------------------------------------- |
| 用户       | User        | 系统用户，可以是管理员或普通用户                         |
| 身份       | Identity    | 用户的登录方式（邮箱/手机/微信等），一个用户可有多个身份 |
| 角色       | Role        | 权限集合，如 ADMIN、USER                                 |
| 权限       | Permission  | 单个操作权限，如 `user:read`、`user:write`               |
| 系统角色   | SYSTEM Role | 内置角色，不可删除修改                                   |
| 自定义角色 | CUSTOM Role | 用户创建的角色                                           |

### 用户状态 (UserStatus)

| 值         | 说明                 |
| ---------- | -------------------- |
| `ACTIVE`   | 正常状态，可登录使用 |
| `DISABLED` | 已禁用，无法登录     |
| `PENDING`  | 待激活，需要验证     |

### 身份提供者 (IdentityProvider)

| 值             | 说明                           |
| -------------- | ------------------------------ |
| `EMAIL`        | 邮箱密码登录                   |
| `PHONE`        | 手机验证码登录                 |
| `WECHAT_OPEN`  | 微信开放平台（扫码登录）       |
| `WECHAT_MP`    | 微信公众号（H5 授权登录）      |
| `WECHAT_MINI`  | 微信小程序登录                 |
| `WECHAT_UNION` | 微信 UnionID（跨平台统一标识） |

---

## 配置中心

| 术语     | 英文            | 说明                                          |
| -------- | --------------- | --------------------------------------------- |
| 配置中心 | Config Center   | 动态配置管理系统，支持版本控制和回滚          |
| 命名空间 | ConfigNamespace | 配置分组，如 `app`、`payment`、`notification` |
| 配置项   | ConfigItem      | 具体的配置键值对                              |
| 配置历史 | ConfigHistory   | 配置变更记录，用于审计和回滚                  |

### 配置值类型 (ConfigValueType)

| 值        | 说明            |
| --------- | --------------- |
| `JSON`    | JSON 对象或数组 |
| `STRING`  | 字符串          |
| `NUMBER`  | 数字            |
| `BOOLEAN` | 布尔值          |

### 配置变更类型 (ConfigChangeType)

| 值         | 说明           |
| ---------- | -------------- |
| `CREATE`   | 新建配置       |
| `UPDATE`   | 更新配置       |
| `DELETE`   | 删除配置       |
| `ROLLBACK` | 回滚到历史版本 |

---

## 字典管理

| 术语     | 英文       | 说明                                |
| -------- | ---------- | ----------------------------------- |
| 字典     | Dictionary | 下拉选项、枚举值的统一管理          |
| 字典类型 | type       | 字典分类，如 `gender`、`status`     |
| 字典键   | key        | 具体选项的标识，如 `male`、`female` |
| 字典值   | value      | 存储的实际值（JSON 格式）           |
| 字典标签 | label      | 显示给用户的文本                    |

---

## 审计与安全

| 术语     | 英文            | 说明                         |
| -------- | --------------- | ---------------------------- |
| 审计日志 | AuditLog        | 记录所有写操作的日志         |
| 软删除   | Soft Delete     | 标记删除而非物理删除，可恢复 |
| 硬删除   | Hard Delete     | 物理删除，不可恢复           |
| 幂等性   | Idempotency     | 相同请求多次执行结果一致     |
| 幂等键   | Idempotency-Key | 客户端生成的唯一请求标识     |

---

## 认证相关

| 术语          | 英文     | 说明                           |
| ------------- | -------- | ------------------------------ |
| Access Token  | -        | 短期访问令牌，默认 15 分钟     |
| Refresh Token | -        | 长期刷新令牌，默认 7 天        |
| 设备 ID       | deviceId | 客户端设备标识，用于多设备管理 |

---

## 数据模型关系图

```
User (用户)
 │
 ├── UserIdentity[] (登录方式)
 │    └── provider: EMAIL | PHONE | WECHAT_*
 │
 ├── UserRole[] (角色分配)
 │    ├── Role (角色)
 │    │    └── RolePermission[] (权限分配)
 │    │         └── Permission (权限)
 │    ├── grantedBy: User (授权人)
 │    └── expiresAt: DateTime? (过期时间)
 │
 └── AuditLog[] (操作审计)
      └── 记录该用户的所有写操作

ConfigNamespace (配置命名空间)
 └── ConfigItem[] (配置项)
      └── ConfigHistory[] (变更历史)

Dictionary (字典)
 └── 按 type 分组的键值对
```

---

## 技术术语速查

| 术语           | 说明                                   |
| -------------- | -------------------------------------- |
| DTO            | Data Transfer Object，数据传输对象     |
| Zod            | TypeScript 优先的 Schema 验证库        |
| Prisma         | Node.js ORM，用于数据库访问            |
| TanStack Query | 前端服务端状态管理库（原 React Query） |
| Orval          | 从 OpenAPI/Swagger 生成 API 客户端代码 |
| Zustand        | 轻量级 React 状态管理库                |
