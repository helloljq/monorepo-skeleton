# 配置中心客户端使用指南

> 更新日期: 2025-12-25

## 目录

- [快速开始](#快速开始)
- [命名空间管理](#命名空间管理)
- [配置项操作](#配置项操作)
- [客户端缓存策略](#客户端缓存策略)
- [WebSocket 实时推送](#websocket-实时推送)
- [加密配置处理](#加密配置处理)
- [批量操作](#批量操作)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)

---

## 快速开始

### 基本配置

```typescript
const API_BASE_URL = 'http://localhost:8100/api/v1';
const WS_URL = 'ws://localhost:8100/config';

// 认证 Token（从登录接口获取）
const ACCESS_TOKEN = 'your-access-token';
```

### 第一个配置项

```typescript
// 1. 创建命名空间
const namespace = await createNamespace({
  name: 'app_settings',
  displayName: '应用设置',
  description: '应用全局配置',
  isEnabled: true,
});

// 2. 创建配置项
const config = await createConfig('app_settings', {
  key: 'feature_flags',
  value: {
    newCheckout: true,
    darkMode: false,
  },
  valueType: 'JSON',
  description: '功能开关',
  isEncrypted: false,
  isEnabled: true,
});

// 3. 读取配置
const featureFlags = await getConfig('app_settings', 'feature_flags');
console.log(featureFlags.value); // { newCheckout: true, darkMode: false }
```

---

## 命名空间管理

### 创建命名空间

```typescript
async function createNamespace(data: {
  name: string;
  displayName: string;
  description?: string;
  isEnabled?: boolean;
}) {
  const response = await fetch(`${API_BASE_URL}/config/namespaces`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  return response.json();
}
```

### 查询命名空间列表

```typescript
async function getNamespaces(params?: {
  page?: number;
  limit?: number;
  isEnabled?: boolean;
}) {
  const query = new URLSearchParams(params as any).toString();
  const response = await fetch(
    `${API_BASE_URL}/config/namespaces?${query}`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    },
  );

  return response.json();
}
```

### 更新命名空间

```typescript
async function updateNamespace(
  name: string,
  data: {
    displayName?: string;
    description?: string;
    isEnabled?: boolean;
  },
) {
  const response = await fetch(`${API_BASE_URL}/config/namespaces/${name}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  return response.json();
}
```

---

## 配置项操作

### 创建配置

```typescript
async function createConfig(namespace: string, data: {
  key: string;
  value: any;
  valueType: 'JSON' | 'STRING' | 'NUMBER' | 'BOOLEAN';
  description?: string;
  isEncrypted?: boolean;
  isEnabled?: boolean;
  jsonSchema?: object;
}) {
  const response = await fetch(`${API_BASE_URL}/config/${namespace}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(data),
  });

  return response.json();
}
```

### 读取配置

```typescript
async function getConfig(namespace: string, key: string) {
  const response = await fetch(
    `${API_BASE_URL}/config/${namespace}/${key}`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    },
  );

  return response.json();
}
```

### 更新配置

```typescript
async function updateConfig(
  namespace: string,
  key: string,
  data: {
    value?: any;
    description?: string;
    isEnabled?: boolean;
    jsonSchema?: object;
  },
) {
  const response = await fetch(
    `${API_BASE_URL}/config/${namespace}/${key}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify(data),
    },
  );

  return response.json();
}
```

### 删除配置

```typescript
async function deleteConfig(namespace: string, key: string) {
  const response = await fetch(
    `${API_BASE_URL}/config/${namespace}/${key}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    },
  );

  return response.status === 204;
}
```

---

## 客户端缓存策略

### 使用 Meta 接口进行缓存校验

```typescript
interface ConfigCache {
  value: any;
  version: number;
  configHash: string;
  updatedAt: string;
}

class ConfigClient {
  private cache = new Map<string, ConfigCache>();

  /**
   * 带缓存校验的配置读取
   */
  async getConfigWithCache(namespace: string, key: string): Promise<any> {
    const cacheKey = `${namespace}:${key}`;
    const cached = this.cache.get(cacheKey);

    // 1. 获取元数据（轻量级，~100B）
    const meta = await this.getConfigMeta(namespace, key);

    // 2. 对比 hash，判断缓存是否有效
    if (cached && cached.configHash === meta.configHash) {
      console.log('Cache hit:', cacheKey);
      return cached.value;
    }

    // 3. 缓存失效或不存在，拉取完整配置
    console.log('Cache miss:', cacheKey);
    const config = await getConfig(namespace, key);

    // 4. 更新缓存
    this.cache.set(cacheKey, {
      value: config.data.value,
      version: config.data.version,
      configHash: config.data.configHash,
      updatedAt: config.data.updatedAt,
    });

    return config.data.value;
  }

  private async getConfigMeta(namespace: string, key: string) {
    const response = await fetch(
      `${API_BASE_URL}/config/${namespace}/${key}/meta`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      },
    );

    return response.json().then((res) => res.data);
  }

  /**
   * 清除本地缓存
   */
  clearCache(namespace?: string, key?: string) {
    if (namespace && key) {
      this.cache.delete(`${namespace}:${key}`);
    } else if (namespace) {
      for (const cacheKey of this.cache.keys()) {
        if (cacheKey.startsWith(`${namespace}:`)) {
          this.cache.delete(cacheKey);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}
```

### 使用示例

```typescript
const client = new ConfigClient();

// 第一次读取（从服务器）
const value1 = await client.getConfigWithCache('app_settings', 'feature_flags');
// Cache miss: app_settings:feature_flags

// 第二次读取（命中缓存）
const value2 = await client.getConfigWithCache('app_settings', 'feature_flags');
// Cache hit: app_settings:feature_flags

// 配置更新后，meta 中的 configHash 会变化，自动重新拉取
const value3 = await client.getConfigWithCache('app_settings', 'feature_flags');
// Cache miss: app_settings:feature_flags （hash 不匹配）
```

**性能收益**：对于大型配置（10-50KB），Meta 接口可节省 **99%** 带宽。

---

## WebSocket 实时推送

### 建立连接

```typescript
import io from 'socket.io-client';

const socket = io(WS_URL, {
  auth: {
    token: ACCESS_TOKEN,
  },
});

socket.on('connect', () => {
  console.log('WebSocket 已连接');
});

socket.on('disconnect', () => {
  console.log('WebSocket 已断开');
});
```

### 订阅命名空间

```typescript
// 订阅配置变更
socket.emit('config:subscribe', {
  namespaces: ['app_settings', 'feature_flags'],
});

socket.on('config:subscribe', (response) => {
  if (response.success) {
    console.log('已订阅:', response.subscribed);
  } else {
    console.error('订阅失败:', response.error);
  }
});
```

### 监听配置变更

```typescript
socket.on('config:changed', (data) => {
  console.log('配置已变更:', data);
  /*
  {
    namespace: 'app_settings',
    key: 'feature_flags',
    version: 3,
    configHash: 'abc123...',
    changeType: 'UPDATE',
    changedAt: '2025-12-25T10:00:00Z'
  }
  */

  // 清除本地缓存，下次读取时会重新拉取
  client.clearCache(data.namespace, data.key);

  // 或者立即拉取最新值
  client.getConfigWithCache(data.namespace, data.key);
});
```

### 完整示例

```typescript
class RealtimeConfigClient extends ConfigClient {
  private socket: ReturnType<typeof io>;

  constructor() {
    super();
    this.socket = io(WS_URL, { auth: { token: ACCESS_TOKEN } });
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.socket.on('connect', () => {
      console.log('WebSocket 已连接');
      // 重连后重新订阅
      this.subscribe(['app_settings', 'feature_flags']);
    });

    this.socket.on('config:changed', (data) => {
      console.log(`配置变更: ${data.namespace}:${data.key} v${data.version}`);
      this.clearCache(data.namespace, data.key);
      this.emit('configChanged', data);
    });
  }

  subscribe(namespaces: string[]) {
    this.socket.emit('config:subscribe', { namespaces });
  }

  unsubscribe(namespaces: string[]) {
    this.socket.emit('config:unsubscribe', { namespaces });
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// 使用
const realtimeClient = new RealtimeConfigClient();
realtimeClient.on('configChanged', async (data) => {
  // 自动重新加载配置
  const newValue = await realtimeClient.getConfigWithCache(
    data.namespace,
    data.key,
  );
  console.log('已更新配置:', newValue);
});
```

---

## 加密配置处理

### 创建加密配置

```typescript
await createConfig('third_party', {
  key: 'api_key',
  value: 'sk-1234567890abcdef',
  valueType: 'STRING',
  description: '第三方 API 密钥',
  isEncrypted: true, // 启用加密
  isEnabled: true,
});
```

### 读取加密配置

```typescript
// 服务端自动解密
const config = await getConfig('third_party', 'api_key');
console.log(config.data.value); // 'sk-1234567890abcdef' (已解密)
console.log(config.data.isEncrypted); // true
```

> **注意**：加密配置的值在数据库中以加密形式存储，API 返回时已自动解密。客户端无需处理加密逻辑。

---

## 批量操作

### 批量获取配置

```typescript
async function batchGetConfigs(namespace: string, keys: string[]) {
  const keysParam = keys.join(',');
  const response = await fetch(
    `${API_BASE_URL}/config/${namespace}/batch?keys=${keysParam}`,
    {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    },
  );

  return response.json();
}

// 使用
const configs = await batchGetConfigs('app_settings', [
  'feature_flags',
  'theme',
  'limits',
]);
```

### 批量创建/更新配置

```typescript
async function batchUpsertConfigs(
  namespace: string,
  items: Array<{
    key: string;
    value: any;
    valueType: string;
    description?: string;
    isEncrypted?: boolean;
    isEnabled?: boolean;
  }>,
) {
  const response = await fetch(`${API_BASE_URL}/config/${namespace}/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ items }),
  });

  return response.json();
}

// 使用
const result = await batchUpsertConfigs('app_settings', [
  {
    key: 'max_upload_size',
    value: 10485760,
    valueType: 'NUMBER',
    description: '最大上传大小（字节）',
  },
  {
    key: 'allowed_extensions',
    value: ['.jpg', '.png', '.pdf'],
    valueType: 'JSON',
    description: '允许的文件扩展名',
  },
]);

console.log(result.data);
/*
{
  total: 2,
  successful: 2,
  failed: 0,
  results: [
    { key: 'max_upload_size', success: true, data: {...} },
    { key: 'allowed_extensions', success: true, data: {...} }
  ]
}
*/
```

---

## 错误处理

### 统一错误处理

```typescript
async function safeGetConfig(namespace: string, key: string) {
  try {
    const response = await getConfig(namespace, key);

    if (response.code !== 0) {
      throw new Error(`配置中心错误: ${response.message}`);
    }

    return response.data;
  } catch (error) {
    console.error(`获取配置失败 ${namespace}:${key}`, error);

    // 返回默认值
    return getDefaultConfig(namespace, key);
  }
}
```

### 常见错误码

| 错误码 | 说明 | 处理建议 |
|-------|------|---------|
| 14000 | 命名空间不存在 | 先创建命名空间 |
| 14001 | 命名空间已存在 | 使用其他名称或更新现有命名空间 |
| 14010 | 配置项不存在 | 先创建配置项 |
| 14011 | 配置项已存在 | 使用更新接口而非创建 |
| 14012 | Schema 校验失败 | 检查配置值是否符合 Schema 定义 |
| 14014 | 加密失败 | 检查服务端是否配置加密密钥 |

---

## 最佳实践

### 1. 命名规范

```typescript
// ✅ 推荐
namespace: 'app_settings'
key: 'max_upload_size'

// ❌ 避免
namespace: 'AppSettings' // 不使用大写
key: 'MaxUploadSize'     // 不使用驼峰
```

### 2. 合理使用缓存

```typescript
// ✅ 推荐：高频读取配置使用缓存
const featureFlags = await client.getConfigWithCache('app', 'features');

// ❌ 避免：低频或实时性要求高的配置不使用缓存
const currentPromotion = await getConfig('marketing', 'current_promo');
```

### 3. JSON Schema 校验

```typescript
// ✅ 推荐：为复杂配置添加 Schema
await createConfig('app', {
  key: 'user_limits',
  value: {
    maxFileSize: 10485760,
    maxFriends: 5000,
  },
  jsonSchema: {
    type: 'object',
    properties: {
      maxFileSize: { type: 'number', minimum: 0 },
      maxFriends: { type: 'number', minimum: 0, maximum: 10000 },
    },
    required: ['maxFileSize', 'maxFriends'],
  },
});

// ❌ 避免：复杂配置不添加 Schema（容易出错）
await createConfig('app', {
  key: 'user_limits',
  value: { maxFileSize: '10MB' }, // 类型错误，应该是 number
});
```

### 4. 监听配置变更

```typescript
// ✅ 推荐：使用 WebSocket 实时监听
const client = new RealtimeConfigClient();
client.on('configChanged', (data) => {
  if (data.namespace === 'app' && data.key === 'feature_flags') {
    reloadFeatures();
  }
});

// ❌ 避免：轮询（浪费资源）
setInterval(async () => {
  const config = await getConfig('app', 'feature_flags');
  updateFeatures(config.data.value);
}, 10000);
```

### 5. 敏感配置加密

```typescript
// ✅ 推荐：敏感信息启用加密
await createConfig('third_party', {
  key: 'api_secret',
  value: 'sk-xxxxx',
  isEncrypted: true, // 加密存储
});

// ❌ 避免：敏感信息明文存储
await createConfig('third_party', {
  key: 'api_secret',
  value: 'sk-xxxxx',
  isEncrypted: false, // 危险！
});
```

### 6. 配置版本控制

```typescript
// ✅ 推荐：重要变更前查看历史
const history = await getConfigHistory('app', 'feature_flags');
console.log('历史版本:', history.data);

// 发生问题时快速回滚
await rollbackConfig('app', 'feature_flags', 2, '回滚到稳定版本');
```

---

## 完整示例：React Hook

```typescript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export function useConfig<T = any>(namespace: string, key: string): {
  value: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const config = await getConfig(namespace, key);
      setValue(config.data.value);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();

    // 监听配置变更
    const socket = io(WS_URL, { auth: { token: ACCESS_TOKEN } });

    socket.on('connect', () => {
      socket.emit('config:subscribe', { namespaces: [namespace] });
    });

    socket.on('config:changed', (data) => {
      if (data.namespace === namespace && data.key === key) {
        fetchConfig(); // 自动重新加载
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [namespace, key]);

  return { value, loading, error, refetch: fetchConfig };
}

// 使用
function App() {
  const { value: features, loading } = useConfig('app', 'feature_flags');

  if (loading) return <div>Loading...</div>;

  return <div>{features.newCheckout ? <NewCheckout /> : <OldCheckout />}</div>;
}
```

---

## 相关文档

- [配置中心功能设计](./task.md)
- [配置中心实现方案](./implementation_plan.md)
- [API 接口文档](http://localhost:8100/api) - Swagger UI

---

## 常见问题

### 1. 如何处理配置不存在的情况？

使用默认值 + 错误处理：

```typescript
const DEFAULT_CONFIG = { enabled: false, threshold: 100 };

try {
  const config = await getConfig('app', 'feature_flags');
  return config.data.value;
} catch (error) {
  console.warn('配置不存在，使用默认值');
  return DEFAULT_CONFIG;
}
```

### 2. 如何在多环境（dev/staging/prod）下使用？

通过环境变量区分：

```typescript
const NAMESPACE = process.env.NODE_ENV === 'production'
  ? 'app_prod'
  : 'app_dev';

const config = await getConfig(NAMESPACE, 'feature_flags');
```

### 3. 配置更新后客户端多久能感知？

- **WebSocket 订阅**：实时（< 100ms）
- **轮询 Meta 接口**：取决于轮询间隔
- **无缓存直接读取**：立即

### 4. 批量操作的事务性如何？

批量操作**不保证原子性**，允许部分成功。响应中包含每个项的操作结果。

---

**更新日志**：
- 2025-12-25: 初版发布
