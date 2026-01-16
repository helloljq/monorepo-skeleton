# 小红书模块 API 设计

> 创建日期: 2025-12-26
> 版本: v1.0

## 一、API 概览

### 1.1 模块划分

| 模块     | 前缀                  | 说明                                   |
| -------- | --------------------- | -------------------------------------- |
| 代理     | `/v1/xhs/proxy`       | 实时代理小红书 API                     |
| 直播     | `/v1/xhs/live`        | 直播数据代理                           |
| 同步     | `/v1/xhs/sync`        | 数据同步管理                           |
| 订单     | `/v1/xhs/orders`      | 本地订单列表与详情                     |
| 订单统计 | `/v1/xhs/order-stats` | 订单统计与汇总（独立前缀避免路由冲突） |
| 直播统计 | `/v1/xhs/stats`       | 直播统计查询                           |
| 账号     | `/v1/xhs/accounts`    | 账号管理                               |

### 1.2 通用参数

所有接口支持 `_account` 参数指定账号：

```
GET /v1/xhs/live/overview?room_id=xxx&_account=default
```

- 默认值：`default`
- 可选值：配置中心中配置的账号标识

---

## 二、账号管理 API

### 2.1 获取账号列表

```
GET /v1/xhs/accounts
```

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "tag": "default",
      "name": "默认账号",
      "expiresAt": "2025-03-01T00:00:00.000Z",
      "isExpired": false,
      "daysUntilExpiry": 65
    },
    {
      "tag": "backup",
      "name": "备用账号",
      "expiresAt": "2025-01-15T00:00:00.000Z",
      "isExpired": false,
      "daysUntilExpiry": 20
    }
  ]
}
```

### 2.2 检查账号状态

```
GET /v1/xhs/accounts/:tag/status
```

**响应**：

```json
{
  "code": 0,
  "data": {
    "tag": "default",
    "name": "默认账号",
    "isValid": true,
    "expiresAt": "2025-03-01T00:00:00.000Z",
    "daysUntilExpiry": 65,
    "lastUpdated": "2025-12-26T10:00:00.000Z",
    "userId": "60b13baa0000000001000c63"
  }
}
```

### 2.3 刷新账号缓存

```
POST /v1/xhs/accounts/:tag/refresh
```

**说明**：清除内存缓存，下次请求时从配置中心重新加载

**响应**：

```json
{
  "code": 0,
  "message": "缓存已刷新"
}
```

---

## 三、直播代理 API

### 3.1 获取直播数据

```
GET /v1/xhs/live/:api
```

**路径参数**：

| 参数         | 说明           | 对应小红书 API                                          |
| ------------ | -------------- | ------------------------------------------------------- |
| `overview`   | 直播概览数据   | `/api/sns/red/live/manager/v1/data/room/metric`         |
| `products`   | 商品销售数据   | `/api/sns/red/live/manager/v1/data/goods/info`          |
| `viewers`    | 观众排行       | `/api/sns/red/live/manager/v1/data/room/user_rank`      |
| `traffic`    | 流量来源       | `/api/sns/red/live/manager/v1/data/room/traffic_detail` |
| `goods-list` | 直播间商品列表 | `/api/sns/red/live/manager/v2/mall/goods_list`          |
| `replay`     | 直播复盘数据   | `/api/sns/red/live/replay/room/data`                    |
| `timeline`   | 实时数据曲线   | `/api/sns/red/live/manager/v1/data/room/metric_by_ts`   |

**Query 参数**：

| 参数       | 必填 | 说明                     |
| ---------- | ---- | ------------------------ |
| `room_id`  | 是   | 直播间 ID                |
| `_account` | 否   | 账号标识，默认 `default` |

**请求示例**：

```
GET /v1/xhs/live/overview?room_id=6789012345&_account=default
```

**响应**：透传小红书 API 返回的 `data` 部分

```json
{
  "code": 0,
  "data": {
    "room_id": "6789012345",
    "duration": 3600,
    "peak_online": 1234,
    "total_viewers": 5678,
    "total_sales": 12345.67,
    ...
  }
}
```

### 3.2 执行直播操作

```
POST /v1/xhs/live/action
```

**请求体**：

```json
{
  "action": "start-explain",
  "payload": {
    "room_id": "6789012345",
    "goods_id": "abc123"
  },
  "accountTag": "default"
}
```

**支持的操作**：

| action          | 说明         | 必需 payload          |
| --------------- | ------------ | --------------------- |
| `start-explain` | 开始讲解商品 | `room_id`, `goods_id` |
| `stop-explain`  | 停止讲解     | `room_id`             |
| `popup-card`    | 弹出商品卡片 | `room_id`, `goods_id` |
| `close-card`    | 关闭商品卡片 | `room_id`             |

**响应**：

```json
{
  "code": 0,
  "data": {
    "success": true
  }
}
```

### 3.3 通用代理

```
POST /v1/xhs/proxy
```

**说明**：高级用户可直接代理任意小红书 API

**请求体**：

```json
{
  "method": "GET",
  "api": "/api/sns/red/live/manager/v1/data/room/metric",
  "params": {
    "room_id": "6789012345"
  },
  "data": null,
  "accountTag": "default",
  "platform": "live-assistant"
}
```

**platform 可选值**：

| 值               | 域名                             |
| ---------------- | -------------------------------- |
| `live-assistant` | `live-assistant.xiaohongshu.com` |
| `pgy`            | `pgy.xiaohongshu.com`            |
| `redlive`        | `redlive.xiaohongshu.com`        |
| `ark`            | `ark.xiaohongshu.com`            |

---

## 四、数据同步 API

### 4.1 触发订单同步

```
POST /v1/xhs/sync/orders
```

**请求体**：

```json
{
  "accountTag": "default",
  "startTime": "2025-12-01T00:00:00.000Z",
  "endTime": "2025-12-26T23:59:59.999Z"
}
```

| 字段         | 必填 | 说明                             |
| ------------ | ---- | -------------------------------- |
| `accountTag` | 否   | 账号标识，默认 `default`         |
| `startTime`  | 否   | 开始时间，默认从上次同步水位开始 |
| `endTime`    | 否   | 结束时间，默认当前时间           |

**响应**：

```json
{
  "code": 0,
  "data": {
    "synced": 156,
    "startTime": "2025-12-01T00:00:00.000Z",
    "endTime": "2025-12-26T23:59:59.999Z",
    "duration": 12500
  }
}
```

### 4.2 触发订单状态更新

```
POST /v1/xhs/sync/orders/status
```

**说明**：检查未完成订单的状态变更（退款等）

**请求体**：

```json
{
  "accountTag": "default"
}
```

**响应**：

```json
{
  "code": 0,
  "data": {
    "checked": 45,
    "updated": 3
  }
}
```

### 4.3 触发直播统计同步

```
POST /v1/xhs/sync/lives
```

**请求体**：

```json
{
  "accountTag": "default",
  "startTime": "2025-12-01T00:00:00.000Z",
  "endTime": "2025-12-26T23:59:59.999Z"
}
```

**响应**：

```json
{
  "code": 0,
  "data": {
    "synced": 12,
    "startTime": "2025-12-01T00:00:00.000Z",
    "endTime": "2025-12-26T23:59:59.999Z"
  }
}
```

### 4.4 获取同步状态

```
GET /v1/xhs/sync/status
```

**Query 参数**：

| 参数         | 必填 | 说明                     |
| ------------ | ---- | ------------------------ |
| `accountTag` | 否   | 账号标识，默认 `default` |

**响应**：

```json
{
  "code": 0,
  "data": {
    "order": {
      "lastSyncTime": "2025-12-26T10:00:00.000Z",
      "lastSyncCount": 23
    },
    "live": {
      "lastSyncTime": "2025-12-26T04:00:00.000Z",
      "lastSyncCount": 2
    }
  }
}
```

---

## 五、订单查询 API

### 5.1 订单列表

```
GET /v1/xhs/orders
```

**Query 参数**：

| 参数         | 类型   | 必填 | 说明                           |
| ------------ | ------ | ---- | ------------------------------ |
| `page`       | number | 否   | 页码，默认 1                   |
| `limit`      | number | 否   | 每页条数，默认 20，最大 100    |
| `accountTag` | string | 否   | 账号标识                       |
| `startTime`  | string | 否   | 开始时间（ISO 8601）           |
| `endTime`    | string | 否   | 结束时间                       |
| `status`     | string | 否   | 订单状态                       |
| `roomId`     | string | 否   | 直播间 ID                      |
| `keyword`    | string | 否   | 搜索关键词（商品名、买家昵称） |

**请求示例**：

```
GET /v1/xhs/orders?page=1&limit=20&startTime=2025-12-01T00:00:00Z&status=已完成
```

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "packageId": "PKG123456789",
      "orderStatus": "已完成",
      "payTime": "2025-12-25T14:30:00.000Z",
      "skuName": "商品名称",
      "skuImage": "https://...",
      "skuPrice": 99.0,
      "quantity": 1,
      "userPayAmount": 89.0,
      "commissionAmount": 8.9,
      "userNickname": "买家昵称",
      "shopName": "店铺名称",
      "roomId": "6789012345",
      "liveTitle": "直播标题"
    }
  ],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### 5.2 订单详情

```
GET /v1/xhs/orders/:packageId
```

**响应**：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "packageId": "PKG123456789",
    "orderStatus": "已完成",
    "payTime": "2025-12-25T14:30:00.000Z",
    "skuName": "商品名称",
    "skuImage": "https://...",
    "skuPrice": 99.0,
    "quantity": 1,
    "userPayAmount": 89.0,
    "platformDiscount": 10.0,
    "sellerIncome": 80.1,
    "commissionAmount": 8.9,
    "commissionRate": 0.1,
    "refundAmount": 0,
    "userId": "user123",
    "userNickname": "买家昵称",
    "sellerId": "seller456",
    "shopName": "店铺名称",
    "roomId": "6789012345",
    "liveTitle": "直播标题",
    "liveStartTime": "2025-12-25T10:00:00.000Z",
    "planType": "普通计划",
    "createdAt": "2025-12-25T14:30:00.000Z",
    "updatedAt": "2025-12-26T10:00:00.000Z"
  }
}
```

### 5.3 订单统计

> **路由说明**：统计类接口独立为 `/order-stats` 前缀，避免与 `/orders/:packageId` 路由冲突。

```
GET /v1/xhs/order-stats
```

**Query 参数**：

| 参数         | 类型   | 必填 | 说明                             |
| ------------ | ------ | ---- | -------------------------------- |
| `accountTag` | string | 否   | 账号标识                         |
| `startTime`  | string | 否   | 开始时间                         |
| `endTime`    | string | 否   | 结束时间                         |
| `groupBy`    | string | 否   | 分组维度：`day`, `week`, `month` |

**响应**：

```json
{
  "code": 0,
  "data": {
    "summary": {
      "totalOrders": 156,
      "totalSales": 15678.9,
      "totalCommission": 1567.89,
      "avgOrderValue": 100.51,
      "refundCount": 3,
      "refundAmount": 289.0
    },
    "trend": [
      {
        "date": "2025-12-25",
        "orders": 23,
        "sales": 2345.67,
        "commission": 234.57
      },
      {
        "date": "2025-12-24",
        "orders": 18,
        "sales": 1876.54,
        "commission": 187.65
      }
    ]
  }
}
```

### 5.4 按直播场次汇总

```
GET /v1/xhs/order-stats/by-live
```

**Query 参数**：

| 参数         | 类型   | 必填 | 说明     |
| ------------ | ------ | ---- | -------- |
| `accountTag` | string | 否   | 账号标识 |
| `startTime`  | string | 否   | 开始时间 |
| `endTime`    | string | 否   | 结束时间 |
| `page`       | number | 否   | 页码     |
| `limit`      | number | 否   | 每页条数 |

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "roomId": "6789012345",
      "liveTitle": "12.25 年货节专场",
      "liveStartTime": "2025-12-25T10:00:00.000Z",
      "orderCount": 45,
      "totalSales": 4567.89,
      "totalCommission": 456.79,
      "refundCount": 1,
      "refundAmount": 99.0
    }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 5.5 佣金统计

```
GET /v1/xhs/order-stats/commission
```

**Query 参数**：

| 参数         | 类型   | 必填 | 说明                         |
| ------------ | ------ | ---- | ---------------------------- |
| `accountTag` | string | 否   | 账号标识                     |
| `startTime`  | string | 否   | 开始时间                     |
| `endTime`    | string | 否   | 结束时间                     |
| `groupBy`    | string | 否   | 分组：`day`, `week`, `month` |

**响应**：

```json
{
  "code": 0,
  "data": {
    "total": 15678.9,
    "settled": 12345.67,
    "pending": 3333.23,
    "byPeriod": [
      {
        "period": "2025-12",
        "amount": 8765.43,
        "orderCount": 89
      },
      {
        "period": "2025-11",
        "amount": 6913.47,
        "orderCount": 67
      }
    ]
  }
}
```

---

## 六、直播统计 API

### 6.1 直播列表

```
GET /v1/xhs/stats/lives
```

**Query 参数**：

| 参数         | 类型   | 必填 | 说明     |
| ------------ | ------ | ---- | -------- |
| `page`       | number | 否   | 页码     |
| `limit`      | number | 否   | 每页条数 |
| `accountTag` | string | 否   | 账号标识 |
| `startTime`  | string | 否   | 开始时间 |
| `endTime`    | string | 否   | 结束时间 |

**响应**：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "roomId": "6789012345",
      "liveTitle": "12.25 年货节专场",
      "liveCover": "https://...",
      "startTime": "2025-12-25T10:00:00.000Z",
      "endTime": "2025-12-25T14:00:00.000Z",
      "duration": 14400,
      "peakViewers": 1234,
      "totalViewers": 5678,
      "totalSales": 12345.67,
      "commissionAmount": 1234.57,
      "orderCount": 45,
      "payConversionRate": 0.0079
    }
  ],
  "meta": {
    "total": 30,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

### 6.2 直播详情

```
GET /v1/xhs/stats/lives/:roomId
```

**响应**：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "roomId": "6789012345",
    "liveTitle": "12.25 年货节专场",
    "liveCover": "https://...",
    "startTime": "2025-12-25T10:00:00.000Z",
    "endTime": "2025-12-25T14:00:00.000Z",
    "duration": 14400,
    "peakViewers": 1234,
    "totalViewers": 5678,
    "avgViewDuration": 180,
    "newFollowers": 56,
    "likeCount": 2345,
    "commentCount": 567,
    "shareCount": 89,
    "goodsClickUv": 890,
    "goodsClickPv": 1234,
    "addCartCount": 234,
    "addCartUv": 189,
    "orderCount": 45,
    "orderUv": 42,
    "totalSales": 12345.67,
    "validSales": 12246.67,
    "commissionAmount": 1234.57,
    "refundCount": 1,
    "refundAmount": 99.0,
    "refundRate": 0.0222,
    "clickConversionRate": 0.1568,
    "payConversionRate": 0.0079
  }
}
```

### 6.3 直播汇总统计

```
GET /v1/xhs/stats/summary
```

**Query 参数**：

| 参数         | 类型   | 必填 | 说明     |
| ------------ | ------ | ---- | -------- |
| `accountTag` | string | 否   | 账号标识 |
| `startTime`  | string | 否   | 开始时间 |
| `endTime`    | string | 否   | 结束时间 |

**响应**：

```json
{
  "code": 0,
  "data": {
    "liveCount": 30,
    "totalDuration": 432000,
    "avgDuration": 14400,
    "totalViewers": 123456,
    "avgViewers": 4115,
    "totalSales": 345678.9,
    "avgSales": 11522.63,
    "totalCommission": 34567.89,
    "avgCommission": 1152.26,
    "avgConversionRate": 0.0082
  }
}
```

---

## 七、错误响应

### 7.1 错误码列表

> **注意**：小红书模块使用 17000-17999 错误码段（15000-15999 已被 ScriptUpload 模块占用）

| 错误码 | 说明               |
| ------ | ------------------ |
| 17000  | 小红书账号未配置   |
| 17001  | Cookie 已过期      |
| 17002  | Cookie 无效        |
| 17100  | 小红书接口返回错误 |
| 17101  | 请求失败           |
| 17102  | 请求频率限制       |
| 17200  | 同步进行中         |
| 17201  | 同步失败           |

### 7.2 错误响应示例

```json
{
  "code": 17001,
  "message": "账号 \"default\" 的认证已过期，请更新 Cookie",
  "data": {
    "expiredAt": "2025-12-20T00:00:00.000Z",
    "accountTag": "default"
  },
  "timestamp": 1735200000000
}
```

---

## 八、权限设计

> **集成说明**：权限控制将集成到现有 RBAC 系统（参考 `docs/features/2025-12-24-rbac/`）。
> 需要在 `Permission` 表中添加以下权限记录，并通过 `@RequirePermissions()` 装饰器保护接口。

### 8.1 权限码

| 权限码               | 说明                         | 父权限 |
| -------------------- | ---------------------------- | ------ |
| `xhs`                | 小红书模块（父权限）         | -      |
| `xhs:read`           | 读取小红书数据（代理、查询） | `xhs`  |
| `xhs:write`          | 执行小红书操作（讲解、弹窗） | `xhs`  |
| `xhs:sync`           | 触发数据同步                 | `xhs`  |
| `xhs:account:manage` | 管理账号（刷新缓存）         | `xhs`  |

### 8.2 接口权限映射

| 接口类型      | 所需权限                  | 装饰器示例                                                                          |
| ------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| 账号列表/状态 | `xhs:read`                | `@RequirePermissions('xhs:read')`                                                   |
| 账号缓存刷新  | `xhs:account:manage`      | `@RequirePermissions('xhs:account:manage')`                                         |
| 直播数据代理  | `xhs:read`                | `@RequirePermissions('xhs:read')`                                                   |
| 直播操作      | `xhs:write`               | `@RequirePermissions('xhs:write')`                                                  |
| 通用代理      | `xhs:read` 或 `xhs:write` | `@RequirePermissions('xhs:read')` (GET) / `@RequirePermissions('xhs:write')` (POST) |
| 同步触发      | `xhs:sync`                | `@RequirePermissions('xhs:sync')`                                                   |
| 订单查询      | `xhs:read`                | `@RequirePermissions('xhs:read')`                                                   |
| 直播统计查询  | `xhs:read`                | `@RequirePermissions('xhs:read')`                                                   |

### 8.3 权限初始化 SQL

```sql
-- 在 Permission 表中插入小红书模块权限
INSERT INTO permissions (code, name, description, parent_code, sort_order)
VALUES
  ('xhs', '小红书模块', '小红书数据集成模块', NULL, 100),
  ('xhs:read', '读取数据', '读取小红书数据（代理、查询）', 'xhs', 1),
  ('xhs:write', '执行操作', '执行小红书直播操作（讲解、弹窗）', 'xhs', 2),
  ('xhs:sync', '数据同步', '触发订单和直播统计数据同步', 'xhs', 3),
  ('xhs:account:manage', '账号管理', '管理小红书账号（刷新缓存）', 'xhs', 4);
```

---

## 九、使用示例

### 9.1 前端获取直播数据

```typescript
// 获取正在直播的房间概览
const overview = await fetch("/v1/xhs/live/overview?room_id=6789012345", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log("当前在线:", overview.data.current_online);
console.log("总销售额:", overview.data.total_sales);
```

### 9.2 获取订单佣金统计

```typescript
// 获取本月佣金统计
const stats = await fetch(
  "/v1/xhs/order-stats/commission?startTime=2025-12-01T00:00:00Z&groupBy=day",
  {
    headers: { Authorization: `Bearer ${token}` },
  },
).then((r) => r.json());

console.log("本月总佣金:", stats.data.total);
console.log("已结算:", stats.data.settled);
```

### 9.3 手动触发同步

```typescript
// 同步最近30天订单
const result = await fetch("/v1/xhs/sync/orders", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    accountTag: "default",
    startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  }),
}).then((r) => r.json());

console.log("同步完成:", result.data.synced, "条");
```

---

## 十、前端对接注意事项

### 10.1 快速入口

- **Swagger 文档**: `http://localhost:8100/api` - 可在线调试所有接口
- **API 文档**: `docs/features/2025-12-26-xiaohongshu/api.md`（本文档）
- **数据结构**: `docs/features/2025-12-26-xiaohongshu/schema.md`

### 10.2 权限要求

| 功能          | 所需权限             |
| ------------- | -------------------- |
| 订单/直播查询 | `xhs:read`           |
| 代理接口      | `xhs:proxy`          |
| 触发同步      | `xhs:sync`           |
| 账号管理      | `xhs:account:manage` |

> ⚠️ 无权限时返回 HTTP 403，需要联系管理员分配角色

### 10.3 两种数据来源

| 类型         | 接口前缀                                        | 特点                         |
| ------------ | ----------------------------------------------- | ---------------------------- |
| **代理接口** | `/xhs/live/*`, `/xhs/proxy`                     | 实时数据，直接透传小红书 API |
| **本地查询** | `/xhs/orders`, `/xhs/order-stats`, `/xhs/stats` | 历史数据，需先同步           |

**使用建议**：

- 直播中显示实时数据 → 用代理接口
- 历史报表、佣金统计 → 用本地查询接口

### 10.4 特殊处理

#### 同步接口 (POST `/xhs/sync/*`)

- 可能耗时较长（几秒到几分钟）
- **409 错误**（code: 17200）：同步进行中，建议显示 loading 并轮询 `/sync/status`
- 定时任务每小时自动同步，一般无需手动触发

```typescript
// 触发同步并轮询状态
async function syncAndWait(accountTag = "default") {
  try {
    await fetch("/v1/xhs/sync/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountTag }),
    });
  } catch (e) {
    if (e.code === 17200) {
      // 同步进行中，轮询状态
      return pollSyncStatus(accountTag);
    }
    throw e;
  }
}
```

#### 日期参数

- 统一使用 **ISO 8601** 格式：`2025-12-01T00:00:00.000Z`
- 服务端返回的时间也是 ISO 8601 格式
- 前端发送时可用 `new Date().toISOString()`

#### 金额字段

- 类型为 `number`（JavaScript）
- 精度保留 2 位小数
- 显示时建议用 `toFixed(2)` 或格式化库（如 `Intl.NumberFormat`）

```typescript
// 金额格式化示例
const formatAmount = (amount: number) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(
    amount,
  );
// 输出: ¥1,234.56
```

### 10.5 常见错误码速查

| Code  | 含义           | 建议处理               |
| ----- | -------------- | ---------------------- |
| 17000 | 账号未配置     | 提示管理员配置账号     |
| 17001 | Cookie 过期    | 提示更新 Cookie        |
| 17002 | Cookie 无效    | 检查 Cookie 格式       |
| 17100 | 小红书接口错误 | 显示原始错误信息       |
| 17102 | 请求频率限制   | 稍后重试，建议加防抖   |
| 17200 | 同步进行中     | 显示 loading，轮询状态 |

### 10.6 多账号支持

- 所有接口支持 `accountTag` 参数（默认 `default`）
- 如有多个小红书账号，需先调 `GET /xhs/accounts` 获取列表
- 前端可实现账号切换器

```typescript
// 获取账号列表
const accounts = await fetch("/v1/xhs/accounts", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

// 渲染账号选择器
accounts.data.forEach((acc) => {
  console.log(
    `${acc.name} (${acc.tag}) - ${acc.isExpired ? "已过期" : `剩余 ${acc.daysUntilExpiry} 天`}`,
  );
});
```

### 10.7 分页规范

所有列表接口返回统一的分页格式：

```json
{
  "code": 0,
  "data": [...],
  "meta": {
    "total": 156,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

- `page` 从 1 开始
- `limit` 默认 20，最大 100
- 前端可根据 `totalPages` 渲染分页组件
