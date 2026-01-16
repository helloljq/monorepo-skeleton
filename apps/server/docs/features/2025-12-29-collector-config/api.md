# API 设计

> 创建日期: 2025-12-29

## 接口概览

### 规则管理 API（需 JWT 认证）

| 方法   | 路径                               | 说明             |
| ------ | ---------------------------------- | ---------------- |
| GET    | `/v1/collector/rules`              | 规则列表（分页） |
| GET    | `/v1/collector/rules/:id`          | 规则详情         |
| POST   | `/v1/collector/rules`              | 创建规则         |
| PUT    | `/v1/collector/rules/:id`          | 更新规则         |
| DELETE | `/v1/collector/rules/:id`          | 删除规则         |
| PATCH  | `/v1/collector/rules/:id/toggle`   | 切换启用状态     |
| PATCH  | `/v1/collector/rules/batch-toggle` | 批量切换启用状态 |
| POST   | `/v1/collector/rules/test-match`   | 域名匹配测试     |

### 配置下发 API（需 X-Script-Token 认证）

| 方法 | 路径                   | 说明               |
| ---- | ---------------------- | ------------------ |
| GET  | `/v1/collector/config` | 获取所有启用的规则 |

---

## 详细接口定义

### 1. 获取规则列表

```
GET /v1/collector/rules
```

**请求参数** (Query)

| 参数      | 类型    | 必填 | 默认值 | 说明               |
| --------- | ------- | ---- | ------ | ------------------ |
| page      | number  | 否   | 1      | 页码               |
| limit     | number  | 否   | 20     | 每页条数（1-100）  |
| isEnabled | boolean | 否   | -      | 按启用状态筛选     |
| search    | string  | 否   | -      | 搜索（名称、域名） |

**响应示例**

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
      },
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
  "timestamp": 1703836800000
}
```

---

### 2. 获取规则详情

```
GET /v1/collector/rules/:id
```

**路径参数**

| 参数 | 类型   | 说明    |
| ---- | ------ | ------- |
| id   | number | 规则 ID |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "name": "小红书商家后台"
    // ... 完整规则对象
  },
  "timestamp": 1703836800000
}
```

**错误码**

| 错误码 | HTTP 状态 | 说明       |
| ------ | --------- | ---------- |
| 18001  | 404       | 规则不存在 |

---

### 3. 创建规则

```
POST /v1/collector/rules
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

**字段校验规则**

| 字段                      | 规则                              |
| ------------------------- | --------------------------------- |
| name                      | 必填，1-100 字符                  |
| description               | 可选，最长 500 字符               |
| priority                  | 0-100，默认 10                    |
| domainPattern             | 必填，1-200 字符                  |
| domainMatchType           | 必填，枚举: exact/suffix/regex    |
| collectors                | 至少启用一种采集类型              |
| collectors.\*.filter.keys | 至少 1 项，最多 50 项             |
| uploadKeyTemplate         | 必填，格式: `^[a-z][a-z0-9_{}]*$` |
| trigger                   | 至少启用一种触发条件              |

**collectors 配置结构说明**

```
collectors
├── cookie                    # Cookie 采集配置
│   ├── enabled: boolean      # 是否启用
│   ├── scope: "current"|"all"# 采集范围
│   │   ├── current           #   只采集当前精确域名
│   │   └── all               #   采集主域名下所有子域名
│   ├── includeHttpOnly       # 是否包含 httpOnly Cookie
│   └── filter                # 字段过滤（可选）
│       ├── mode: "include"   #   白名单模式
│       │     └── "exclude"   #   黑名单模式
│       └── keys: string[]    #   字段列表，支持通配符 *
│
├── localStorage              # localStorage 采集配置
│   ├── enabled: boolean
│   └── filter                # 同上
│
└── sessionStorage            # sessionStorage 采集配置
    ├── enabled: boolean
    └── filter                # 同上
```

**uploadKeyTemplate 可用变量**

| 变量           | 说明                       | 示例值                |
| -------------- | -------------------------- | --------------------- |
| `{domain}`     | 当前域名（点替换为下划线） | `pgy_xiaohongshu_com` |
| `{deviceId}`   | 设备 ID                    | `w2s9x58u`            |
| `{accountTag}` | 账号标签                   | `default`             |
| `{timestamp}`  | 时间戳                     | `1703836800000`       |

示例: `ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}` → `ck_pgy_xiaohongshu_com_w2s9x58u_default`

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1
    // ... 完整规则对象
  },
  "timestamp": 1703836800000
}
```

---

### 4. 更新规则

```
PUT /v1/collector/rules/:id
```

**请求体**

支持部分更新，字段同创建接口。

**错误码**

| 错误码 | HTTP 状态 | 说明         |
| ------ | --------- | ------------ |
| 18001  | 404       | 规则不存在   |
| 18002  | 400       | 规则配置无效 |

---

### 5. 删除规则

```
DELETE /v1/collector/rules/:id
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "success": true
  },
  "timestamp": 1703836800000
}
```

---

### 6. 切换启用状态

```
PATCH /v1/collector/rules/:id/toggle
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "isEnabled": false
    // ... 完整规则对象
  },
  "timestamp": 1703836800000
}
```

---

### 7. 批量切换启用状态

```
PATCH /v1/collector/rules/batch-toggle
```

**请求体**

```json
{
  "ids": [1, 2, 3],
  "isEnabled": false
}
```

**字段说明**

| 字段      | 类型     | 必填 | 说明                    |
| --------- | -------- | ---- | ----------------------- |
| ids       | number[] | 是   | 规则 ID 列表（1-50 个） |
| isEnabled | boolean  | 是   | 目标状态                |

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "success": true,
    "updatedCount": 3
  },
  "timestamp": 1703836800000
}
```

**使用场景**: 活动期间需要临时关闭多个规则，或批量恢复启用。

---

### 8. 域名匹配测试

```
POST /v1/collector/rules/test-match
```

**请求体**

```json
{
  "domain": "buyin.jinritemai.com"
}
```

**响应示例**

```json
{
  "code": 0,
  "message": "success",
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
      {
        "id": 3,
        "name": "抖音巨量百应",
        "priority": 10
      }
    ]
  },
  "timestamp": 1703836800000
}
```

**字段说明**

| 字段            | 说明                               |
| --------------- | ---------------------------------- |
| matched         | 是否有规则命中                     |
| matchedRule     | 最终生效的规则（优先级最高者）     |
| allMatchedRules | 所有命中的规则列表（按优先级降序） |

**使用场景**: 创建规则后验证配置是否正确，排查为什么某个域名没有采集数据。

---

### 9. 获取采集配置（油猴脚本调用）

```
GET /v1/collector/config
```

**请求头**

| 头部           | 必填 | 说明                                 |
| -------------- | ---- | ------------------------------------ |
| X-Script-Token | 是   | 脚本认证令牌                         |
| If-None-Match  | 否   | 上次请求返回的 ETag 值，用于缓存验证 |

**响应头**

| 头部          | 说明                                    |
| ------------- | --------------------------------------- |
| ETag          | 配置内容的 MD5 哈希值，格式: `"hash值"` |
| Cache-Control | `public, max-age=60`                    |

**缓存机制**

- 服务端使用 Redis 缓存配置数据（TTL 60秒）
- 客户端可使用 `If-None-Match` 头发送上次的 ETag 值
- 若配置未变更，服务端返回 `304 Not Modified`，无响应体
- 若配置已变更，服务端返回 `200 OK` 及新的配置数据

**响应示例**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "version": "\"a1b2c3d4e5f6...\"",
    "rules": [
      {
        "id": 1,
        "name": "小红书商家后台",
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
          }
        },
        "uploadKeyTemplate": "ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}",
        "trigger": {
          "onPageLoad": true,
          "onStorageChange": true,
          "intervalMinutes": 30
        }
      }
    ]
  },
  "timestamp": 1703836800000
}
```

**说明**

- 只返回 `isEnabled=true` 的规则
- 按 `priority` 降序排列
- 不包含 `description`、`createdAt`、`updatedAt` 等管理字段
- `version` 字段值与 ETag 响应头一致，用于客户端判断配置是否更新
- 建议客户端缓存 ETag 值，下次请求时通过 `If-None-Match` 头传递，以减少数据传输

**错误码**

| 错误码 | HTTP 状态 | 说明                |
| ------ | --------- | ------------------- |
| 15001  | 503       | 脚本功能未启用      |
| 15002  | 401       | 缺少 X-Script-Token |
| 15003  | 401       | Token 无效          |

---

## 错误码汇总

| 错误码 | HTTP 状态 | 说明                                                            |
| ------ | --------- | --------------------------------------------------------------- |
| 15001  | 503       | SCRIPT_FEATURE_DISABLED - 脚本功能未启用                        |
| 15002  | 401       | SCRIPT_TOKEN_MISSING - 缺少认证 Token                           |
| 15003  | 401       | SCRIPT_TOKEN_INVALID - Token 无效                               |
| 18001  | 404       | COLLECTOR_RULE_NOT_FOUND - 规则不存在                           |
| 18002  | 400       | COLLECTOR_RULE_INVALID - 规则配置无效                           |
| 18003  | 400       | COLLECTOR_BATCH_LIMIT_EXCEEDED - 批量操作超出限制（最多 50 条） |

---

## 油猴脚本调用示例

```javascript
// 配置缓存 Key
const CONFIG_CACHE_KEY = "CS_COLLECTOR_CONFIG";
const CONFIG_ETAG_KEY = "CS_COLLECTOR_ETAG";

// 获取配置（带 ETag 缓存支持）
async function getCollectorConfig() {
  const cachedEtag = GM_getValue(CONFIG_ETAG_KEY, null);
  const cachedConfig = GM_getValue(CONFIG_CACHE_KEY, null);

  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: "GET",
      url: "https://i.54kb.com/v1/collector/config",
      headers: {
        "X-Script-Token": "your-32-char-token-here",
        ...(cachedEtag ? { "If-None-Match": cachedEtag } : {}),
      },
      onload: function (response) {
        // 304 Not Modified - 使用缓存
        if (response.status === 304) {
          console.log("[Collector] 配置未变更，使用缓存");
          resolve(cachedConfig);
          return;
        }

        // 200 OK - 更新缓存
        if (response.status === 200) {
          const data = JSON.parse(response.responseText);
          const etag =
            response.responseHeaders.match(/etag:\s*"([^"]+)"/i)?.[1];

          if (etag) {
            GM_setValue(CONFIG_ETAG_KEY, `"${etag}"`);
          }
          GM_setValue(CONFIG_CACHE_KEY, data.data);

          resolve(data.data);
          return;
        }

        reject(new Error(`HTTP ${response.status}`));
      },
      onerror: function (error) {
        console.error("获取配置失败:", error);
        // 网络错误时尝试使用缓存
        if (cachedConfig) {
          console.warn("[Collector] 网络错误，使用缓存配置");
          resolve(cachedConfig);
        } else {
          reject(error);
        }
      },
    });
  });
}
```
