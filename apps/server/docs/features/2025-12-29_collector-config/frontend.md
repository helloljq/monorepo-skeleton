# 采集规则配置 - 前端对接文档

> 创建日期: 2025-12-29
> 后端接口版本: v1

## 接口基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `/api/v1/collector` |
| 认证方式 | JWT Bearer Token |
| Content-Type | `application/json` |

---

## 接口清单

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/rules` | 规则列表（分页） | `collector:rule:read` |
| GET | `/rules/:id` | 规则详情 | `collector:rule:read` |
| POST | `/rules` | 创建规则 | `collector:rule:create` |
| PUT | `/rules/:id` | 更新规则 | `collector:rule:update` |
| DELETE | `/rules/:id` | 删除规则 | `collector:rule:delete` |
| PATCH | `/rules/:id/toggle` | 切换启用状态 | `collector:rule:update` |
| PATCH | `/rules/batch-toggle` | 批量切换状态 | `collector:rule:update` |
| POST | `/rules/test-match` | 域名匹配测试 | `collector:rule:read` |

---

## 接口详细说明

### 1. 获取规则列表

```
GET /rules?page=1&limit=20&isEnabled=true&search=小红书
```

**Query 参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | number | 否 | 1 | 页码，从 1 开始 |
| limit | number | 否 | 20 | 每页条数，范围 1-100 |
| isEnabled | boolean | 否 | - | 按启用状态筛选 |
| search | string | 否 | - | 模糊搜索（匹配名称和域名） |

**响应**

```json
{
  "code": 0,
  "message": "success",
  "data": [
    {
      "id": 1,
      "name": "小红书商家后台",
      "description": "采集 pgy 平台的认证信息",
      "isEnabled": true,
      "priority": 10,
      "domainPattern": "pgy.xiaohongshu.com",
      "domainMatchType": "exact",
      "collectors": { ... },
      "uploadKeyTemplate": "ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}",
      "trigger": { ... },
      "createdAt": "2025-12-29T10:00:00.000Z",
      "updatedAt": "2025-12-29T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  },
  "timestamp": 1735470000000
}
```

---

### 2. 获取规则详情

```
GET /rules/1
```

**响应**: 单个规则对象（结构同列表项）

**错误**: `18001` - 规则不存在

---

### 3. 创建规则

```
POST /rules
```

**请求体**

```json
{
  "name": "小红书商家后台",
  "description": "采集 pgy 平台的认证信息",
  "isEnabled": true,
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
        "keys": ["a1", "web_session", "access-token-*"]
      }
    },
    "localStorage": {
      "enabled": true,
      "filter": {
        "mode": "include",
        "keys": ["live_access_token"]
      }
    },
    "sessionStorage": {
      "enabled": false
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

**响应**: 创建成功的规则对象

**错误**: `18002` - 规则配置无效（含具体字段错误信息）

---

### 4. 更新规则

```
PUT /rules/1
```

**请求体**: 支持部分更新，字段同创建接口

**⚠️ 特殊响应**: 更新 `uploadKeyTemplate` 时返回警告

```json
{
  "code": 0,
  "message": "success",
  "data": { ... },
  "warning": {
    "field": "uploadKeyTemplate",
    "message": "Key 模板已变更，历史数据将无法与新数据关联"
  },
  "timestamp": 1735470000000
}
```

**前端处理要求**:
1. 提交前检测 `uploadKeyTemplate` 是否变化
2. 若变化，**必须弹窗二次确认**再提交
3. 提交后检查响应中的 `warning` 字段并展示

---

### 5. 删除规则

```
DELETE /rules/1
```

**响应**

```json
{
  "code": 0,
  "message": "success",
  "data": { "success": true },
  "timestamp": 1735470000000
}
```

**说明**: 软删除，数据可恢复

---

### 6. 切换启用状态

```
PATCH /rules/1/toggle
```

**响应**: 返回更新后的完整规则对象

---

### 7. 批量切换状态

```
PATCH /rules/batch-toggle
```

**请求体**

```json
{
  "ids": [1, 2, 3],
  "isEnabled": false
}
```

**约束**: `ids` 数组长度 1-50

**响应**

```json
{
  "code": 0,
  "data": {
    "success": true,
    "updatedCount": 3
  }
}
```

**错误**: `18003` - 批量操作超出限制

---

### 8. 域名匹配测试

```
POST /rules/test-match
```

**请求体**

```json
{
  "domain": "buyin.jinritemai.com"
}
```

**响应**

```json
{
  "code": 0,
  "data": {
    "matched": true,
    "matchedRule": {
      "id": 3,
      "name": "抖音巨量百应",
      "priority": 10,
      "domainPattern": "buyin.jinritemai.com",
      "domainMatchType": "exact"
    },
    "allMatchedRules": [
      { "id": 3, "name": "抖音巨量百应", "priority": 10 },
      { "id": 5, "name": "抖音通用", "priority": 5 }
    ]
  }
}
```

**说明**:
- `matchedRule`: 最终生效的规则（优先级最高者）
- `allMatchedRules`: 所有命中的规则（按优先级降序）

---

## 数据结构详解

### collectors 配置

```
collectors
├── cookie                         # Cookie 采集配置
│   ├── enabled: boolean           # 必填
│   ├── scope: "current" | "all"   # current=当前域名, all=主域名下所有子域名
│   ├── includeHttpOnly: boolean   # 是否包含 httpOnly Cookie
│   └── filter?: FieldFilter       # 可选，不传则采集全部
│
├── localStorage                   # localStorage 采集配置
│   ├── enabled: boolean
│   └── filter?: FieldFilter
│
└── sessionStorage                 # sessionStorage 采集配置
    ├── enabled: boolean
    └── filter?: FieldFilter
```

### FieldFilter 结构

```typescript
interface FieldFilter {
  mode: "include" | "exclude";  // include=白名单, exclude=黑名单
  keys: string[];               // 字段名列表，支持通配符 *
}
```

**通配符示例**:
- `access-token-*` → 匹配 `access-token-abc`, `access-token-123`
- `*_session` → 匹配 `web_session`, `api_session`

### trigger 配置

```typescript
interface TriggerConfig {
  onPageLoad: boolean;       // 页面加载时触发
  onStorageChange: boolean;  // Storage 变化时触发
  intervalMinutes?: number;  // 定时触发间隔（分钟），0 或不传表示不定时
}
```

### domainMatchType 类型

| 值 | 说明 | 示例 |
|---|------|------|
| `exact` | 精确匹配 | `pgy.xiaohongshu.com` 只匹配该域名 |
| `suffix` | 后缀匹配 | `.xiaohongshu.com` 匹配所有子域名 |
| `regex` | 正则匹配 | `.*\.xiaohongshu\.com$` |

---

## 字段校验规则

### 后端校验规则（提交时会校验）

| 字段 | 规则 |
|------|------|
| name | 必填，1-100 字符，会 trim |
| description | 可选，最长 500 字符 |
| priority | 0-100 整数，默认 10 |
| domainPattern | 必填，1-200 字符 |
| domainMatchType | 必填，枚举: `exact` / `suffix` / `regex` |
| collectors | **至少启用一种采集类型** |
| collectors.*.filter.keys | 1-50 项，每项 1-100 字符 |
| uploadKeyTemplate | 必填，格式 `^[a-z][a-z0-9_{}]*$`，**只允许特定变量** |
| trigger | **至少启用一种触发条件** |

### uploadKeyTemplate 允许的变量

| 变量 | 说明 | 示例值 |
|------|------|--------|
| `{domain}` | 当前域名（点替换为下划线） | `pgy_xiaohongshu_com` |
| `{deviceId}` | 设备 ID | `w2s9x58u` |
| `{accountTag}` | 账号标签 | `default` |
| `{timestamp}` | 时间戳 | `1735470000000` |

**校验示例**:
- ✅ `ck_{domain}_{deviceId}`
- ✅ `cookie_xhs_{accountTag}`
- ❌ `ck_{userId}` → 未知变量 userId
- ❌ `CK_{domain}` → 必须小写字母开头
- ❌ `ck-{domain}` → 不允许中划线

### 正则表达式安全校验

当 `domainMatchType` 为 `regex` 时，后端会校验正则安全性（防 ReDoS）：
- 禁止嵌套量词: `(a+)+`, `(a*)*`
- 禁止连续通配: `.*.*`

校验失败返回 `18002` 错误。

---

## 错误码

| 错误码 | HTTP 状态 | 说明 | 前端处理建议 |
|--------|----------|------|-------------|
| 18001 | 404 | 规则不存在 | 提示用户并返回列表页 |
| 18002 | 400 | 规则配置无效 | 解析 message 展示具体错误 |
| 18003 | 400 | 批量操作超限（最多50条） | 提示用户减少选择数量 |

**通用错误处理**:

```typescript
// 18002 错误通常包含具体字段信息
{
  "code": 18002,
  "message": "域名模式 \"pgy.xiaohongshu.com\" (exact) 已存在",
  "data": null
}
```

---

## 重要注意事项

### 1. uploadKeyTemplate 修改警告（必须实现）

这是**高风险操作**，修改会导致数据断层。

**前端必须**:
1. 编辑表单打开时，缓存原始的 `uploadKeyTemplate` 值
2. 提交前比对是否变化
3. 若变化，弹窗确认：
   > "修改 Key 模板将导致历史数据无法与新数据关联，此操作不可恢复。是否继续？"
4. 用户确认后才提交
5. 提交后检查响应的 `warning` 字段，用 Toast 展示警告消息

### 2. collectors 至少启用一项

提交前校验：`cookie.enabled || localStorage.enabled || sessionStorage.enabled` 必须为 true

建议在 UI 上：
- 三个开关全部关闭时，禁用提交按钮
- 或在最后一个开关关闭时提示"至少需要启用一种采集类型"

### 3. trigger 至少启用一项

校验：`onPageLoad || onStorageChange || (intervalMinutes > 0)` 必须为 true

### 4. filter 可选

- 若不需要过滤，可以不传 `filter` 字段，或传 `filter: null`
- 若传了 `filter`，则 `mode` 和 `keys` 都必填，且 `keys` 不能为空数组

### 5. 域名匹配测试的使用场景

- 创建规则后，使用此接口验证配置是否正确
- 排查"为什么某个域名没有采集到数据"的问题
- `allMatchedRules` 可用于展示规则冲突情况

### 6. 批量操作限制

- 单次最多 50 条
- 建议在 UI 上限制多选数量，或选择超过 50 条时提前提示

### 7. 分页参数

- `page` 从 1 开始（不是 0）
- `limit` 最大 100

---

## 类型定义参考

```typescript
// 完整类型定义，可直接使用

type DomainMatchType = 'exact' | 'suffix' | 'regex';
type FilterMode = 'include' | 'exclude';
type CookieScope = 'current' | 'all';

interface FieldFilter {
  mode: FilterMode;
  keys: string[];
}

interface CookieCollectorConfig {
  enabled: boolean;
  scope?: CookieScope;        // 默认 'all'
  includeHttpOnly?: boolean;  // 默认 true
  filter?: FieldFilter;
}

interface StorageCollectorConfig {
  enabled: boolean;
  filter?: FieldFilter;
}

interface CollectorsConfig {
  cookie?: CookieCollectorConfig;
  localStorage?: StorageCollectorConfig;
  sessionStorage?: StorageCollectorConfig;
}

interface TriggerConfig {
  onPageLoad?: boolean;       // 默认 true
  onStorageChange?: boolean;  // 默认 false
  intervalMinutes?: number;   // 默认 0
}

interface CollectorRule {
  id: number;
  name: string;
  description?: string;
  isEnabled: boolean;
  priority: number;
  domainPattern: string;
  domainMatchType: DomainMatchType;
  collectors: CollectorsConfig;
  uploadKeyTemplate: string;
  trigger: TriggerConfig;
  createdAt: string;
  updatedAt: string;
}

// 创建/更新请求体（id、createdAt、updatedAt 除外）
type CreateRuleRequest = Omit<CollectorRule, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateRuleRequest = Partial<CreateRuleRequest>;

// 列表响应
interface RuleListResponse {
  code: number;
  message: string;
  data: CollectorRule[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  timestamp: number;
}

// 单个响应（含可选警告）
interface RuleResponse {
  code: number;
  message: string;
  data: CollectorRule;
  warning?: {
    field: string;
    message: string;
  };
  timestamp: number;
}

// 批量切换请求
interface BatchToggleRequest {
  ids: number[];
  isEnabled: boolean;
}

// 域名测试
interface TestMatchRequest {
  domain: string;
}

interface TestMatchResponse {
  code: number;
  data: {
    matched: boolean;
    matchedRule: Pick<CollectorRule, 'id' | 'name' | 'priority' | 'domainPattern' | 'domainMatchType'> | null;
    allMatchedRules: Array<Pick<CollectorRule, 'id' | 'name' | 'priority'>>;
  };
}
```
