# Dictionary API 前端使用指南

## 📖 概述

Dictionary（字典）模块用于管理系统中的**枚举类型数据**和**配置项**，支持大 JSON 配置的高效缓存优化。

**适用场景**：

- 用户属性枚举（性别、状态、角色等）
- 业务状态管理（订单状态、支付方式等）
- 系统配置项（App 配置、主题设置、功能开关等）
- 地区分类、行业标签等

**核心优势**：

- 🚀 **高性能**：服务端 Redis 缓存 1 小时 + 前端本地缓存
- 📦 **版本控制**：支持 version + configHash，前端可精准判断是否需要更新
- 🔄 **热更新**：修改枚举值无需重启服务或发版
- 🌍 **国际化友好**：label 字段可支持多语言

---

## 🚀 快速开始

### 基础用法（推荐用于枚举类型）

```typescript
// 获取性别字典（简单枚举）
const response = await fetch("/v1/dictionaries/type/gender?isEnabled=true");
const { data } = await response.json();

// 数据格式
[
  { id: 1, key: "MALE", value: 1, label: "男", sort: 1 },
  { id: 2, key: "FEMALE", value: 2, label: "女", sort: 2 },
];
```

### 高级用法（推荐用于大配置 JSON）

```typescript
// Step 1: 先查元数据（轻量级，~500B）
const metaResponse = await fetch(
  "/v1/dictionaries/type/app_config/meta?isEnabled=true",
);
const { data: metaList } = await metaResponse.json();

// Step 2: 对比 hash，仅在变化时拉取完整数据
const remoteMeta = metaList.find((m) => m.key === "IOS_V2_0");
const localHash = localStorage.getItem("app_config:hash");

if (remoteMeta.configHash !== localHash) {
  // 配置有更新，拉取完整数据
  const fullResponse = await fetch(
    "/v1/dictionaries/type/app_config?isEnabled=true",
  );
  const { data: configs } = await fullResponse.json();

  // 更新本地缓存
  localStorage.setItem("app_config:hash", remoteMeta.configHash);
  localStorage.setItem("app_config:data", JSON.stringify(configs));
} else {
  // 使用本地缓存
  const cachedData = JSON.parse(localStorage.getItem("app_config:data"));
}
```

---

## 📚 API 接口列表

### 1. 获取字典列表（分页）

```http
GET /v1/dictionaries?page=1&limit=10&type=gender&isEnabled=true
```

**Query 参数**：

- `page` (number, 可选): 页码，默认 1
- `limit` (number, 可选): 每页数量（1-100），默认 10
- `type` (string, 可选): 字典类型
- `isEnabled` (boolean, 可选): 是否只返回启用的字典

**响应**：

```json
{
  "code": 0,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

---

### 2. 按类型获取字典（带缓存）⭐

```http
GET /v1/dictionaries/type/:type?isEnabled=true
```

**最常用接口**，服务端有 1 小时 Redis 缓存。

**示例**：

```bash
GET /v1/dictionaries/type/gender?isEnabled=true
GET /v1/dictionaries/type/order_status
```

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "type": "gender",
      "key": "MALE",
      "value": 1,
      "label": "男",
      "description": null,
      "sort": 1,
      "isEnabled": true,
      "version": null,
      "configHash": "5d41402abc4b2a76b9719d911017c592",
      "createdAt": "2024-12-24T07:00:00.000Z",
      "updatedAt": "2024-12-24T07:00:00.000Z"
    }
  ]
}
```

---

### 3. 获取字典元数据（轻量级）✨

```http
GET /v1/dictionaries/type/:type/meta?isEnabled=true
```

**用于前端缓存优化**，仅返回 `key + version + configHash`，数据量极小（~500B）。

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "key": "IOS_V2_0",
      "version": "2.0.0",
      "configHash": "5d41402abc4b2a76b9719d911017c592"
    }
  ]
}
```

---

### 4. 获取字典详情

```http
GET /v1/dictionaries/:id
```

---

### 5. 创建字典（需要权限）

```http
POST /v1/dictionaries
```

**权限要求**：`dictionary:create`

**Body**：

```json
{
  "type": "app_config",
  "key": "IOS_V2_0",
  "value": {
    "apiUrl": "https://api.example.com",
    "timeout": 30000,
    "features": {
      "enablePush": true,
      "enableBiometric": false
    }
  },
  "label": "iOS v2.0 配置",
  "description": "iOS 应用 v2.0 版本配置",
  "sort": 0,
  "isEnabled": true,
  "version": "2.0.0"
}
```

**字段说明**：

- `type`: 字典类型，小写字母+数字+下划线（如 `app_config`）
- `key`: 字典键，大写字母+数字+下划线（如 `IOS_V2_0`）
- `value`: 字典值，支持 JSON object / string / number / boolean / null
- `version` (可选): 配置版本号
- `configHash`: **自动生成**，无需传入

---

### 6. 批量创建字典（需要权限）

```http
POST /v1/dictionaries/bulk
```

**用于初始化数据**，一次性创建 1-100 条记录。

**Body**：

```json
{
  "items": [
    {
      "type": "gender",
      "key": "MALE",
      "value": 1,
      "label": "男",
      "sort": 1
    },
    {
      "type": "gender",
      "key": "FEMALE",
      "value": 2,
      "label": "女",
      "sort": 2
    }
  ]
}
```

---

### 7. 更新字典（需要权限）

```http
PATCH /v1/dictionaries/:id
```

**权限要求**：`dictionary:update`

**注意**：`type` 和 `key` 不可修改，更新 `value` 会自动重新计算 `configHash`。

---

### 8. 删除字典（需要权限）

```http
DELETE /v1/dictionaries/:id
```

**权限要求**：`dictionary:delete`

**软删除**，可后续恢复，会自动失效相关缓存。

---

## 💡 使用场景与最佳实践

### 场景 1：简单枚举（性别、状态等）

**特征**：数据量小（< 1KB），变化频率低

```typescript
// 封装成 Hook（React 示例）
function useDictionary(type: string) {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch(`/v1/dictionaries/type/${type}?isEnabled=true`)
      .then((res) => res.json())
      .then(({ data }) => setData(data));
  }, [type]);

  return data;
}

// 使用
const genders = useDictionary("gender");
```

**前端展示**：

```tsx
<Select>
  {genders.map((item) => (
    <Option key={item.key} value={item.value}>
      {item.label}
    </Option>
  ))}
</Select>
```

---

### 场景 2：App 配置（大 JSON）

**特征**：数据量较大（10-50KB），需要版本控制和缓存优化

```typescript
// 封装成服务（推荐）
class DictionaryService {
  private cachePrefix = "dict_cache:";

  /**
   * 获取配置（带本地缓存优化）
   */
  async getConfig(type: string, key: string) {
    const cacheKey = `${this.cachePrefix}${type}:${key}`;

    // 1. 先查元数据
    const metaRes = await fetch(
      `/v1/dictionaries/type/${type}/meta?isEnabled=true`,
    );
    const { data: metaList } = await metaRes.json();
    const remoteMeta = metaList.find((m) => m.key === key);

    if (!remoteMeta) {
      throw new Error(`Config not found: ${type}:${key}`);
    }

    // 2. 对比本地缓存 hash
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { hash, data } = JSON.parse(cached);
      if (hash === remoteMeta.configHash) {
        console.log("✅ 使用本地缓存");
        return data;
      }
    }

    // 3. 拉取完整配置
    console.log("🔄 拉取最新配置");
    const fullRes = await fetch(`/v1/dictionaries/type/${type}?isEnabled=true`);
    const { data: configs } = await fullRes.json();
    const config = configs.find((c) => c.key === key);

    // 4. 更新本地缓存
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        hash: remoteMeta.configHash,
        data: config,
        timestamp: Date.now(),
      }),
    );

    return config;
  }
}

// 使用
const dictService = new DictionaryService();
const appConfig = await dictService.getConfig("app_config", "IOS_V2_0");
```

---

### 场景 3：多语言支持

```typescript
// 根据语言获取不同的 label
const language = navigator.language; // 'zh-CN' or 'en-US'

// 方案 A: value 存储多语言
{
  "type": "gender",
  "key": "MALE",
  "value": {
    "code": 1,
    "labels": {
      "zh-CN": "男",
      "en-US": "Male"
    }
  }
}

// 方案 B: 不同 type 对应不同语言
GET /v1/dictionaries/type/gender_zh_cn
GET /v1/dictionaries/type/gender_en_us
```

---

## 🎯 TypeScript 类型定义

```typescript
/**
 * 字典项
 */
export interface Dictionary {
  id: number;
  type: string;
  key: string;
  value: unknown; // JSON 格式，可以是 object | string | number | boolean | null
  label: string;
  description: string | null;
  sort: number;
  isEnabled: boolean;
  version: string | null;
  configHash: string | null;
  createdAt: string; // ISO 8601
  updatedAt: string;
  deletedAt: string | null;
  deletedById: number | null;
  deleteReason: string | null;
}

/**
 * 字典元数据（轻量级）
 */
export interface DictionaryMeta {
  key: string;
  version: string | null;
  configHash: string | null;
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 标准响应
 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}
```

---

## 📊 性能对比

| 场景           | 不使用 meta 接口  | 使用 meta 接口优化    | 节省             |
| -------------- | ----------------- | --------------------- | ---------------- |
| **首次加载**   | 拉取完整配置 50KB | 拉取完整配置 50KB     | -                |
| **配置未变化** | 每次都拉取 50KB   | 只拉取 meta 500B      | **99% ↓**        |
| **配置已变化** | 拉取 50KB         | meta 500B + 完整 50KB | 多 500B (可忽略) |

**建议**：

- **小枚举**（< 10KB）：直接用 `/type/:type`，无需 meta 优化
- **大配置**（10-50KB）：优先用 `/type/:type/meta` + 本地缓存

---

## ❓ 常见问题

### Q1: 什么时候用 `isEnabled=true`？

**A**: 前端业务逻辑建议始终加 `isEnabled=true`，只获取启用的字典。后台管理界面可以不加，显示全部数据。

---

### Q2: configHash 是怎么计算的？

**A**: 服务端自动计算 `value` 字段的 MD5 hash，前端**无需关心**计算逻辑，只需对比 hash 是否变化即可。

---

### Q3: version 和 configHash 有什么区别？

**A**:

- `version`: 人工维护的版本号（如 `1.0.0`），用于业务标识
- `configHash`: 系统自动生成的 hash，用于精准判断数据是否变化

**建议**: 前端优先用 `configHash` 判断是否更新。

---

### Q4: 如何清除前端本地缓存？

**A**:

```typescript
// 清除特定类型缓存
localStorage.removeItem("dict_cache:app_config:IOS_V2_0");

// 清除所有字典缓存
Object.keys(localStorage)
  .filter((key) => key.startsWith("dict_cache:"))
  .forEach((key) => localStorage.removeItem(key));
```

---

### Q5: 如何处理并发请求？

**A**: 使用 Promise 缓存避免重复请求

```typescript
class DictionaryService {
  private requestCache = new Map<string, Promise<any>>();

  async getConfig(type: string) {
    const key = `${type}`;

    if (!this.requestCache.has(key)) {
      const promise = fetch(`/v1/dictionaries/type/${type}`)
        .then((res) => res.json())
        .finally(() => this.requestCache.delete(key));

      this.requestCache.set(key, promise);
    }

    return this.requestCache.get(key);
  }
}
```

---

## 🔗 相关链接

- **Swagger 文档**: http://localhost:8100/api
- **健康检查**: http://localhost:8100/health
- **源码**: `src/modules/dictionary/`

---

## 📝 更新日志

### 2024-12-24

- ✨ 新增 `version` 和 `configHash` 字段支持
- ✨ 新增 `/type/:type/meta` 轻量级接口
- 📝 创建前端使用指南文档

---

**有问题？** 联系后端团队或查看 Swagger 文档获取最新 API 定义。
