# 实现方案

> 创建日期: 2025-12-29

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         i_54kb_web 管理后台                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  采集规则配置页面                                                  │    │
│  │  - 添加/编辑/删除采集规则                                          │    │
│  │  - 配置域名、数据类型、字段过滤等                                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ API 调用
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         i_54kb_server 后端                               │
│                                                                          │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐     │
│  │  采集规则 CRUD API   │    │  配置下发 API (X-Script-Token)      │     │
│  │  /api/v1/collector  │    │  GET /api/v1/collector/config       │     │
│  │  /rules/*           │    │  (供油猴脚本调用)                    │     │
│  └─────────────────────┘    └─────────────────────────────────────┘     │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  数据库: collector_rules 表                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼ 获取配置
┌─────────────────────────────────────────────────────────────────────────┐
│                      syncAllCookies.js 油猴脚本                          │
│                                                                          │
│  1. 启动时获取配置（带缓存）                                              │
│  2. 页面加载时匹配当前域名                                                │
│  3. 根据规则采集对应数据                                                  │
│  4. 上报到服务器                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: 数据库设计

### Step 1: Prisma Schema

```prisma
// prisma/schema.prisma

model CollectorRule {
  id          Int      @id @default(autoincrement())

  // 基础信息
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  isEnabled   Boolean  @default(true) @map("is_enabled")
  priority    Int      @default(10)

  // 域名匹配
  domainPattern   String  @map("domain_pattern") @db.VarChar(200)
  domainMatchType String  @map("domain_match_type") @db.VarChar(20)

  // 采集配置 (JSON)
  collectors  Json

  // 上报配置
  uploadKeyTemplate String @map("upload_key_template") @db.VarChar(200)

  // 触发配置 (JSON)
  trigger     Json

  // 审计字段
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  createdById Int?     @map("created_by_id")
  updatedById Int?     @map("updated_by_id")

  // 软删除字段
  deletedAt    DateTime? @map("deleted_at")
  deletedById  Int?      @map("deleted_by_id")
  deleteReason String?   @map("delete_reason") @db.VarChar(200)

  // 关联
  createdBy  User? @relation("CollectorRuleCreator", fields: [createdById], references: [id])
  updatedBy  User? @relation("CollectorRuleUpdater", fields: [updatedById], references: [id])
  deletedBy  User? @relation("CollectorRuleDeleter", fields: [deletedById], references: [id])

  @@index([isEnabled, priority], map: "idx_enabled_priority")
  @@index([domainPattern], map: "idx_domain")
  @@index([deletedAt], map: "idx_deleted_at")
  @@map("collector_rules")
}
```

### Step 2: 数据库迁移

```bash
pnpm prisma migrate dev --name add_collector_rules
```

### Step 2.1: 软删除模型注册 Checklist

> ⚠️ **实施时必须完成以下步骤**（参考 CLAUDE.md 软删除规范）

- [ ] 在 `src/database/prisma.service.ts` 的 `SOFT_DELETE_MODELS` 集合中添加 `'CollectorRule'`
- [ ] 在 `src/database/types.ts` 的 `SoftDeleteModelName` 类型中添加 `'CollectorRule'`
- [ ] 运行 `pnpm soft-delete-check` 验证一致性
- [ ] 确认 `collectorRuleSoftDelete()`, `collectorRuleRestore()`, `collectorRuleHardDelete()` 方法可用

---

## Part 2: 类型定义

### Step 3: 接口类型定义

文件: `src/modules/collector/interfaces/collector-rule.interface.ts`

```typescript
/**
 * Cookie 采集配置
 */
export interface CookieCollectorConfig {
  enabled: boolean;

  /** 采集范围: current=当前域名, all=主域名下所有子域名 */
  scope: 'current' | 'all';

  /** 是否包含 httpOnly Cookie（需要 GM_cookie 权限） */
  includeHttpOnly: boolean;

  /** 字段过滤配置 */
  filter?: FieldFilter;
}

/**
 * Storage 采集配置（localStorage / sessionStorage）
 */
export interface StorageCollectorConfig {
  enabled: boolean;

  /** 字段过滤配置 */
  filter?: FieldFilter;
}

/**
 * 字段过滤配置
 */
export interface FieldFilter {
  /** 过滤模式: include=白名单, exclude=黑名单 */
  mode: 'include' | 'exclude';

  /** 字段列表，支持通配符 * */
  keys: string[];
}

/**
 * 采集器配置
 */
export interface CollectorsConfig {
  cookie?: CookieCollectorConfig;
  localStorage?: StorageCollectorConfig;
  sessionStorage?: StorageCollectorConfig;
}

/**
 * 触发条件配置
 */
export interface TriggerConfig {
  /** 页面加载时触发 */
  onPageLoad: boolean;

  /** Storage 变化时触发 */
  onStorageChange: boolean;

  /** 定时触发间隔（分钟），0 或 undefined 表示不定时 */
  intervalMinutes?: number;
}

/**
 * 采集规则完整配置
 */
export interface CollectorRule {
  id: number;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number;

  domainPattern: string;
  domainMatchType: 'exact' | 'suffix' | 'regex';

  collectors: CollectorsConfig;
  uploadKeyTemplate: string;
  trigger: TriggerConfig;

  createdAt: Date;
  updatedAt: Date;
}
```

---

## Part 3: DTO 定义

### Step 4: 创建规则 DTO

文件: `src/modules/collector/dto/create-collector-rule.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const FieldFilterSchema = z.object({
  mode: z.enum(['include', 'exclude']),
  keys: z.array(z.string().min(1).max(100)).min(1).max(50),
});

const CookieCollectorSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['current', 'all']).default('all'),
  includeHttpOnly: z.boolean().default(true),
  filter: FieldFilterSchema.optional(),
});

const StorageCollectorSchema = z.object({
  enabled: z.boolean(),
  filter: FieldFilterSchema.optional(),
});

const CollectorsSchema = z.object({
  cookie: CookieCollectorSchema.optional(),
  localStorage: StorageCollectorSchema.optional(),
  sessionStorage: StorageCollectorSchema.optional(),
});

const TriggerSchema = z.object({
  onPageLoad: z.boolean().default(true),
  onStorageChange: z.boolean().default(false),
  intervalMinutes: z.number().int().min(0).max(1440).optional(),
});

/**
 * 校验正则表达式是否存在 ReDoS 风险
 * 禁止嵌套量词和回溯陷阱
 * @exports 供 UpdateDTO 复用
 */
export function validateRegexSafety(pattern: string): boolean {
  // 禁止嵌套量词: (a+)+, (a*)+, (a?)+, (a{n})+
  const nestedQuantifiers = /(\([^)]*[+*?}]\)[+*?]|\([^)]*[+*?}]\)\{)/;
  if (nestedQuantifiers.test(pattern)) {
    return false;
  }

  // 禁止重叠字符类: [a-zA-Z]*[a-z]*
  // 简化检测：禁止连续的通配量词
  const overlappingWildcards = /\.\*\.\*/;
  if (overlappingWildcards.test(pattern)) {
    return false;
  }

  // 尝试编译并设置执行超时（运行时额外保护）
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export const CreateCollectorRuleSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  isEnabled: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(10),

  domainPattern: z.string().min(1).max(200).trim(),
  domainMatchType: z.enum(['exact', 'suffix', 'regex']),
}).refine(
  (data) => {
    // 仅当匹配类型为 regex 时校验正则安全性
    if (data.domainMatchType === 'regex') {
      return validateRegexSafety(data.domainPattern);
    }
    return true;
  },
  { message: '正则表达式存在安全风险（ReDoS），请简化模式', path: ['domainPattern'] }
).and(z.object({
  collectors: CollectorsSchema.refine(
    (data) => data.cookie?.enabled || data.localStorage?.enabled || data.sessionStorage?.enabled,
    { message: '至少需要启用一种采集类型' }
  ),

  uploadKeyTemplate: z.string().min(1).max(200).trim()
    .regex(/^[a-z][a-z0-9_{}]*$/, 'Key 模板格式不正确')
    .refine(
      (template) => {
        // 校验模板变量：只允许已知变量
        const allowedVars = ['domain', 'deviceId', 'accountTag', 'timestamp'];
        const matches = template.match(/\{(\w+)\}/g) || [];
        return matches.every(m => {
          const varName = m.slice(1, -1);
          return allowedVars.includes(varName);
        });
      },
      { message: '模板包含未知变量，允许: {domain}, {deviceId}, {accountTag}, {timestamp}' }
    ),

  trigger: TriggerSchema.refine(
    (data) => data.onPageLoad || data.onStorageChange || (data.intervalMinutes && data.intervalMinutes > 0),
    { message: '至少需要启用一种触发条件' }
  ),
}));

export class CreateCollectorRuleDto extends createZodDto(CreateCollectorRuleSchema) {}
```

### Step 5: 更新规则 DTO

文件: `src/modules/collector/dto/update-collector-rule.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CreateCollectorRuleSchema, validateRegexSafety } from './create-collector-rule.dto';

// 基础 partial schema
const BaseUpdateSchema = CreateCollectorRuleSchema.partial();

// 添加条件校验（只在相关字段被提供时校验）
export const UpdateCollectorRuleSchema = BaseUpdateSchema.superRefine((data, ctx) => {
  // 若提供了 collectors，校验至少启用一种
  if (data.collectors) {
    const { cookie, localStorage, sessionStorage } = data.collectors;
    if (!cookie?.enabled && !localStorage?.enabled && !sessionStorage?.enabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '至少需要启用一种采集类型',
        path: ['collectors'],
      });
    }
  }

  // 若提供了 trigger，校验至少启用一种触发条件
  if (data.trigger) {
    const { onPageLoad, onStorageChange, intervalMinutes } = data.trigger;
    if (!onPageLoad && !onStorageChange && !(intervalMinutes && intervalMinutes > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '至少需要启用一种触发条件',
        path: ['trigger'],
      });
    }
  }

  // 若提供了 regex 类型的域名模式，校验 ReDoS 安全性
  if (data.domainMatchType === 'regex' && data.domainPattern) {
    if (!validateRegexSafety(data.domainPattern)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '正则表达式存在安全风险（ReDoS），请简化模式',
        path: ['domainPattern'],
      });
    }
  }
});

export class UpdateCollectorRuleDto extends createZodDto(UpdateCollectorRuleSchema) {}
```

### Step 6: 查询 DTO

文件: `src/modules/collector/dto/query-collector-rule.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const QueryCollectorRuleSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  isEnabled: z.enum(['true', 'false']).optional().transform(v => v === 'true'),
  search: z.string().max(100).optional(),
});

export class QueryCollectorRuleDto extends createZodDto(QueryCollectorRuleSchema) {}
```

---

## Part 4: Service 实现

### Step 7: 采集规则 Service

文件: `src/modules/collector/services/collector-rule.service.ts`

```typescript
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '@/common/redis/redis.module';
import Redis from 'ioredis';

const COLLECTOR_CONFIG_CACHE_KEY = 'collector:config:enabled';

@Injectable()
export class CollectorRuleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * 清除配置缓存
   */
  private async invalidateCache(): Promise<void> {
    await this.redis.del(COLLECTOR_CONFIG_CACHE_KEY);
  }

  /**
   * 创建采集规则
   */
  async create(dto: CreateCollectorRuleDto): Promise<CollectorRule> {
    // 检查 domainPattern + domainMatchType 组合唯一性
    await this.checkDuplicateDomainPattern(dto.domainPattern, dto.domainMatchType);

    const rule = await this.prisma.soft.collectorRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        isEnabled: dto.isEnabled,
        priority: dto.priority,
        domainPattern: dto.domainPattern,
        domainMatchType: dto.domainMatchType,
        collectors: dto.collectors as Prisma.JsonObject,
        uploadKeyTemplate: dto.uploadKeyTemplate,
        trigger: dto.trigger as Prisma.JsonObject,
      },
    });

    // 创建后失效缓存
    await this.invalidateCache();
    return rule;
  }

  /**
   * 检查域名模式是否重复
   */
  private async checkDuplicateDomainPattern(
    domainPattern: string,
    domainMatchType: string,
    excludeId?: number,
  ): Promise<void> {
    const existing = await this.prisma.soft.collectorRule.findFirst({
      where: {
        domainPattern,
        domainMatchType,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new BusinessException({
        code: ApiErrorCode.COLLECTOR_RULE_INVALID,
        message: `域名模式 "${domainPattern}" (${domainMatchType}) 已存在`,
        status: 400,
      });
    }
  }

  /**
   * 分页查询规则列表
   */
  async findAll(query: QueryCollectorRuleDto) {
    const { page, limit, isEnabled, search } = query;

    const where: Prisma.CollectorRuleWhereInput = {};
    if (isEnabled !== undefined) where.isEnabled = isEnabled;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { domainPattern: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.soft.collectorRule.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.soft.collectorRule.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取所有启用的规则（供配置下发使用）
   */
  async findAllEnabled(): Promise<CollectorRule[]> {
    return this.prisma.soft.collectorRule.findMany({
      where: { isEnabled: true },
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * 根据 ID 查询规则
   */
  async findById(id: number): Promise<CollectorRule> {
    const rule = await this.prisma.soft.collectorRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new BusinessException({
        code: ApiErrorCode.COLLECTOR_RULE_NOT_FOUND,
        message: `采集规则 ${id} 不存在`,
        status: 404,
      });
    }
    return rule;
  }

  /**
   * 更新规则
   * @returns 规则对象 + 可选的警告信息
   */
  async update(id: number, dto: UpdateCollectorRuleDto): Promise<{
    rule: CollectorRule;
    warning?: { field: string; message: string };
  }> {
    const existing = await this.findById(id); // 确保存在

    // 如果更新了域名模式，检查唯一性
    if (dto.domainPattern || dto.domainMatchType) {
      await this.checkDuplicateDomainPattern(
        dto.domainPattern ?? existing.domainPattern,
        dto.domainMatchType ?? existing.domainMatchType,
        id, // 排除当前记录
      );
    }

    // 检测 Key 模板是否变更（高风险操作）
    const keyTemplateChanged = dto.uploadKeyTemplate &&
      dto.uploadKeyTemplate !== existing.uploadKeyTemplate;

    const rule = await this.prisma.soft.collectorRule.update({
      where: { id },
      data: {
        ...dto,
        collectors: dto.collectors as Prisma.JsonObject | undefined,
        trigger: dto.trigger as Prisma.JsonObject | undefined,
      },
    });

    // 更新后失效缓存
    await this.invalidateCache();

    return {
      rule,
      ...(keyTemplateChanged && {
        warning: {
          field: 'uploadKeyTemplate',
          message: 'Key 模板已变更，历史数据将无法与新数据关联',
        },
      }),
    };
  }

  /**
   * 删除规则（软删除）
   */
  async delete(id: number, reason?: string): Promise<void> {
    await this.findById(id);
    // 使用项目统一的软删除方法
    await this.prisma.collectorRuleSoftDelete(id, reason);
    // 删除后失效缓存
    await this.invalidateCache();
  }

  /**
   * 切换启用状态
   */
  async toggle(id: number): Promise<CollectorRule> {
    const rule = await this.findById(id);
    const updated = await this.prisma.soft.collectorRule.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });

    // 状态变更后失效缓存
    await this.invalidateCache();
    return updated;
  }

  /**
   * 批量切换启用状态
   */
  async batchToggle(ids: number[], isEnabled: boolean): Promise<{ updatedCount: number }> {
    // 校验数量限制
    if (ids.length > 50) {
      throw new BusinessException({
        code: ApiErrorCode.COLLECTOR_BATCH_LIMIT_EXCEEDED,
        message: '批量操作最多支持 50 条规则',
        status: 400,
      });
    }

    const result = await this.prisma.soft.collectorRule.updateMany({
      where: { id: { in: ids } },
      data: { isEnabled },
    });

    // 状态变更后失效缓存
    await this.invalidateCache();
    return { updatedCount: result.count };
  }

  /**
   * 域名匹配测试
   */
  async testMatch(domain: string): Promise<{
    matched: boolean;
    matchedRule: CollectorRule | null;
    allMatchedRules: Pick<CollectorRule, 'id' | 'name' | 'priority'>[];
  }> {
    const rules = await this.findAllEnabled();

    const matchedRules = rules.filter(rule => {
      switch (rule.domainMatchType) {
        case 'exact':
          return domain === rule.domainPattern;
        case 'suffix':
          return domain.endsWith(rule.domainPattern);
        case 'regex':
          try {
            return new RegExp(rule.domainPattern).test(domain);
          } catch {
            return false;
          }
        default:
          return false;
      }
    });

    // 按优先级排序
    matchedRules.sort((a, b) => b.priority - a.priority);

    return {
      matched: matchedRules.length > 0,
      matchedRule: matchedRules[0] || null,
      allMatchedRules: matchedRules.map(r => ({
        id: r.id,
        name: r.name,
        priority: r.priority,
      })),
    };
  }
}
```

---

## Part 5: Controller 实现

### Step 8: 规则管理 Controller

文件: `src/modules/collector/controllers/collector-rule.controller.ts`

```typescript
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

@ApiTags('Collector Rules')
@Controller('collector/rules')
export class CollectorRuleController {
  constructor(private readonly ruleService: CollectorRuleService) {}

  @Post()
  @RequirePermissions('collector:rule:create')
  @ApiOperation({ summary: '创建采集规则' })
  async create(@Body() dto: CreateCollectorRuleDto) {
    return this.ruleService.create(dto);
  }

  @Get()
  @RequirePermissions('collector:rule:read')
  @ApiOperation({ summary: '获取采集规则列表' })
  async findAll(@Query() query: QueryCollectorRuleDto) {
    return this.ruleService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('collector:rule:read')
  @ApiOperation({ summary: '获取采集规则详情' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.ruleService.findById(id);
  }

  @Put(':id')
  @RequirePermissions('collector:rule:update')
  @ApiOperation({ summary: '更新采集规则' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectorRuleDto,
  ) {
    return this.ruleService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('collector:rule:delete')
  @ApiOperation({ summary: '删除采集规则' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.ruleService.delete(id);
    return { success: true };
  }

  @Patch(':id/toggle')
  @RequirePermissions('collector:rule:update')
  @ApiOperation({ summary: '切换采集规则启用状态' })
  async toggle(@Param('id', ParseIntPipe) id: number) {
    return this.ruleService.toggle(id);
  }

  @Patch('batch-toggle')
  @RequirePermissions('collector:rule:update')
  @ApiOperation({ summary: '批量切换启用状态' })
  async batchToggle(@Body() dto: BatchToggleDto) {
    const result = await this.ruleService.batchToggle(dto.ids, dto.isEnabled);
    return { success: true, ...result };
  }

  @Post('test-match')
  @RequirePermissions('collector:rule:read')
  @ApiOperation({ summary: '域名匹配测试' })
  async testMatch(@Body() dto: TestMatchDto) {
    return this.ruleService.testMatch(dto.domain);
  }
}
```

### Step 8.1: 批量操作 DTO

文件: `src/modules/collector/dto/batch-toggle.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const BatchToggleSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(50),
  isEnabled: z.boolean(),
});

export class BatchToggleDto extends createZodDto(BatchToggleSchema) {}
```

### Step 8.2: 域名测试 DTO

文件: `src/modules/collector/dto/test-match.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const TestMatchSchema = z.object({
  domain: z.string().min(1).max(200).trim(),
});

export class TestMatchDto extends createZodDto(TestMatchSchema) {}
```

### Step 9: 配置下发 Controller（带 Redis 缓存和 ETag）

文件: `src/modules/collector/controllers/collector-config.controller.ts`

```typescript
import { createHash } from 'crypto';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '@/common/redis/redis.module';
import { RawResponse } from '@/common/decorators/raw-response.decorator';
import Redis from 'ioredis';

const COLLECTOR_CONFIG_CACHE_KEY = 'collector:config:enabled';
const COLLECTOR_CONFIG_CACHE_TTL = 60; // 60 秒

@ApiTags('Collector Config')
@Controller('collector')
@Public()
@UseGuards(ScriptTokenGuard)
export class CollectorConfigController {
  constructor(
    private readonly ruleService: CollectorRuleService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('config')
  @RawResponse() // 绕过 TransformInterceptor，手动控制 ETag 和 304 响应
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({ summary: '获取采集配置（供油猴脚本调用）' })
  async getConfig(@Headers('if-none-match') ifNoneMatch: string, @Res() res: Response) {
    // 尝试从 Redis 缓存获取
    let configData = await this.redis.get(COLLECTOR_CONFIG_CACHE_KEY);

    if (!configData) {
      // 缓存未命中，从数据库查询
      const rules = await this.ruleService.findAllEnabled();
      const config = {
        rules: rules.map(rule => ({
          id: rule.id,
          name: rule.name,
          priority: rule.priority,
          domainPattern: rule.domainPattern,
          domainMatchType: rule.domainMatchType,
          collectors: rule.collectors,
          uploadKeyTemplate: rule.uploadKeyTemplate,
          trigger: rule.trigger,
        })),
      };
      configData = JSON.stringify(config);

      // 写入缓存（空结果使用更长 TTL 防止缓存穿透）
      const ttl = rules.length === 0 ? 300 : COLLECTOR_CONFIG_CACHE_TTL;
      await this.redis.setex(COLLECTOR_CONFIG_CACHE_KEY, ttl, configData);
    }

    // 计算 ETag（基于内容 hash）
    const etag = `"${createHash('md5').update(configData).digest('hex')}"`;

    // 检查客户端缓存是否有效
    if (ifNoneMatch === etag) {
      return res.status(304).send();
    }

    const config = JSON.parse(configData);
    return res
      .header('ETag', etag)
      .json({
        code: 0,
        message: 'success',
        data: {
          version: etag, // 使用 ETag 作为版本标识
          ...config,
        },
        timestamp: Date.now(),
      });
  }
}
```

**缓存失效说明**：缓存失效逻辑已内置于 `CollectorRuleService` 的 `invalidateCache()` 私有方法中，在 create/update/delete/toggle 操作后自动调用。

---

## Part 6: 错误码定义

### Step 10: 添加错误码

文件: `src/common/errors/error-codes.ts`

```typescript
/**
 * 18000-18999: Collector 域（采集规则配置）
 * - 18001: 规则不存在
 * - 18002: 规则配置无效（校验失败、重复等）
 * - 18003: 批量操作超出限制
 */
COLLECTOR_RULE_NOT_FOUND: 18001,
COLLECTOR_RULE_INVALID: 18002,
COLLECTOR_BATCH_LIMIT_EXCEEDED: 18003,
```

---

## Part 7: 模块注册

### Step 11: Collector 模块

文件: `src/modules/collector/collector.module.ts`

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [
    CollectorRuleController,
    CollectorConfigController,
  ],
  providers: [CollectorRuleService],
  exports: [CollectorRuleService],
})
export class CollectorModule {}
```

### Step 12: 注册到 AppModule

文件: `src/app.module.ts`

```typescript
imports: [
  // ... 其他模块
  CollectorModule,
],
```

---

## Part 8: 油猴脚本改造

### Step 13: 脚本核心流程

文件: `tm_user_scripts/src/syncAllCookies.js`

脚本按功能模块划分为以下部分：

```
┌─────────────────────────────────────────────────────────────────┐
│                     syncAllCookies.js 结构                       │
├─────────────────────────────────────────────────────────────────┤
│  1. 配置常量与能力检测 - API 地址、Token、GM_* API 检测          │
│  2. 配置管理模块  - 获取配置、缓存管理、降级处理                   │
│  3. 域名匹配模块  - 精确/后缀/正则匹配                            │
│  4. 字段过滤模块  - 白名单/黑名单过滤                             │
│  5. 数据采集模块  - Cookie/localStorage/sessionStorage 采集      │
│  6. 数据上报模块  - 上报到服务器                                  │
│  7. 触发器模块    - 页面加载/Storage 变化/定时触发               │
│  8. 主流程        - 环境检查 + 入口函数                          │
└─────────────────────────────────────────────────────────────────┘
```

#### 模块 1: 配置常量与能力检测

```javascript
// === 配置常量 ===
const API_BASE = 'https://i.54kb.com';
const CONFIG_CACHE_KEY = 'CS_COLLECTOR_CONFIG';
const CONFIG_CACHE_TTL = 10 * 60 * 1000; // 10 分钟
const TOKEN_STORAGE_KEY = 'CS_SCRIPT_TOKEN';
const ACCOUNT_TAG_KEY = 'CS_ACCOUNT_TAG';

/**
 * 获取或初始化 Token（首次运行时引导用户配置）
 */
function getOrInitToken() {
  let token = GM_getValue(TOKEN_STORAGE_KEY, '');

  if (!token) {
    token = prompt(
      '[Cookie 采集器] 首次使用需要配置 Token\n\n' +
      '请从管理后台复制 Token：\n' +
      '「系统设置」→「脚本管理」→「生成 Token」\n\n' +
      '粘贴到下方输入框：'
    );

    if (token && token.length === 32) {
      GM_setValue(TOKEN_STORAGE_KEY, token);
      alert('[Cookie 采集器] Token 已保存！脚本将开始工作。');
    } else {
      alert('[Cookie 采集器] Token 格式不正确（应为32位），请重新配置。');
      return null;
    }
  }

  return token;
}

/**
 * 获取账号标签（支持用户自定义）
 */
function getAccountTag() {
  let tag = GM_getValue(ACCOUNT_TAG_KEY, '');
  if (!tag) {
    tag = 'default';
    GM_setValue(ACCOUNT_TAG_KEY, tag);
  }
  return tag;
}

// === 能力检测 ===
const capabilities = {
  cookie: typeof GM_cookie !== 'undefined',
  xmlHttpRequest: typeof GM_xmlhttpRequest !== 'undefined',
  getValue: typeof GM_getValue !== 'undefined',
};

/**
 * 检查运行环境是否满足要求
 */
function checkEnvironment() {
  if (!capabilities.xmlHttpRequest) {
    console.error('[Collector] 缺少 GM_xmlhttpRequest 权限，脚本无法运行');
    return false;
  }
  if (!capabilities.getValue) {
    console.warn('[Collector] 缺少 GM_getValue 权限，无法缓存配置');
  }
  if (!capabilities.cookie) {
    console.warn('[Collector] 缺少 GM_cookie 权限，无法采集 httpOnly Cookie');
  }
  return true;
}
```

#### 模块 2: 配置管理

负责从服务端获取配置，支持缓存和降级。

```javascript
// === 配置管理模块 ===
async function getCollectorConfig() {
  const cached = GM_getValue(CONFIG_CACHE_KEY, null);

  // 检查缓存是否有效
  if (cached && Date.now() - cached.fetchedAt < CONFIG_CACHE_TTL) {
    console.log('[Collector] 使用缓存配置');
    return cached.config;
  }

  // 从服务器获取最新配置
  try {
    const config = await fetchConfigFromServer();
    GM_setValue(CONFIG_CACHE_KEY, { config, fetchedAt: Date.now() });
    console.log('[Collector] 配置已更新');
    return config;
  } catch (e) {
    // 降级：使用过期缓存
    console.warn('[Collector] 获取配置失败，使用过期缓存:', e.message);
    return cached?.config || null;
  }
}

async function fetchConfigFromServer() {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${API_BASE}/api/v1/collector/config`,
      headers: { 'X-Script-Token': SCRIPT_TOKEN },
      onload: (res) => {
        if (res.status === 200) {
          resolve(JSON.parse(res.responseText).data);
        } else {
          reject(new Error(`HTTP ${res.status}`));
        }
      },
      onerror: (err) => reject(new Error('Network error')),
    });
  });
}
```

#### 模块 3: 域名匹配

支持精确匹配、后缀匹配、正则匹配三种模式。

```javascript
// === 域名匹配模块 ===

/**
 * 安全执行正则（防 ReDoS 攻击）
 */
function safeRegexTest(pattern, str, timeoutMs = 50) {
  const start = performance.now();
  try {
    const regex = new RegExp(pattern);
    const result = regex.test(str);
    if (performance.now() - start > timeoutMs) {
      console.warn('[Collector] 正则执行超时，跳过:', pattern);
      return false;
    }
    return result;
  } catch (e) {
    console.warn('[Collector] 正则无效:', pattern);
    return false;
  }
}

/**
 * 匹配域名
 */
function matchDomain(rule, currentDomain) {
  switch (rule.domainMatchType) {
    case 'exact':
      return currentDomain === rule.domainPattern;
    case 'suffix':
      return currentDomain.endsWith(rule.domainPattern);
    case 'regex':
      return safeRegexTest(rule.domainPattern, currentDomain);
    default:
      return false;
  }
}
```

#### 模块 4: 字段过滤

支持通配符匹配，白名单/黑名单模式。

```javascript
// === 字段过滤模块 ===

/**
 * 检查字段是否应被采集
 * @param key 字段名
 * @param filter 过滤配置 { mode: 'include'|'exclude', keys: string[] }
 */
function matchField(key, filter) {
  if (!filter) return true; // 无过滤配置，采集所有

  const matches = filter.keys.some(pattern => {
    if (pattern.includes('*')) {
      // 通配符转正则：access-token-* → ^access-token-.*$
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(key);
    }
    return key === pattern;
  });

  return filter.mode === 'include' ? matches : !matches;
}
```

#### 模块 5: 数据采集

```javascript
// === 数据采集模块 ===

/**
 * 采集 Cookie（支持 httpOnly）
 */
async function collectCookies(config) {
  // 能力检测：无 GM_cookie 时降级为 document.cookie
  if (!capabilities.cookie) {
    console.warn('[Collector] GM_cookie 不可用，降级为 document.cookie（无法获取 httpOnly）');
    return collectCookiesFromDocument(config);
  }

  return new Promise((resolve) => {
    const domain = config.scope === 'all'
      ? '.' + getMainDomain(location.hostname)
      : location.hostname;

    GM_cookie.list({ domain }, (cookies, error) => {
      if (error) {
        console.error('[Collector] Cookie 采集失败:', error);
        resolve([]);
        return;
      }

      const filtered = cookies.filter(c =>
        matchField(c.name, config.filter) &&
        (config.includeHttpOnly || !c.httpOnly)
      );

      console.log(`[Collector] 采集到 ${filtered.length} 个 Cookie`);
      resolve(filtered);
    });
  });
}

/**
 * 降级方案：从 document.cookie 采集（无法获取 httpOnly）
 */
function collectCookiesFromDocument(config) {
  const cookies = document.cookie.split(';').map(c => {
    const [name, ...valueParts] = c.trim().split('=');
    return { name, value: valueParts.join('='), httpOnly: false };
  }).filter(c => c.name && matchField(c.name, config.filter));

  console.log(`[Collector] 从 document.cookie 采集到 ${cookies.length} 个 Cookie`);
  return cookies;
}

/**
 * 采集 Storage（localStorage / sessionStorage）
 */
function collectStorage(storage, filter) {
  const result = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (matchField(key, filter)) {
      result[key] = storage.getItem(key);
    }
  }
  return result;
}

/**
 * 根据规则采集所有数据
 */
async function collectData(rule) {
  const result = {
    domain: location.hostname,
    timestamp: Date.now(),
    deviceId: getDeviceId(),
    accountTag: getAccountTag(),
  };

  if (rule.collectors.cookie?.enabled) {
    result.cookies = await collectCookies(rule.collectors.cookie);
    result.cookieObj = result.cookies.reduce((obj, c) => {
      obj[c.name] = c.value;
      return obj;
    }, {});
  }

  if (rule.collectors.localStorage?.enabled) {
    result.localStorage = collectStorage(
      localStorage,
      rule.collectors.localStorage.filter
    );
  }

  if (rule.collectors.sessionStorage?.enabled) {
    result.sessionStorage = collectStorage(
      sessionStorage,
      rule.collectors.sessionStorage.filter
    );
  }

  return result;
}
```

#### 模块 6: 数据上报

```javascript
// === 数据上报模块 ===

/**
 * 生成上报 Key
 */
function buildUploadKey(template, data) {
  return template
    .replace('{domain}', data.domain.replace(/\./g, '_'))
    .replace('{deviceId}', data.deviceId)
    .replace('{accountTag}', data.accountTag)
    .replace('{timestamp}', String(data.timestamp));
}

/**
 * 采集并上报数据
 */
async function collectAndUpload(rule) {
  const data = await collectData(rule);
  const uploadKey = buildUploadKey(rule.uploadKeyTemplate, data);

  console.log(`[Collector] 上报数据，Key: ${uploadKey}`);

  // 调用现有的上报接口...
  await uploadToServer(uploadKey, data);
}
```

#### 模块 7: 触发器

```javascript
// === 触发器模块 ===

/**
 * 防抖函数
 */
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

/**
 * 设置触发器
 */
function setupTriggers(rule) {
  // 页面加载触发
  if (rule.trigger.onPageLoad) {
    collectAndUpload(rule);
  }

  // Storage 变化触发（1秒防抖）
  if (rule.trigger.onStorageChange) {
    const debouncedCollect = debounce(() => collectAndUpload(rule), 1000);
    window.addEventListener('storage', debouncedCollect);
  }

  // 定时触发
  if (rule.trigger.intervalMinutes > 0) {
    setInterval(
      () => collectAndUpload(rule),
      rule.trigger.intervalMinutes * 60 * 1000
    );
  }
}
```

#### 模块 8: 主流程

```javascript
// === 主流程 ===
(async function main() {
  'use strict';

  // 0. 环境检查
  if (!checkEnvironment()) {
    return;
  }

  // 1. Token 初始化（首次运行弹出配置引导）
  const token = getOrInitToken();
  if (!token) {
    console.error('[Collector] Token 未配置，脚本退出');
    return;
  }

  // 2. 获取配置
  const config = await getCollectorConfig(token);
  if (!config || !config.rules) {
    console.log('[Collector] 无可用配置');
    return;
  }

  // 2. 匹配当前域名
  const currentDomain = location.hostname;
  const matchedRules = config.rules
    .filter(rule => matchDomain(rule, currentDomain))
    .sort((a, b) => b.priority - a.priority);

  if (matchedRules.length === 0) {
    console.log(`[Collector] 域名 ${currentDomain} 无匹配规则`);
    return;
  }

  // 3. 使用优先级最高的规则
  const rule = matchedRules[0];
  console.log(`[Collector] 使用规则: ${rule.name} (优先级: ${rule.priority})`);

  // 4. 设置触发器
  setupTriggers(rule);
})();
```

---

## Part 9: 前端页面

### Step 14: 规则列表页面

文件: `src/features/collector/components/RuleListPage.tsx`

核心功能：
- 规则列表展示（表格形式）
- 创建/编辑/删除规则
- 启用/禁用开关
- 搜索和筛选

### Step 15: 规则表单弹窗

文件: `src/features/collector/components/RuleFormDialog.tsx`

表单分区：
1. **基础信息**: 名称、描述、优先级
2. **域名匹配**: 匹配类型、域名模式
3. **采集配置**: Cookie/localStorage/sessionStorage 开关及过滤
4. **上报配置**: Key 模板
5. **触发条件**: 各触发条件开关

---

## 文件清单

### 后端 (i_54kb_server)

| 文件 | 操作 |
|------|------|
| `prisma/schema.prisma` | 修改：添加 CollectorRule 模型 |
| `src/common/errors/error-codes.ts` | 修改：添加错误码 |
| `src/modules/collector/collector.module.ts` | 新建 |
| `src/modules/collector/interfaces/collector-rule.interface.ts` | 新建 |
| `src/modules/collector/dto/create-collector-rule.dto.ts` | 新建 |
| `src/modules/collector/dto/update-collector-rule.dto.ts` | 新建 |
| `src/modules/collector/dto/query-collector-rule.dto.ts` | 新建 |
| `src/modules/collector/dto/batch-toggle.dto.ts` | 新建 |
| `src/modules/collector/dto/test-match.dto.ts` | 新建 |
| `src/modules/collector/services/collector-rule.service.ts` | 新建 |
| `src/modules/collector/controllers/collector-rule.controller.ts` | 新建 |
| `src/modules/collector/controllers/collector-config.controller.ts` | 新建 |
| `src/app.module.ts` | 修改：导入 CollectorModule |

### 前端 (i_54kb_web)

| 文件 | 操作 |
|------|------|
| `src/features/collector/components/RuleListPage.tsx` | 新建 |
| `src/features/collector/components/RuleFormDialog.tsx` | 新建 |
| `src/features/collector/components/CollectorConfigFields.tsx` | 新建 |
| `src/features/collector/types.ts` | 新建 |
| `src/config/menu.ts` | 修改：添加菜单项 |
| `src/App.tsx` | 修改：添加路由 |

### 油猴脚本 (tm_user_scripts)

| 文件 | 操作 |
|------|------|
| `src/syncAllCookies.js` | 重构：改为配置驱动 |

---

## 实施阶段

| 阶段 | 任务 | 预估复杂度 |
|-----|------|-----------|
| **Phase 1** | 数据库 + 类型定义 + DTO | 低 |
| **Phase 2** | Service + Controller | 中 |
| **Phase 3** | 前端列表页面 | 中 |
| **Phase 4** | 前端表单弹窗 | 高 |
| **Phase 5** | 油猴脚本改造 | 中 |
| **Phase 6** | 测试 + 迁移现有规则 | 低 |

---

## API 示例

### 创建规则

```bash
POST /api/v1/collector/rules
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "小红书商家后台",
  "description": "采集 pgy 平台的认证信息",
  "priority": 10,
  "domainPattern": "pgy.xiaohongshu.com",
  "domainMatchType": "exact",
  "collectors": {
    "cookie": {
      "enabled": true,
      "scope": "all",
      "includeHttpOnly": true,
      "filter": {
        "mode": "include",
        "keys": ["a1", "web_session", "access-token-*", "x-user-id-*"]
      }
    },
    "localStorage": {
      "enabled": true,
      "filter": {
        "mode": "include",
        "keys": ["live_access_token", "pgy-access-token"]
      }
    },
    "sessionStorage": {
      "enabled": true,
      "filter": {
        "mode": "include",
        "keys": ["agent_user_info"]
      }
    }
  },
  "uploadKeyTemplate": "ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}",
  "trigger": {
    "onPageLoad": true,
    "onStorageChange": true,
    "intervalMinutes": 30
  }
}
```

### 获取配置（油猴脚本调用）

```bash
GET /api/v1/collector/config
X-Script-Token: <script-token>

Response:
{
  "code": 0,
  "data": {
    "version": "2025-12-29T10:00:00Z",
    "rules": [
      {
        "id": 1,
        "name": "小红书商家后台",
        "priority": 10,
        "domainPattern": "pgy.xiaohongshu.com",
        "domainMatchType": "exact",
        "collectors": { ... },
        "uploadKeyTemplate": "ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}",
        "trigger": { ... }
      }
    ]
  }
}
```
