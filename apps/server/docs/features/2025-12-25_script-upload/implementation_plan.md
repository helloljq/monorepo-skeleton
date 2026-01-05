# 实现方案

> 创建日期: 2025-12-25

## 技术方案概述

### 1. 公开配置读取（配置中心扩展）

在现有 ConfigItem 模型上添加 `isPublic` 字段，创建匿名访问接口。

**接口设计**：`GET /api/v1/config/public/:namespace/:key`

- 使用 `@Public()` 装饰器跳过 JWT 认证
- 查询时要求 `isPublic=true` 且 `isEnabled=true`
- 需要指定 namespace 以避免 key 冲突

### 2. 脚本数据上传下载（新模块）

创建独立的 `script-upload` 模块，使用环境变量配置的 Token 进行认证。

**认证方式**：
- 请求头：`X-Script-Token`
- 环境变量：`SCRIPT_UPLOAD_TOKEN`（至少 32 位）
- 未配置时返回 503，token 不匹配返回 401

**审计上下文说明**：

使用 `runWithAuditContext` 而非 `runWithSystemAuditContext`，原因：
- `runWithSystemAuditContext` 会将 IP/UA 设为 "system"
- 脚本上传场景需要保留真实的客户端 IP 和 User-Agent 用于安全审计
- 因此手动构建审计上下文，`actorUserId` 为 undefined，但保留真实网络信息

---

## 实现步骤

### Part 1: 公开配置读取

#### Step 1: 数据库迁移

```prisma
model ConfigItem {
  // ... 现有字段
  isPublic    Boolean   @default(false)
}
```

#### Step 2: 更新 DTO

在 `create-config-item.dto.ts` 和 `update-config-item.dto.ts` 中添加：

```typescript
isPublic: z.boolean().default(false).optional(),
```

#### Step 3: 添加公开配置接口

```typescript
@Get('public/:namespace/:key')
@Public()
@ApiOperation({ summary: '获取公开配置项（匿名访问）' })
async getPublicConfig(
  @Param('namespace') namespace: string,
  @Param('key') key: string,
) {
  return this.configItemService.findPublicByKey(namespace, key);
}
```

#### Step 4: Service 方法

```typescript
async findPublicByKey(namespace: string, key: string) {
  const ns = await this.namespaceService.findByName(namespace);
  const config = await this.prisma.configItem.findFirst({
    where: {
      namespaceId: ns.id,
      key,
      isPublic: true,
      isEnabled: true,
      deletedAt: null,
    },
  });
  if (!config) throw new BusinessException(CONFIG_NOT_FOUND);
  return this.decryptIfNeeded(config);
}
```

### Part 2: 脚本数据模块

#### Step 5: 环境变量配置

```typescript
// env.schema.ts
SCRIPT_UPLOAD_TOKEN: z.string().min(32).optional(),

// app-config.service.ts
get scriptUploadToken(): string | undefined {
  return this.configService.get('SCRIPT_UPLOAD_TOKEN');
}
```

#### Step 6: 错误码定义

```typescript
// 15000-15999: Script Upload 域
SCRIPT_FEATURE_DISABLED: 15001,
SCRIPT_TOKEN_MISSING: 15002,
SCRIPT_TOKEN_INVALID: 15003,
```

#### Step 7: Script Token Guard

- 从 `X-Script-Token` 请求头读取 token
- 与 `AppConfigService.scriptUploadToken` 比对
- 未配置时返回 503（SCRIPT_FEATURE_DISABLED）
- 未提供 token 返回 401（SCRIPT_TOKEN_MISSING）
- token 不匹配返回 401（SCRIPT_TOKEN_INVALID）

#### Step 8: DTO 定义

```typescript
// upload-script-data.dto.ts
export const UploadScriptDataSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/),
  value: ConfigValueSchema,
  description: z.string().max(500).optional(),
});

// query-script-list.dto.ts
export const QueryScriptListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

#### Step 9: Service 实现

- 硬编码命名空间为 `script-data`
- 自动创建命名空间（使用乐观锁策略：捕获 P2002 唯一约束冲突，表示已被其他请求创建）
- 使用 `runWithAuditContext` 包装操作（保留真实 IP/UA）

#### Step 10: Controller

```typescript
// 注意：全局前缀 'api/v1' 已在 main.ts 中配置，Controller 路径不需要重复
@ApiTags('Script Data')
@Controller('script')
@Public()
@UseGuards(ScriptTokenGuard)
export class ScriptUploadController {
  @Post('upload')
  async upload(@Body() dto, @Req() req) { ... }

  @Get('download/:key')
  async download(@Param('key') key) { ... }

  @Get('list')
  async list(@Query() query: QueryScriptListDto) { ... }
}
```

---

## 文件清单

### Part 1: 公开配置（配置中心扩展）

| 文件 | 操作 |
|------|------|
| `prisma/schema.prisma` | 修改：添加 `isPublic` 字段 |
| `src/modules/config-center/dto/create-config-item.dto.ts` | 修改 |
| `src/modules/config-center/dto/update-config-item.dto.ts` | 修改 |
| `src/modules/config-center/controllers/config-item.controller.ts` | 修改：添加公开接口 |
| `src/modules/config-center/services/config-item.service.ts` | 修改：添加 findPublicByKey |

### Part 2: 脚本数据模块（新模块）

| 文件 | 操作 |
|------|------|
| `src/config/env.schema.ts` | 修改 |
| `src/config/app-config.service.ts` | 修改 |
| `src/common/errors/error-codes.ts` | 修改：添加错误码 |
| `src/modules/script-upload/script-upload.module.ts` | 新建 |
| `src/modules/script-upload/script-upload.controller.ts` | 新建 |
| `src/modules/script-upload/script-upload.service.ts` | 新建 |
| `src/modules/script-upload/dto/*.ts` | 新建 |
| `src/modules/script-upload/guards/script-token.guard.ts` | 新建 |
| `src/modules/script-upload/__tests__/*.spec.ts` | 新建 |
| `src/app.module.ts` | 修改：导入新模块 |

---

## API 示例

### 公开配置接口

```bash
GET /api/v1/config/public/app-settings/home_modules
# 无需认证
```

### 脚本数据接口

```bash
# 上传
POST /api/v1/script/upload
X-Script-Token: your-32-char-token
Content-Type: application/json

{"key": "xhs_cookies_account_a", "value": {...}}

# 下载
GET /api/v1/script/download/xhs_cookies_account_a
X-Script-Token: your-32-char-token

# 列表
GET /api/v1/script/list?page=1&limit=10
X-Script-Token: your-32-char-token
```
