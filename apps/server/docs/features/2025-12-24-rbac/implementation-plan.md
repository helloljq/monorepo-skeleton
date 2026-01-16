# RBAC 实现方案

> 创建日期: 2025-12-24
> 状态: 设计中

## 一、模块架构

### 1.1 新增模块

```
src/modules/
├── auth/                    # 现有认证模块 (需改造)
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   ├── local.strategy.ts        # 新增: 邮箱/手机号+密码
│   │   └── wechat.strategy.ts       # 新增: 微信登录
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts           # 新增: 角色检查
│   │   └── permissions.guard.ts     # 新增: 权限检查
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   ├── roles.decorator.ts       # 新增: @RequireRoles()
│   │   ├── permissions.decorator.ts # 新增: @RequirePermissions()
│   │   └── current-user.decorator.ts
│   └── ...
│
├── identity/                # 新增: 身份管理模块
│   ├── identity.module.ts
│   ├── identity.service.ts
│   ├── identity.controller.ts
│   └── dto/
│       ├── bind-email.dto.ts
│       ├── bind-phone.dto.ts
│       └── bind-wechat.dto.ts
│
├── role/                    # 新增: 角色管理模块
│   ├── role.module.ts
│   ├── role.service.ts
│   ├── role.controller.ts
│   └── dto/
│
├── permission/              # 新增: 权限管理模块
│   ├── permission.module.ts
│   ├── permission.service.ts
│   ├── permission.controller.ts
│   └── dto/
│
└── wechat/                  # 新增: 微信集成模块
    ├── wechat.module.ts
    ├── wechat.service.ts
    ├── wechat.controller.ts
    └── dto/
```

### 1.2 公共模块扩展

```
src/common/
├── decorators/
│   └── require-auth.decorator.ts    # 组合装饰器
└── cache/
    └── permission-cache.service.ts  # 权限缓存服务
```

## 二、JWT Payload 改造

### 2.1 新 Payload 结构

```typescript
interface JwtPayload {
  sub: number; // userId
  roles: string[]; // 角色代码列表 ['ADMIN', 'USER']
  iat: number; // 签发时间
  exp: number; // 过期时间
}
```

**设计决策**:

- ✅ 包含 `roles`: 减少权限验证时的数据库查询
- ❌ 不包含 `permissions`: 权限数量可能很大，放在 Token 中会导致 Header 过大
- ❌ 不包含 `email`: 登录方式多样，email 可能不存在

### 2.2 Request User 对象

```typescript
interface RequestUser {
  userId: number;
  roles: string[];
  permissions?: string[]; // 按需加载，缓存在请求上下文
}
```

## 三、权限控制实现

### 3.1 装饰器设计

```typescript
// === 角色装饰器 ===
// 要求用户拥有任一指定角色
@RequireRoles('ADMIN', 'SUPER_ADMIN')

// === 权限装饰器 ===
// 要求用户拥有所有指定权限
@RequirePermissions('user:read', 'user:update')

// === 权限装饰器 (任一) ===
@RequireAnyPermission('user:delete', 'user:delete:self')

// === 组合装饰器 ===
@RequireAuth({
  roles: ['ADMIN'],
  permissions: ['user:manage'],
  mode: 'AND'  // 或 'OR'
})
```

### 3.2 Guard 实现

**执行顺序**:

```
Request → JwtAuthGuard → RolesGuard → PermissionsGuard → Handler
```

**RolesGuard 伪代码**:

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest().user;

    // 超级管理员跳过检查
    if (user.roles.includes("SUPER_ADMIN")) return true;

    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
```

**PermissionsGuard 伪代码**:

```typescript
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionCache: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 超级管理员跳过检查
    if (user.roles.includes("SUPER_ADMIN")) return true;

    // 获取用户权限 (基于角色缓存)
    const userPermissions = await this.permissionCache.getUserPermissions(
      user.roles,
    );

    // 缓存到请求上下文，避免重复查询
    request.user.permissions = userPermissions;

    // 检查是否拥有所有必需权限
    return requiredPermissions.every((p) => userPermissions.includes(p));
  }
}
```

### 3.3 权限缓存策略

**设计决策**: 采用「按角色缓存权限」而非「按用户缓存权限」，避免角色变更时需遍历大量用户。

**缓存结构** (Redis):

```
Key: permission:role:{roleCode}
Value: ["user:read", "user:update", "order:create", ...]
TTL: 10 分钟
```

**缓存失效时机**:

- 角色权限变更时 → 仅失效该角色缓存
- 用户角色变更时 → 无需失效缓存 (下次请求自动合并新角色权限)
- 手动调用刷新接口时

**缓存服务**:

```typescript
@Injectable()
export class PermissionCacheService {
  private readonly CACHE_PREFIX = "permission:role:";
  private readonly CACHE_TTL = 600; // 10 分钟

  /**
   * 获取用户权限 (合并所有角色的权限)
   */
  async getUserPermissions(roles: string[]): Promise<string[]> {
    if (!roles.length) return [];

    // 1. 批量获取各角色权限
    const permissionSets = await Promise.all(
      roles.map((role) => this.getRolePermissions(role)),
    );

    // 2. 合并去重
    const merged = new Set<string>();
    for (const perms of permissionSets) {
      perms.forEach((p) => merged.add(p));
    }

    return Array.from(merged);
  }

  /**
   * 获取单个角色的权限 (带缓存)
   */
  async getRolePermissions(roleCode: string): Promise<string[]> {
    const cacheKey = `${this.CACHE_PREFIX}${roleCode}`;

    // 1. 尝试从缓存获取
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. 从数据库加载
    const permissions = await this.loadRolePermissionsFromDb(roleCode);

    // 3. 写入缓存
    await this.redis.setex(
      cacheKey,
      this.CACHE_TTL,
      JSON.stringify(permissions),
    );

    return permissions;
  }

  /**
   * 角色权限变更时调用
   */
  async invalidateRoleCache(roleCode: string): Promise<void> {
    await this.redis.del(`${this.CACHE_PREFIX}${roleCode}`);
  }
}
```

## 四、多登录方式实现

### 4.1 登录流程统一抽象

```typescript
interface LoginResult {
  user: User;
  isNewUser: boolean;
  identity: UserIdentity;
}

interface AuthProvider {
  validate(credentials: any): Promise<LoginResult>;
}
```

### 4.2 邮箱登录

**API 设计**:

```
POST /v1/auth/login/email
Body: { email, password, deviceId }
```

**流程**:

```
1. 查询 UserIdentity: provider=EMAIL, providerId=email
2. 验证 credential (bcrypt compare)
3. 获取关联 User，检查 status
4. 加载用户角色
5. 生成 JWT Token (含 roles)
6. 存储 RefreshToken 到 Redis
7. 返回 Token
```

### 4.3 手机号登录

**API 设计**:

```
// 发送验证码
POST /v1/auth/sms/send
Body: { phone }

// 验证登录
POST /v1/auth/login/phone
Body: { phone, code, deviceId }
```

**流程**:

```
发送验证码:
1. 频率限制检查 (1分钟/次，10次/小时)
2. 生成 6 位随机验证码
3. 存储 Redis: sms:code:{phone} = code, TTL=5min
4. 调用短信服务发送

验证登录:
1. 查询 Redis: sms:code:{phone}
2. 校验验证码
3. 查询 UserIdentity: provider=PHONE, providerId=phone
   - 不存在 → 自动注册 (创建 User + Identity)
   - 存在 → 获取 User
4. 删除 Redis 验证码
5. 生成 JWT Token
6. 返回 Token
```

**短信服务抽象**:

```typescript
interface SmsService {
  send(phone: string, code: string): Promise<void>;
}

// 可对接阿里云、腾讯云等
```

### 4.4 微信扫码登录 (PC)

**API 设计**:

```
// 获取二维码参数
GET /v1/auth/wechat/qrcode
Response: { appId, redirectUri, state }

// 微信回调
GET /v1/auth/wechat/callback?code=xxx&state=xxx

// 前端轮询状态
GET /v1/auth/wechat/status?state=xxx
Response: { status: 'pending' | 'success', tokens?: {...} }
```

**流程**:

```
1. 前端请求二维码参数
2. 后端生成 state，存储 Redis: wechat:state:{state} = {status:'pending'}, TTL=5min
3. 前端使用微信开放平台 JS 生成二维码
4. 用户扫码授权
5. 微信回调后端
6. 后端用 code 换取 access_token + openid + unionid
7. 查询/创建 User 和 UserIdentity
8. 生成 JWT Token
9. 更新 Redis: wechat:state:{state} = {status:'success', tokens:{...}}
10. 前端轮询获取结果
```

### 4.5 微信网页登录 (H5)

**API 设计**:

```
// 构造授权 URL
GET /v1/auth/wechat/h5/authorize?redirectUri=xxx
Response: { authorizeUrl }

// 处理授权回调
POST /v1/auth/wechat/h5/callback
Body: { code, deviceId }
```

**流程**:

```
1. 前端调用 authorize 获取授权 URL
2. 前端跳转到微信授权页
3. 用户授权后微信回调前端页面 (带 code)
4. 前端将 code 发送到后端 callback 接口
5. 后端用 code 换取 access_token + openid + unionid
6. 查询/创建 User 和 UserIdentity
7. 返回 JWT Token
```

### 4.6 微信小程序登录

**API 设计**:

```
POST /v1/auth/wechat/miniapp/login
Body: { code, encryptedData?, iv?, deviceId }
```

**流程**:

```
1. 小程序前端调用 wx.login() 获取 code
2. 前端发送 code 到后端
3. 后端调用微信 code2Session 接口
4. 获取 session_key + openid + unionid
5. (可选) 解密 encryptedData 获取用户信息
6. 查询/创建 User 和 UserIdentity
7. 返回 JWT Token
```

## 五、API 设计

### 5.1 认证相关 (Auth)

| 方法 | 路径                         | 说明           | 权限   |
| ---- | ---------------------------- | -------------- | ------ |
| POST | `/auth/login/email`          | 邮箱登录       | Public |
| POST | `/auth/login/phone`          | 手机号登录     | Public |
| POST | `/auth/sms/send`             | 发送短信验证码 | Public |
| POST | `/auth/wechat/miniapp/login` | 小程序登录     | Public |
| GET  | `/auth/wechat/qrcode`        | 获取扫码参数   | Public |
| GET  | `/auth/wechat/callback`      | 微信扫码回调   | Public |
| GET  | `/auth/wechat/status`        | 轮询扫码状态   | Public |
| GET  | `/auth/wechat/h5/authorize`  | H5 授权 URL    | Public |
| POST | `/auth/wechat/h5/callback`   | H5 授权回调    | Public |
| POST | `/auth/refresh`              | 刷新 Token     | Public |
| POST | `/auth/logout`               | 登出           | Auth   |

### 5.2 身份管理 (Identity)

| 方法   | 路径                     | 说明                 | 权限 |
| ------ | ------------------------ | -------------------- | ---- |
| GET    | `/identity/list`         | 获取当前用户身份列表 | Auth |
| POST   | `/identity/bind/email`   | 绑定邮箱             | Auth |
| POST   | `/identity/bind/phone`   | 绑定手机号           | Auth |
| POST   | `/identity/bind/wechat`  | 绑定微信             | Auth |
| DELETE | `/identity/:id`          | 解绑身份             | Auth |
| POST   | `/identity/email/verify` | 发送邮箱验证         | Auth |
| POST   | `/identity/phone/verify` | 发送手机验证         | Auth |

### 5.3 用户管理 (User)

| 方法   | 路径                       | 说明         | 权限               |
| ------ | -------------------------- | ------------ | ------------------ |
| GET    | `/users`                   | 用户列表     | `user:read`        |
| GET    | `/users/:id`               | 用户详情     | `user:read`        |
| GET    | `/users/me`                | 当前用户信息 | Auth               |
| PATCH  | `/users/me`                | 更新当前用户 | Auth               |
| PATCH  | `/users/:id`               | 更新用户     | `user:update`      |
| DELETE | `/users/:id`               | 删除用户     | `user:delete`      |
| POST   | `/users/:id/roles`         | 分配角色     | `user:assign-role` |
| DELETE | `/users/:id/roles/:roleId` | 移除角色     | `user:assign-role` |

### 5.4 角色管理 (Role)

| 方法   | 路径                                   | 说明         | 权限                     |
| ------ | -------------------------------------- | ------------ | ------------------------ |
| GET    | `/roles`                               | 角色列表     | `role:read`              |
| GET    | `/roles/:id`                           | 角色详情     | `role:read`              |
| POST   | `/roles`                               | 创建角色     | `role:create`            |
| PATCH  | `/roles/:id`                           | 更新角色     | `role:update`            |
| DELETE | `/roles/:id`                           | 删除角色     | `role:delete`            |
| GET    | `/roles/:id/permissions`               | 获取角色权限 | `role:read`              |
| POST   | `/roles/:id/permissions`               | 分配权限     | `role:assign-permission` |
| DELETE | `/roles/:id/permissions/:permissionId` | 移除权限     | `role:assign-permission` |

### 5.5 权限管理 (Permission)

| 方法   | 路径                   | 说明             | 权限                |
| ------ | ---------------------- | ---------------- | ------------------- |
| GET    | `/permissions`         | 权限列表         | `permission:read`   |
| GET    | `/permissions/:id`     | 权限详情         | `permission:read`   |
| POST   | `/permissions`         | 创建权限         | `permission:create` |
| PATCH  | `/permissions/:id`     | 更新权限         | `permission:update` |
| DELETE | `/permissions/:id`     | 删除权限         | `permission:delete` |
| GET    | `/permissions/modules` | 获取权限模块分组 | `permission:read`   |

## 六、错误码设计

在 `error-codes.ts` 中新增:

```typescript
// === Auth 域扩展 (11000-11999) ===
AUTH_PHONE_CODE_EXPIRED: 11010,        // 短信验证码已过期
AUTH_PHONE_CODE_INVALID: 11011,        // 短信验证码错误
AUTH_PHONE_RATE_LIMITED: 11012,        // 短信发送频率限制
AUTH_WECHAT_CODE_INVALID: 11020,       // 微信授权码无效
AUTH_WECHAT_STATE_EXPIRED: 11021,      // 微信扫码状态过期
AUTH_IDENTITY_ALREADY_BOUND: 11030,    // 该身份已绑定其他账号
AUTH_IDENTITY_NOT_FOUND: 11031,        // 身份不存在
AUTH_IDENTITY_LAST_ONE: 11032,         // 不能解绑最后一个身份
AUTH_USER_DISABLED: 11006,             // 账号已禁用 (已预留)

// === Permission 域 (12000-12999) ===
PERMISSION_DENIED: 12001,              // 权限不足
ROLE_NOT_FOUND: 12002,                 // 角色不存在
ROLE_SYSTEM_IMMUTABLE: 12003,          // 系统角色不可修改
PERMISSION_NOT_FOUND: 12004,           // 权限不存在
ROLE_ALREADY_ASSIGNED: 12005,          // 角色已分配
PERMISSION_ALREADY_ASSIGNED: 12006,    // 权限已分配
```

## 七、环境变量

新增配置项 (`env.schema.ts`):

```typescript
// === 短信服务 ===
SMS_PROVIDER: z.enum(['aliyun', 'tencent']).default('aliyun'),
SMS_ACCESS_KEY: z.string().optional(),
SMS_ACCESS_SECRET: z.string().optional(),
SMS_SIGN_NAME: z.string().optional(),
SMS_TEMPLATE_CODE: z.string().optional(),

// === 微信开放平台 ===
WECHAT_OPEN_APP_ID: z.string().optional(),
WECHAT_OPEN_APP_SECRET: z.string().optional(),

// === 微信公众号 ===
WECHAT_MP_APP_ID: z.string().optional(),
WECHAT_MP_APP_SECRET: z.string().optional(),

// === 微信小程序 ===
WECHAT_MINI_APP_ID: z.string().optional(),
WECHAT_MINI_APP_SECRET: z.string().optional(),

// === 微信 State 签名密钥 ===
WECHAT_STATE_SECRET: z.string().optional(),  // 用于 HMAC 签名

// === 权限缓存 ===
PERMISSION_CACHE_TTL: z.coerce.number().default(600),  // 秒
```

**模块初始化校验** (WechatModule):

```typescript
@Module({...})
export class WechatModule implements OnModuleInit {
  constructor(private config: AppConfigService) {}

  onModuleInit() {
    const { wechat } = this.config;

    // 根据启用的登录方式校验必需配置
    if (wechat.openEnabled) {
      if (!wechat.openAppId || !wechat.openAppSecret) {
        throw new Error('微信开放平台登录已启用，但缺少 WECHAT_OPEN_APP_ID/SECRET');
      }
    }

    if (wechat.mpEnabled) {
      if (!wechat.mpAppId || !wechat.mpAppSecret) {
        throw new Error('微信公众号登录已启用，但缺少 WECHAT_MP_APP_ID/SECRET');
      }
    }

    if (wechat.miniEnabled) {
      if (!wechat.miniAppId || !wechat.miniAppSecret) {
        throw new Error('微信小程序登录已启用，但缺少 WECHAT_MINI_APP_ID/SECRET');
      }
    }

    // State 签名密钥校验
    if (!wechat.stateSecret) {
      throw new Error('缺少 WECHAT_STATE_SECRET，用于防止 CSRF 攻击');
    }
  }
}
```

## 八、安全考虑

### 8.1 登录安全

- **密码强度**: 延续现有要求 (8+字符，大小写+数字)
- **登录失败锁定**: 5 次失败锁定 15 分钟
- **验证码防刷**: 图形验证码 (可选)
- **短信防刷**: 1次/分钟，10次/小时

### 8.2 Token 安全

- **Access Token**: 短有效期 (15分钟)
- **Refresh Token**: 安全存储 (Hash 后存 Redis)
- **设备绑定**: deviceId 关联 Token
- **异地登录通知**: 检测 IP 变化 (可选)

### 8.3 微信登录安全

- **State 签名校验**: 防止 CSRF 和伪造
- **UnionID 优先**: 统一身份识别
- **敏感数据加密**: 小程序 encryptedData 解密

**State 签名机制**:

```typescript
// 生成 state (带 HMAC 签名)
function generateState(): string {
  const payload = {
    nonce: crypto.randomUUID(),
    ts: Date.now(),
  };
  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", WECHAT_STATE_SECRET)
    .update(data)
    .digest("hex")
    .slice(0, 16); // 取前 16 位

  // state = base64(payload) + '.' + signature
  return Buffer.from(data).toString("base64url") + "." + signature;
}

// 验证 state
function verifyState(state: string): boolean {
  const [payloadB64, signature] = state.split(".");
  if (!payloadB64 || !signature) return false;

  // 1. 验证签名
  const data = Buffer.from(payloadB64, "base64url").toString();
  const expectedSig = crypto
    .createHmac("sha256", WECHAT_STATE_SECRET)
    .update(data)
    .digest("hex")
    .slice(0, 16);

  if (signature !== expectedSig) return false;

  // 2. 验证时效 (5 分钟)
  const payload = JSON.parse(data);
  if (Date.now() - payload.ts > 5 * 60 * 1000) return false;

  // 3. 验证 Redis 中存在 (防重放)
  return redis.exists(`wechat:state:${state}`);
}
```

**双重保护**:

1. **HMAC 签名**: 防止伪造 state
2. **Redis 存储**: 防止重放攻击，确保一次性使用

### 8.4 权限安全

- **最小权限原则**: 默认无权限
- **权限变更审计**: 记录所有权限变更
- **缓存一致性**: 权限变更及时失效

## 九、实现步骤

### Phase 1: 基础设施 (P0)

```
1.1 数据库变更
├── 创建 Prisma migration
├── 执行数据迁移脚本
└── 更新 PrismaService 软删除配置

1.2 权限控制基础
├── 实现 @RequireRoles() 装饰器
├── 实现 @RequirePermissions() 装饰器
├── 实现 RolesGuard
├── 实现 PermissionsGuard
└── 实现 PermissionCacheService

1.3 JWT 改造
├── 更新 JwtPayload 结构
├── 更新 JwtStrategy
└── 更新 AuthService.generateTokens()
```

### Phase 2: 身份体系 (P0)

```
2.1 改造邮箱登录
├── 创建 IdentityService
├── 改造 AuthService.login() 使用 UserIdentity
└── 保持 API 兼容

2.2 新增手机登录
├── 实现 SmsService (可选真实短信或测试模式)
├── 实现 /auth/sms/send
└── 实现 /auth/login/phone
```

### Phase 3: 角色权限管理 (P0)

```
3.1 Role 模块
├── 实现 RoleService CRUD
├── 实现 RoleController
└── 初始化预置角色

3.2 Permission 模块
├── 实现 PermissionService CRUD
├── 实现 PermissionController
└── 初始化预置权限

3.3 关联管理
├── 用户-角色分配 API
└── 角色-权限分配 API
```

### Phase 4: 微信登录 (P1)

```
4.1 微信基础服务
├── 实现 WechatService
├── 封装微信 API 调用
└── 实现 Token 换取逻辑

4.2 各登录方式
├── 小程序登录
├── 扫码登录
└── H5 网页登录
```

### Phase 5: 身份管理 (P1)

```
5.1 Identity 模块
├── 实现 IdentityService
├── 实现 IdentityController
└── 实现绑定/解绑逻辑

5.2 账号安全
├── 绑定前验证
└── 防重复绑定检查
```

## 十、测试计划

### 10.1 单元测试

- [ ] PermissionCacheService 缓存逻辑
- [ ] RolesGuard 角色检查
- [ ] PermissionsGuard 权限检查
- [ ] IdentityService 身份管理
- [ ] AuthService 各登录方式

### 10.2 集成测试

- [ ] 完整登录流程 (各方式)
- [ ] 权限控制 (有权限/无权限)
- [ ] 角色分配与生效
- [ ] 缓存失效

### 10.3 E2E 测试

- [ ] 邮箱注册登录流程
- [ ] 手机号登录流程 (Mock 短信)
- [ ] 微信登录流程 (Mock 微信 API)
- [ ] 权限不足返回 403
- [ ] Token 刷新流程

## 附录

### A. 预置角色权限矩阵

| 权限          | SUPER_ADMIN | ADMIN | USER | GUEST |
| ------------- | ----------- | ----- | ---- | ----- |
| user:read     | \*          | ✓     | self | -     |
| user:create   | \*          | ✓     | -    | -     |
| user:update   | \*          | ✓     | self | -     |
| user:delete   | \*          | ✓     | -    | -     |
| role:\*       | \*          | ✓     | -    | -     |
| permission:\* | \*          | -     | -    | -     |

`*` = 超级管理员拥有所有权限，不受检查约束
`self` = 仅对自己的数据有权限

### B. 微信配置获取

1. **开放平台 (扫码登录)**: https://open.weixin.qq.com/
   - 创建网站应用
   - 获取 AppID + AppSecret

2. **公众号 (H5 登录)**: https://mp.weixin.qq.com/
   - 服务号 (已认证)
   - 网页授权域名配置

3. **小程序**: https://mp.weixin.qq.com/
   - 获取 AppID + AppSecret
   - 配置服务器域名
