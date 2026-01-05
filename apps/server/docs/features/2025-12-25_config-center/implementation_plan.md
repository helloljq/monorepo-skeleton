# 配置中心实现方案

> 创建日期: 2025-12-25
> 版本: v1.0

## 一、数据模型设计

### 1.1 Prisma Schema

```prisma
// ==================== 配置命名空间 ====================
model ConfigNamespace {
  id          Int      @id @default(autoincrement())

  // === 基础信息 ===
  name        String   @unique @db.VarChar(50)  // 如: mini_program, marketing, third_party
  displayName String   @db.VarChar(100)         // 显示名称
  description String?  @db.VarChar(500)

  // === 状态 ===
  isEnabled   Boolean  @default(true)

  // === 软删除 ===
  deletedAt    DateTime?
  deletedById  Int?
  deleteReason String?  @db.VarChar(500)

  // === 时间戳 ===
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // === 关联 ===
  configs     ConfigItem[]
  deletedBy   User?    @relation("ConfigNamespaceDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)

  @@index([isEnabled])
}

// ==================== 配置项 ====================
model ConfigItem {
  id          Int      @id @default(autoincrement())

  // === 归属 ===
  namespaceId Int
  namespace   ConfigNamespace @relation(fields: [namespaceId], references: [id], onDelete: Restrict)

  // === 配置键值 ===
  key         String   @db.VarChar(100)         // 如: home_banners, xhs_cookies
  value       Json                              // 配置值（任意 JSON）
  valueType   ConfigValueType @default(JSON)    // 值类型提示

  // === 元信息 ===
  description String?  @db.VarChar(500)         // 配置说明
  isEncrypted Boolean  @default(false)          // 是否加密存储

  // === JSON Schema 校验 ===
  jsonSchema  Json?                             // 可选的 JSON Schema 定义

  // === 版本控制 ===
  version     Int      @default(1)              // 当前版本号
  configHash  String   @db.VarChar(64)          // value 的 MD5 hash

  // === 状态 ===
  isEnabled   Boolean  @default(true)

  // === 软删除 ===
  deletedAt    DateTime?
  deletedById  Int?
  deleteReason String?  @db.VarChar(500)

  // === 时间戳 ===
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // === 关联 ===
  histories   ConfigHistory[]
  deletedBy   User?    @relation("ConfigItemDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)

  // === 约束 ===
  @@unique([namespaceId, key])                  // 同命名空间下 key 唯一
  @@index([namespaceId])
  @@index([namespaceId, isEnabled])
}

// ==================== 配置变更历史 ====================
model ConfigHistory {
  id          Int      @id @default(autoincrement())

  // === 归属 ===
  configId    Int
  config      ConfigItem @relation(fields: [configId], references: [id])

  // === 版本信息 ===
  version     Int                               // 版本号
  value       Json                              // 当时的值
  configHash  String   @db.VarChar(64)

  // === 变更信息 ===
  changeType  ConfigChangeType                  // CREATE / UPDATE / ROLLBACK
  changeNote  String?  @db.VarChar(500)         // 变更说明
  changedById Int?
  changedBy   User?    @relation(fields: [changedById], references: [id], onDelete: SetNull)

  // === 时间戳 ===
  createdAt   DateTime @default(now())

  @@index([configId])
  @@index([configId, version])
}

// ==================== 枚举 ====================
enum ConfigValueType {
  JSON        // 默认，复杂对象
  STRING      // 简单字符串
  NUMBER      // 数字
  BOOLEAN     // 布尔值
}

enum ConfigChangeType {
  CREATE      // 创建
  UPDATE      // 更新
  ROLLBACK    // 回滚
}
```

### 1.2 设计说明

| 表 | 职责 |
|---|------|
| `ConfigNamespace` | 命名空间管理，按业务域隔离配置 |
| `ConfigItem` | 具体配置项，支持加密、版本控制、JSON Schema 校验 |
| `ConfigHistory` | 变更历史，支持回滚和审计 |

### 1.3 软删除集成

`ConfigNamespace` 和 `ConfigItem` 支持软删除，需要完成以下集成步骤：

**1. 更新 `SOFT_DELETE_MODELS` 集合** (`src/database/prisma/prisma.service.ts`):

```typescript
const SOFT_DELETE_MODELS = new Set<string>([
  'User', 'Role', 'Dictionary',
  'ConfigNamespace', 'ConfigItem',  // 新增
]);
```

**2. 更新 `SoftDeleteModelName` 类型** (如有单独定义)

**3. 运行检查脚本**:

```bash
pnpm soft-delete-check
```

**4. 使用规范**:
- 查询活跃数据: `this.prisma.soft.configItem.*`
- 查询含已删除: `this.prisma.raw.configItem.*`
- 软删除操作: 使用 `genericSoftDelete()` 方法

### 1.4 命名规范

| 字段 | 规范 | 示例 |
|------|------|------|
| `namespace.name` | 小写 + 下划线 | `mini_program`, `third_party` |
| `config.key` | 小写 + 下划线 | `home_banners`, `xhs_cookies` |

### 1.5 保留字校验

为避免与 API 路由冲突，需对 namespace 和 key 进行保留字校验：

**命名空间保留字**：

```typescript
const RESERVED_NAMESPACE_NAMES = ['namespaces', 'batch', 'health', 'metrics', 'config'];
```

**配置项 key 保留字**：

```typescript
const RESERVED_CONFIG_KEYS = ['batch', 'history', 'rollback', 'meta'];
```

在 DTO 中校验：

```typescript
// CreateNamespaceSchema
name: z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z][a-z0-9_]*$/)
  .refine(
    (val) => !RESERVED_NAMESPACE_NAMES.includes(val),
    { message: '命名空间名称不能使用保留字' }
  )
  .trim(),

// CreateConfigItemSchema
key: z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z][a-z0-9_]*$/)
  .refine(
    (val) => !RESERVED_CONFIG_KEYS.includes(val),
    { message: '配置项 key 不能使用保留字' }
  )
  .trim(),
```

### 1.6 删除策略

**命名空间删除**：
- 采用策略 A：**禁止删除有配置项的命名空间**
- 删除前检查是否存在活跃配置项，若存在则返回 `CONFIG_NAMESPACE_HAS_ITEMS (14002)`
- 用户需先删除或迁移所有配置项后，才能删除命名空间

**配置项删除**：
- **仅允许软删除**，禁止硬删除
- 软删除后，关联的 `ConfigHistory` 保留（用于审计追溯）
- 若需彻底清理，需通过数据库运维操作

### 1.7 ValueType 说明

`ConfigValueType` 枚举用于**类型提示**，帮助前端正确解析配置值：

| ValueType | 对应 JS 类型 | 说明 |
|-----------|-------------|------|
| `JSON` | object, array | 默认值，复杂结构统一归类为 JSON |
| `STRING` | string | 简单字符串 |
| `NUMBER` | number | 数字 |
| `BOOLEAN` | boolean | 布尔值 |

> **注意**：`array` 类型归类为 `JSON`，不单独设置枚举值。

### 1.8 configHash 计算规则

`configHash` 用于客户端缓存校验，计算规则如下：

```typescript
import { createHash } from 'crypto';

function calculateConfigHash(value: unknown): string {
  // 对原始值（加密前）进行 JSON 序列化后计算 MD5
  const jsonString = JSON.stringify(value);
  return createHash('md5').update(jsonString).digest('hex');
}
```

**规则说明**：
- 对 `JSON.stringify(value)` 的结果计算 MD5
- **加密配置**：对加密前的原始值计算（确保内容变化可检测）
- 存储时保存 hash，无需每次读取时重新计算

---

## 二、API 设计

### 2.1 命名空间管理

| 方法 | 路由 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/v1/config/namespaces` | 查询命名空间列表 | `config:read` |
| GET | `/api/v1/config/namespaces/:name` | 获取命名空间详情 | `config:read` |
| POST | `/api/v1/config/namespaces` | 创建命名空间 | `config:namespace:create` |
| PATCH | `/api/v1/config/namespaces/:name` | 更新命名空间 | `config:namespace:update` |
| DELETE | `/api/v1/config/namespaces/:name` | 删除命名空间（软删除） | `config:namespace:delete` |

> **设计说明**: 统一使用 `:name` 作为路由参数，与配置项 API 风格保持一致。`name` 字段已设置唯一约束。

### 2.2 配置项管理

| 方法 | 路由 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/v1/config/:namespace` | 获取命名空间下所有配置 | `config:read` |
| GET | `/api/v1/config/:namespace/:key` | 获取单个配置项 | `config:read` |
| GET | `/api/v1/config/:namespace/:key/meta` | 获取配置元数据（轻量） | `config:read` |
| POST | `/api/v1/config/:namespace` | 创建配置项 | `config:write` |
| PUT | `/api/v1/config/:namespace/:key` | 更新配置项 | `config:write` |
| DELETE | `/api/v1/config/:namespace/:key` | 删除配置项 | `config:delete` |

### 2.3 版本与历史

| 方法 | 路由 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/v1/config/:namespace/:key/history` | 获取配置变更历史 | `config:read` |
| POST | `/api/v1/config/:namespace/:key/rollback/:version` | 回滚到指定版本 | `config:rollback` |

### 2.4 批量操作

| 方法 | 路由 | 功能 | 权限 |
|------|------|------|------|
| GET | `/api/v1/config/:namespace/batch?keys=a,b,c` | 批量获取多个配置 | `config:read` |
| POST | `/api/v1/config/:namespace/batch` | 批量创建/更新配置 | `config:write` |

> **限制**：批量获取 `keys` 参数最多 50 个，超出返回 `BAD_REQUEST`。

### 2.5 Meta 接口返回结构

`GET /api/v1/config/:namespace/:key/meta` 返回轻量级元数据：

```typescript
interface ConfigMeta {
  key: string;
  version: number;
  configHash: string;
  isEncrypted: boolean;
  updatedAt: string;  // ISO 8601
}
```

**使用场景**：客户端本地缓存校验

```typescript
// 客户端缓存校验流程
async function getConfigWithCache(namespace: string, key: string) {
  const cached = localStorage.getItem(`config:${namespace}:${key}`);

  // 1. 获取 meta（~100B）
  const meta = await fetch(`/api/v1/config/${namespace}/${key}/meta`);

  // 2. 对比本地 hash
  if (cached && JSON.parse(cached).configHash === meta.configHash) {
    return JSON.parse(cached).value;  // 命中缓存，节省带宽
  }

  // 3. hash 不匹配，拉取完整配置（可能 10-50KB）
  const config = await fetch(`/api/v1/config/${namespace}/${key}`);
  localStorage.setItem(`config:${namespace}:${key}`, JSON.stringify(config));
  return config.value;
}
```

> **价值**：对于大型 JSON 配置，meta 接口可节省 99% 带宽。

---

## 三、JSON Schema 校验

### 3.1 设计思路

配置项可选择性地关联一个 JSON Schema，用于校验配置值的格式。当设置了 `jsonSchema` 时：

1. **创建/更新配置时**：自动校验 `value` 是否符合 Schema
2. **回滚时**：同样校验历史版本的值是否符合当前 Schema
3. **Schema 可以后续添加/修改**：更新 Schema 时会校验现有值是否兼容

### 3.2 Schema 存储格式

使用标准 JSON Schema Draft-07 格式：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "banners": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "integer" },
          "imageUrl": { "type": "string", "format": "uri" },
          "linkUrl": { "type": "string" },
          "sort": { "type": "integer", "minimum": 0 }
        },
        "required": ["id", "imageUrl", "linkUrl"]
      }
    },
    "autoPlayInterval": {
      "type": "integer",
      "minimum": 1000,
      "maximum": 10000
    }
  },
  "required": ["banners"]
}
```

### 3.3 DTO 设计

```typescript
// create-config-item.dto.ts

/**
 * 配置值类型校验
 * 支持: string, number, boolean, object, array
 * 禁止: undefined, null (明确拒绝)
 */
const ConfigValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.record(z.unknown()),
  z.array(z.unknown()),
]).refine(
  (val) => val !== undefined && val !== null,
  { message: 'value 不能为 undefined 或 null' }
);

export const CreateConfigItemSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, 'key 必须为小写字母+数字+下划线')
    .trim(),
  value: ConfigValueSchema,  // 类型安全的配置值
  valueType: z.nativeEnum(ConfigValueType).default(ConfigValueType.JSON),
  description: z.string().max(500).optional(),
  isEncrypted: z.boolean().default(false),
  isEnabled: z.boolean().default(true),

  // JSON Schema（可选）
  jsonSchema: z
    .object({
      $schema: z.string().optional(),
      type: z.string(),
    })
    .passthrough()  // 允许其他 JSON Schema 字段
    .optional(),
});

export class CreateConfigItemDto extends createZodDto(CreateConfigItemSchema) {}
```

### 3.4 校验服务实现

```typescript
// config-schema-validator.service.ts
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

@Injectable()
export class ConfigSchemaValidatorService {
  private readonly ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);  // 添加 format 支持（uri, email, date 等）
  }

  /**
   * 校验配置值是否符合 Schema
   * @throws BusinessException 校验失败时抛出
   */
  validate(value: unknown, schema: object): void {
    const validate = this.ajv.compile(schema);
    const valid = validate(value);

    if (!valid) {
      const errors = validate.errors?.map((e) => ({
        path: e.instancePath || '/',
        message: e.message,
        keyword: e.keyword,
      }));

      throw new BusinessException({
        code: ApiErrorCode.CONFIG_SCHEMA_VALIDATION_FAILED,
        message: '配置值不符合 Schema 定义',
        data: { errors },
      });
    }
  }

  /**
   * 校验 Schema 本身是否有效
   */
  validateSchema(schema: object): boolean {
    try {
      this.ajv.compile(schema);
      return true;
    } catch {
      return false;
    }
  }
}
```

### 3.5 依赖安装

```bash
pnpm add ajv ajv-formats
# 注意: ajv v8+ 已自带 TypeScript 类型定义，无需安装 @types/ajv
```

### 3.6 校验时机

| 操作 | 校验行为 |
|------|---------|
| 创建配置（带 Schema） | 校验 value 是否符合 Schema |
| 更新配置值 | 若存在 Schema，校验新 value |
| 更新 Schema | 校验 Schema 语法有效性 + 现有 value 兼容性 |
| 回滚配置 | 若存在 Schema，校验历史 value |
| 删除 Schema | 允许（value 不再受约束） |

### 3.7 错误响应示例

```json
{
  "code": 14012,
  "message": "配置值不符合 Schema 定义",
  "data": {
    "errors": [
      {
        "path": "/banners/0",
        "message": "must have required property 'imageUrl'",
        "keyword": "required"
      },
      {
        "path": "/autoPlayInterval",
        "message": "must be >= 1000",
        "keyword": "minimum"
      }
    ]
  },
  "timestamp": 1735100000000
}
```

---

## 四、敏感配置加密

### 4.1 加密策略

| 项目 | 配置 |
|------|------|
| 算法 | AES-256-GCM |
| 密钥来源 | 环境变量 `CONFIG_ENCRYPTION_KEY` |
| 密钥长度 | 32 字节 (256 位) |
| IV | 每次加密随机生成 12 字节 |
| 存储格式 | `{iv}:{authTag}:{ciphertext}` (Base64) |

### 4.2 加密值存储说明

由于 `ConfigItem.value` 字段为 `Json` 类型，加密时需要处理类型兼容性：

1. **加密流程**: `JSON.stringify(value)` → 加密 → 存储加密字符串到 `value` 字段（作为 JSON string）
2. **解密流程**: 读取加密字符串 → 解密 → `JSON.parse()` 恢复原始值
3. **存储示例**: `{"encrypted": "base64iv:base64tag:base64cipher"}`

这样可以保持 `value` 字段类型一致，同时支持加密存储。

### 4.3 加密服务实现

```typescript
// config-encryption.service.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class ConfigEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer | null;

  constructor(private readonly configService: AppConfigService) {
    const keyHex = this.configService.get('CONFIG_ENCRYPTION_KEY');
    // 允许未配置密钥（开发环境），但使用时会抛出友好错误
    if (keyHex && keyHex.length === 64) {
      this.key = Buffer.from(keyHex, 'hex');
    } else {
      this.key = null;
    }
  }

  /**
   * 检查加密功能是否可用
   */
  isAvailable(): boolean {
    return this.key !== null;
  }

  /**
   * 确保密钥已配置，否则抛出业务异常
   */
  private ensureKeyAvailable(): void {
    if (!this.key) {
      throw new BusinessException({
        code: ApiErrorCode.CONFIG_ENCRYPTION_FAILED,
        message: '加密功能未配置，请设置 CONFIG_ENCRYPTION_KEY 环境变量',
      });
    }
  }

  encrypt(plaintext: string): string {
    this.ensureKeyAvailable();

    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key!, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // 格式: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  decrypt(encrypted: string): string {
    this.ensureKeyAvailable();

    const [ivB64, authTagB64, ciphertext] = encrypted.split(':');

    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = createDecipheriv(this.algorithm, this.key!, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

在 `ConfigItemService` 创建/更新时检查：

```typescript
if (dto.isEncrypted && !this.encryptionService.isAvailable()) {
  throw new BusinessException({
    code: ApiErrorCode.CONFIG_ENCRYPTION_FAILED,
    message: '加密功能未配置，无法创建加密配置项',
  });
}
```

### 4.4 环境变量配置

**配置中心相关环境变量**：

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `CONFIG_ENCRYPTION_KEY` | string(64) | - | 加密密钥（64 位 hex），生产环境必填 |
| `CONFIG_CACHE_TTL_SECONDS` | number | 3600 | 缓存 TTL（秒） |

```bash
# 生成密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# .env 示例
CONFIG_ENCRYPTION_KEY=a1b2c3d4e5f6...（64位hex）
CONFIG_CACHE_TTL_SECONDS=3600
```

**env.schema.ts 配置**：

```typescript
// env.schema.ts 新增
CONFIG_ENCRYPTION_KEY: z
  .string()
  .length(64)
  .regex(/^[a-f0-9]+$/i, 'Must be a valid hex string')
  .optional(),
CONFIG_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
```

并在 `superRefine` 中添加生产环境校验：

```typescript
.superRefine((data, ctx) => {
  // ... existing validations ...

  // 配置中心加密密钥校验
  if (data.NODE_ENV === 'production' && !data.CONFIG_ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CONFIG_ENCRYPTION_KEY'],
      message: 'CONFIG_ENCRYPTION_KEY is required in production for config encryption',
    });
  }
});
```

### 4.5 敏感配置访问控制

```typescript
// 权限检查
if (config.isEncrypted && !user.hasPermission('config:read:sensitive')) {
  return {
    ...config,
    value: '***ENCRYPTED***',  // 隐藏真实值
  };
}
```

### 4.6 敏感配置审计日志脱敏

**风险**：Prisma 审计中间件会记录 `before/after` 快照，敏感配置明文可能泄露到 `AuditLog` 表。

**处理策略**：

```typescript
// 在审计中间件中，对加密配置进行脱敏
function sanitizeAuditData(model: string, data: any): any {
  if (model === 'ConfigItem' && data?.isEncrypted) {
    return {
      ...data,
      value: '[REDACTED]',  // 不记录敏感值
    };
  }
  return data;
}

// 审计日志记录时
const auditLog = {
  // ...
  before: sanitizeAuditData('ConfigItem', beforeData),
  after: sanitizeAuditData('ConfigItem', afterData),
};
```

**说明**：
- `isEncrypted: true` 的配置项，`before/after` 中的 `value` 字段替换为 `[REDACTED]`
- 仍记录其他字段（key, version, updatedAt 等）用于追溯
- 需要查看历史值时，通过 `ConfigHistory` 表并配合解密权限

---

## 五、缓存策略

### 5.1 缓存架构

```
客户端层：本地内存/localStorage + configHash 校验
    ↓
服务端层：Redis 缓存（TTL 可配置）
    ↓
数据库层：PostgreSQL
```

### 5.2 缓存 Key 设计

```
config:{namespace}:{key}           # 单个配置
config:{namespace}:all             # 整个命名空间所有配置
config:{namespace}:meta            # 元数据（key + version + hash 列表）
config:ns:list                     # 命名空间列表
```

### 5.3 缓存 TTL

| 场景 | TTL | 说明 |
|------|-----|------|
| 单个配置 | 1 小时 | 默认，可通过环境变量配置 |
| 命名空间全量 | 1 小时 | 默认 |
| 元数据 | 5 分钟 | 轻量，高频访问 |

**环境变量配置**：

```typescript
// env.schema.ts
CONFIG_CACHE_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),
```

### 5.4 缓存保护措施

**防止缓存击穿**（热点 key 失效时大量请求穿透到数据库）：

```typescript
// 使用分布式锁防止缓存击穿
async getConfigWithLock(namespace: string, key: string): Promise<ConfigItem> {
  const cacheKey = `config:${namespace}:${key}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // 使用项目已有的 redis-lock
  const lockKey = `lock:${cacheKey}`;
  const lock = await this.redisLock.acquire(lockKey, 5000);

  try {
    // 双重检查
    const rechecked = await this.redis.get(cacheKey);
    if (rechecked) return JSON.parse(rechecked);

    const config = await this.prisma.soft.configItem.findUnique(...);
    await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(config));
    return config;
  } finally {
    await lock.release();
  }
}
```

**防止缓存雪崩**（大量 key 同时失效）：

```typescript
// 添加随机 TTL 抖动（±10%）
private getCacheTtlWithJitter(): number {
  const jitter = this.cacheTtl * 0.1 * (Math.random() * 2 - 1);
  return Math.floor(this.cacheTtl + jitter);
}
```

### 5.5 缓存失效时机

| 操作 | 失效 Key |
|------|---------|
| 创建配置 | `config:{ns}:all`, `config:{ns}:meta` |
| 更新配置 | `config:{ns}:{key}`, `config:{ns}:all`, `config:{ns}:meta` |
| 删除配置 | 同上 |
| 回滚配置 | 同上 |
| 创建/更新/删除命名空间 | `config:ns:list` |

### 5.6 缓存一致性与失败处理

**写入顺序**：先更新数据库，再清除缓存（Cache-Aside 模式）

```typescript
async updateConfig(namespace: string, key: string, dto: UpdateConfigItemDto) {
  // 1. 更新数据库（事务）
  const updated = await this.prisma.$transaction(async (tx) => {
    const config = await tx.configItem.update({ ... });
    await tx.configHistory.create({ ... });
    return config;
  });

  // 2. 清除缓存（允许失败，降级为缓存自然过期）
  try {
    await this.invalidateCache(namespace, key);
  } catch (error) {
    this.logger.warn(`Cache invalidation failed: ${error.message}`);
    // 不抛出异常，接受短暂不一致（最多 TTL 时间）
  }

  // 3. 推送变更通知
  this.gateway.notifyChange(namespace, { ... });

  return updated;
}
```

**失败处理策略**：
- Redis 写入失败：降级为数据库直接查询
- Redis 删除失败：接受短暂不一致，等待 TTL 自然过期
- 关键操作使用 Redis Pipeline 减少网络往返

---

## 六、WebSocket 变更推送

### 6.1 事件设计

```typescript
// 客户端 -> 服务端：订阅命名空间
interface SubscribeEvent {
  event: 'config:subscribe';
  data: {
    namespaces: string[];  // 要订阅的命名空间列表
  };
}

// 服务端 -> 客户端：配置变更通知
interface ConfigChangedEvent {
  event: 'config:changed';
  data: {
    namespace: string;
    key: string;
    version: number;
    configHash: string;
    changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';
    changedAt: string;  // ISO 8601
  };
}

// 客户端 -> 服务端：取消订阅
interface UnsubscribeEvent {
  event: 'config:unsubscribe';
  data: {
    namespaces: string[];
  };
}
```

### 6.2 Gateway 实现

```typescript
// config-center.gateway.ts
@WebSocketGateway({ namespace: '/config' })
export class ConfigCenterGateway {
  @WebSocketServer()
  server: Server;

  /**
   * 本地订阅状态（仅用于日志/调试）
   * 实际推送依赖 Socket.io room 机制，通过 RedisIoAdapter 自动跨实例同步
   */
  private subscriptions = new Map<string, Set<string>>(); // socketId -> namespaces

  constructor(
    private readonly jwtService: JwtService,
    private readonly permissionService: PermissionService,
  ) {}

  /**
   * 从 Socket 连接中提取并验证用户身份
   */
  private async getUserFromSocket(client: Socket): Promise<User | null> {
    try {
      const token = client.handshake.auth?.token ||
                    client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return null;

      const payload = await this.jwtService.verifyAsync(token);
      return payload;
    } catch {
      return null;
    }
  }

  @SubscribeMessage('config:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { namespaces: string[] },
  ) {
    // 鉴权：验证用户身份和权限
    const user = await this.getUserFromSocket(client);
    if (!user) {
      return { success: false, error: 'Unauthorized: invalid token' };
    }

    const hasPermission = await this.permissionService.hasPermission(user.id, 'config:read');
    if (!hasPermission) {
      return { success: false, error: 'Forbidden: missing config:read permission' };
    }

    const current = this.subscriptions.get(client.id) || new Set();
    data.namespaces.forEach((ns) => {
      current.add(ns);
      client.join(`config:${ns}`);  // 加入 room
    });
    this.subscriptions.set(client.id, current);
    return { success: true, subscribed: Array.from(current) };
  }

  handleDisconnect(client: Socket) {
    this.subscriptions.delete(client.id);
  }

  // 由 Service 调用，推送变更通知
  notifyChange(namespace: string, payload: ConfigChangedPayload) {
    this.server.to(`config:${namespace}`).emit('config:changed', payload);
  }
}
```

### 6.3 客户端重连与 Token 刷新

客户端断开重连后需要重新订阅：

```typescript
// 客户端示例
socket.on('connect', () => {
  // 重连后重新订阅之前的命名空间
  socket.emit('config:subscribe', {
    namespaces: previousSubscriptions
  });
});
```

**Token 过期处理**：

```typescript
// 服务端：连接时验证，并监听 token 刷新事件
@SubscribeMessage('config:refresh-token')
async handleRefreshToken(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { token: string },
) {
  const user = await this.verifyToken(data.token);
  if (!user) {
    client.disconnect();
    return { success: false, error: 'Invalid token' };
  }
  // 更新 socket 关联的用户信息
  client.data.user = user;
  return { success: true };
}

// 客户端：token 刷新后通知 WebSocket
async function onTokenRefreshed(newToken: string) {
  socket.emit('config:refresh-token', { token: newToken });
}
```

**说明**：
- 连接时验证 token，过期则拒绝连接
- 客户端刷新 token 后，通过 `config:refresh-token` 事件更新
- 若长时间未刷新（超过 token 有效期），服务端可主动断开

---

## 七、权限设计

### 7.1 权限码定义

```typescript
export const CONFIG_PERMISSIONS = {
  // 读取权限
  'config:read': '读取配置',
  'config:read:sensitive': '读取敏感配置明文',

  // 写入权限
  'config:write': '创建/更新配置',
  'config:delete': '删除配置',
  'config:rollback': '回滚配置',

  // 命名空间管理
  'config:namespace:create': '创建命名空间',
  'config:namespace:update': '更新命名空间',
  'config:namespace:delete': '删除命名空间',
};
```

### 7.2 权限矩阵

| 角色 | 权限 |
|------|------|
| 普通用户 | 无 |
| 运营人员 | `config:read`, `config:write` |
| 高级运营 | 上述 + `config:read:sensitive`, `config:rollback` |
| 管理员 | 全部 |

---

## 八、错误码定义

```typescript
// error-codes.ts 新增（使用 14000-14999 命名空间，避免与现有 13xxx Dictionary 域冲突）
export const ApiErrorCode = {
  // ... existing codes ...

  // 14000-14999: Config Center 域

  // 命名空间相关 (140xx)
  CONFIG_NAMESPACE_NOT_FOUND: 14000,
  CONFIG_NAMESPACE_EXISTS: 14001,
  CONFIG_NAMESPACE_HAS_ITEMS: 14002,  // 删除时有配置项

  // 配置项相关 (141xx)
  CONFIG_ITEM_NOT_FOUND: 14010,
  CONFIG_ITEM_EXISTS: 14011,
  CONFIG_SCHEMA_VALIDATION_FAILED: 14012,
  CONFIG_SCHEMA_INVALID: 14013,
  CONFIG_ENCRYPTION_FAILED: 14014,
  CONFIG_DECRYPTION_FAILED: 14015,

  // 版本相关 (142xx)
  CONFIG_VERSION_NOT_FOUND: 14020,
  CONFIG_ROLLBACK_FAILED: 14021,
};
```

---

## 九、目录结构

```
src/modules/config-center/
├── config-center.module.ts
├── controllers/
│   ├── namespace.controller.ts       # 命名空间 CRUD
│   └── config-item.controller.ts     # 配置项 CRUD + 历史 + 回滚
├── services/
│   ├── namespace.service.ts
│   ├── config-item.service.ts
│   ├── config-encryption.service.ts  # 加密服务
│   └── config-schema-validator.service.ts  # Schema 校验
├── gateways/
│   └── config-center.gateway.ts      # WebSocket 推送
├── dto/
│   ├── create-namespace.dto.ts
│   ├── update-namespace.dto.ts
│   ├── query-namespace.dto.ts
│   ├── create-config-item.dto.ts
│   ├── update-config-item.dto.ts
│   ├── query-config-item.dto.ts
│   ├── rollback-config.dto.ts
│   └── index.ts
└── __tests__/
    ├── namespace.service.spec.ts
    ├── config-item.service.spec.ts
    ├── config-encryption.service.spec.ts
    └── config-schema-validator.service.spec.ts
```

---

## 十、典型使用场景

### 场景 1：小程序首页 Banner 配置

```typescript
// 创建配置（带 Schema）
POST /api/v1/config/mini_program
{
  "key": "home_banners",
  "value": {
    "banners": [
      {
        "id": 1,
        "imageUrl": "https://cdn.example.com/banner1.jpg",
        "linkUrl": "/pages/activity/123",
        "sort": 1
      }
    ],
    "autoPlayInterval": 3000
  },
  "valueType": "JSON",
  "description": "小程序首页轮播图配置",
  "jsonSchema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "properties": {
      "banners": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": { "type": "integer" },
            "imageUrl": { "type": "string", "format": "uri" },
            "linkUrl": { "type": "string" },
            "sort": { "type": "integer", "minimum": 0 }
          },
          "required": ["id", "imageUrl", "linkUrl"]
        }
      },
      "autoPlayInterval": { "type": "integer", "minimum": 1000, "maximum": 10000 }
    },
    "required": ["banners"]
  }
}
```

### 场景 2：小红书 Cookie 配置（敏感加密）

```typescript
// 创建敏感配置
POST /api/v1/config/third_party
{
  "key": "xhs_cookies",
  "value": "a]1=xxx; webId=xxx; web_session=xxx...",
  "valueType": "STRING",
  "description": "小红书爬虫 Cookie",
  "isEncrypted": true
}

// 无权限用户读取
GET /api/v1/config/third_party/xhs_cookies
{
  "code": 0,
  "data": {
    "key": "xhs_cookies",
    "value": "***ENCRYPTED***",  // 隐藏
    "isEncrypted": true,
    ...
  }
}

// 有 config:read:sensitive 权限用户读取
{
  "code": 0,
  "data": {
    "key": "xhs_cookies",
    "value": "a]1=xxx; webId=xxx; web_session=xxx...",  // 明文
    "isEncrypted": true,
    ...
  }
}
```

### 场景 3：功能开关（Feature Flag）

```typescript
// 创建功能开关
POST /api/v1/config/feature_flags
{
  "key": "new_checkout_flow",
  "value": {
    "enabled": true,
    "grayRatio": 0.2,
    "whitelistUserIds": [1, 2, 3]
  },
  "valueType": "JSON",
  "description": "新版结账流程灰度开关",
  "jsonSchema": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean" },
      "grayRatio": { "type": "number", "minimum": 0, "maximum": 1 },
      "whitelistUserIds": { "type": "array", "items": { "type": "integer" } }
    },
    "required": ["enabled"]
  }
}
```

### 场景 4：配置回滚

```typescript
// 查看历史
GET /api/v1/config/mini_program/home_banners/history
{
  "code": 0,
  "data": [
    { "version": 3, "changeType": "UPDATE", "changedAt": "2025-12-25T10:00:00Z", ... },
    { "version": 2, "changeType": "UPDATE", "changedAt": "2025-12-24T10:00:00Z", ... },
    { "version": 1, "changeType": "CREATE", "changedAt": "2025-12-23T10:00:00Z", ... }
  ]
}

// 回滚到版本 2
POST /api/v1/config/mini_program/home_banners/rollback/2
{
  "changeNote": "版本3有问题，回滚到版本2"
}

// 回滚后版本变为 4（新版本号），值恢复为版本2的内容
```

---

## 十一、与业界方案对比

| 特性 | Apollo | Nacos | 本方案 |
|------|--------|-------|--------|
| 组织方式 | namespace + key | dataId + group | namespace + key |
| 多环境 | 原生支持 | 原生支持 | 暂不支持（按需扩展） |
| 灰度发布 | 完整 | 完整 | 简化版（值内 grayRatio） |
| 版本回滚 | 支持 | 支持 | 支持 |
| 变更推送 | 长轮询 | 长连接 | WebSocket |
| 加密存储 | 需扩展 | 需扩展 | 内置 |
| JSON Schema | 不支持 | 不支持 | **内置支持** |
| 依赖 | 独立部署 | 独立部署 | **内嵌（零外部依赖）** |
| 适用规模 | 大型分布式 | 大型分布式 | 中小型单体/微服务 |

**本方案定位**：轻量级、内嵌式配置中心，适合中小型项目，无需额外运维成本。

---

## 十二、后续扩展方向（可选）

1. **多环境支持**：添加 `environment` 字段区分 dev/staging/prod
2. **配置继承**：支持 default + overlay 模式
3. **审批流程**：敏感配置变更需要审批
4. **导入导出**：支持 YAML/JSON 批量导入导出
5. **配置对比**：可视化对比不同版本差异
6. **密钥轮换**：支持多版本加密密钥，value 前缀标识密钥版本（如 `v2:{encrypted}`），支持平滑迁移
7. **缓存预热**：服务启动时预加载高频访问的配置到 Redis
8. **缓存击穿保护**：使用 singleflight 或分布式锁防止缓存同时失效导致的数据库压力

---

## 十三、实现步骤

### Phase 1：基础功能

1. [ ] 创建 Prisma Schema 并执行迁移
2. [ ] 更新 `SOFT_DELETE_MODELS` 集合并运行 `pnpm soft-delete-check`
3. [ ] 更新 `env.schema.ts` 添加 `CONFIG_ENCRYPTION_KEY` 校验
4. [ ] 安装依赖: `pnpm add ajv ajv-formats`
5. [ ] 实现 `ConfigEncryptionService`
6. [ ] 实现 `ConfigSchemaValidatorService`
7. [ ] 实现 `NamespaceService` + Controller
8. [ ] 实现 `ConfigItemService` + Controller

### Phase 2：高级功能

9. [ ] 实现版本历史查询
10. [ ] 实现配置回滚
11. [ ] 实现 Redis 缓存层（含分布式锁防击穿、TTL 抖动防雪崩）
12. [ ] 实现 WebSocket 变更推送（含鉴权）
13. [ ] 添加错误码到 `error-codes.ts` (14000-14999)

### Phase 3：测试与文档

14. [ ] 单元测试
15. [ ] E2E 测试（含多实例 WebSocket 推送测试）
16. [ ] 加密配置读写完整性测试（加密→存储→解密→验证）
17. [ ] Swagger API 文档
18. [ ] 前端使用指南
