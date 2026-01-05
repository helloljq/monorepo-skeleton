# 小红书模块数据库设计

> 创建日期: 2025-12-26
> 版本: v1.0

## 一、设计原则

### 1.1 存储策略

| 数据类型 | 存储方式 | 原因 |
|----------|----------|------|
| Cookie/认证 | 配置中心 `script-data` | 统一管理，支持热更新 |
| 订单数据 | 本地 PostgreSQL | 历史数据不可重新获取，佣金核算必需 |
| 直播统计 | 本地 PostgreSQL | 复盘分析，接口有时间窗口限制 |
| 商品数据 | 不存储 | 实时获取即可，变化频繁 |
| 同步水位 | 本地 PostgreSQL | 记录同步进度 |

### 1.2 字段设计原则

- **金额字段**：使用 `Decimal(12, 2)`，禁止 Float
- **时间字段**：统一 UTC，使用 `DateTime`
- **原始数据**：`rawData` 字段存储完整 JSON，防止字段遗漏
- **多账号支持**：所有表包含 `accountTag` 字段

---

## 二、Prisma Schema

```prisma
// ==================== 小红书订单 ====================
model XhsOrder {
  id                      Int       @id @default(autoincrement())

  // === 账号标识 ===
  accountTag              String    @db.VarChar(50)    // 账号标识：default, backup 等

  // === 订单核心 ===
  packageId               String    @db.VarChar(100)   // 订单号（小红书的 package_id）
  orderStatus             String    @db.VarChar(50)    // 订单状态：待发货、已发货、已完成、已退款等
  payTime                 DateTime?                    // 支付时间

  // === 商品信息 ===
  itemId                  String?   @db.VarChar(100)   // 商品 ID
  skuId                   String?   @db.VarChar(100)   // SKU ID
  skuName                 String?   @db.VarChar(500)   // 商品名称
  skuImage                String?   @db.VarChar(500)   // 商品图片
  skuPrice                Decimal?  @db.Decimal(10, 2) // 商品单价
  quantity                Int       @default(1)        // 购买数量

  // === 金额信息 ===
  userPayAmount           Decimal?  @db.Decimal(10, 2) // 用户实付金额
  platformDiscount        Decimal?  @db.Decimal(10, 2) // 平台优惠金额
  sellerIncome            Decimal?  @db.Decimal(10, 2) // 卖家实收金额
  commissionAmount        Decimal?  @db.Decimal(10, 2) // 达人佣金金额
  commissionRate          Decimal?  @db.Decimal(5, 4)  // 佣金比例（如 0.2000 = 20%）
  refundAmount            Decimal?  @db.Decimal(10, 2) // 退款金额

  // === 买家信息 ===
  userId                  String?   @db.VarChar(100)   // 买家用户 ID
  userNickname            String?   @db.VarChar(200)   // 买家昵称

  // === 卖家信息 ===
  sellerId                String?   @db.VarChar(100)   // 卖家 ID
  shopName                String?   @db.VarChar(200)   // 店铺名称

  // === 直播关联 ===
  roomId                  String?   @db.VarChar(100)   // 直播间 ID
  liveTitle               String?   @db.VarChar(500)   // 直播标题
  liveStartTime           DateTime?                    // 直播开始时间

  // === 扩展信息 ===
  planType                String?   @db.VarChar(50)    // 计划类型
  rawData                 Json?                        // 原始 JSON 数据（保底）

  // === 同步信息 ===
  syncedAt                DateTime  @default(now())    // 首次同步时间

  // === 时间戳 ===
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // === 软删除 ===
  deletedAt               DateTime?                    // 软删除时间
  deletedById             Int?                         // 删除操作者 ID
  deleteReason            String?   @db.VarChar(500)   // 删除原因

  // === 约束与索引 ===
  @@unique([accountTag, packageId])                   // 同账号下订单号唯一
  @@index([accountTag, payTime])                      // 按账号+支付时间查询
  @@index([accountTag, roomId])                       // 按账号+直播间查询
  @@index([accountTag, orderStatus])                  // 按账号+状态查询
  @@index([orderStatus])                              // 全局状态查询（用于状态更新）
  @@index([deletedAt])                                // 软删除过滤索引
  @@map("xhs_orders")
}

// ==================== 小红书直播统计 ====================
model XhsLiveStats {
  id                      Int       @id @default(autoincrement())

  // === 账号标识 ===
  accountTag              String    @db.VarChar(50)

  // === 直播标识 ===
  roomId                  String    @db.VarChar(100)   // 直播间 ID

  // === 直播基本信息 ===
  liveTitle               String?   @db.VarChar(500)   // 直播标题
  liveCover               String?   @db.VarChar(500)   // 直播封面
  startTime               DateTime?                    // 开始时间
  endTime                 DateTime?                    // 结束时间
  duration                Int?                         // 直播时长（秒）

  // === 观看数据 ===
  peakViewers             Int?                         // 峰值在线人数
  totalViewers            Int?                         // 总观看人数（UV）
  avgViewDuration         Int?                         // 平均观看时长（秒）
  newFollowers            Int?                         // 新增关注数

  // === 互动数据 ===
  likeCount               Int?                         // 点赞数
  commentCount            Int?                         // 评论数
  shareCount              Int?                         // 分享数
  giftCount               Int?                         // 礼物数

  // === 商品数据 ===
  goodsClickUv            Int?                         // 商品点击人数
  goodsClickPv            Int?                         // 商品点击次数
  addCartCount            Int?                         // 加购数量
  addCartUv               Int?                         // 加购人数

  // === 成交数据 ===
  orderCount              Int?                         // 订单数
  orderUv                 Int?                         // 下单人数
  totalSales              Decimal?  @db.Decimal(12, 2) // 总销售额
  validSales              Decimal?  @db.Decimal(12, 2) // 有效销售额（扣除退款）
  commissionAmount        Decimal?  @db.Decimal(12, 2) // 佣金总额

  // === 退款数据 ===
  refundCount             Int?                         // 退款订单数
  refundAmount            Decimal?  @db.Decimal(12, 2) // 退款金额
  refundRate              Decimal?  @db.Decimal(5, 4)  // 退款率

  // === 转化率 ===
  clickConversionRate     Decimal?  @db.Decimal(5, 4)  // 点击转化率
  payConversionRate       Decimal?  @db.Decimal(5, 4)  // 支付转化率

  // === 原始数据 ===
  rawData                 Json?                        // 原始 JSON 数据

  // === 时间戳 ===
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // === 约束与索引 ===
  @@unique([accountTag, roomId])                      // 同账号下直播间唯一
  @@index([accountTag, startTime])                    // 按账号+开始时间查询
  @@index([startTime])                                // 全局时间查询
  @@map("xhs_live_stats")
}

// ==================== 同步水位记录 ====================
model XhsSyncWatermark {
  id                      Int       @id @default(autoincrement())

  // === 标识 ===
  accountTag              String    @db.VarChar(50)    // 账号标识
  syncType                String    @db.VarChar(50)    // 同步类型：order, live

  // === 水位信息 ===
  lastSyncTime            DateTime                     // 上次同步到的时间点
  lastSyncId              String?   @db.VarChar(100)   // 上次同步到的 ID（可选）
  lastSyncCount           Int?                         // 上次同步的数量

  // === 错误记录（用于排查同步问题）===
  lastSyncError           String?   @db.Text           // 上次同步错误信息
  consecutiveErrors       Int       @default(0)        // 连续错误次数（成功后重置为 0）

  // === 时间戳 ===
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt

  // === 约束 ===
  @@unique([accountTag, syncType])
  @@map("xhs_sync_watermarks")
}
```

---

## 三、表设计说明

### 3.1 XhsOrder（订单表）

**核心用途**：
- 佣金核算：统计达人佣金收入
- 退款追踪：监控订单状态变更
- 直播复盘：按直播场次分析销售
- 财务记录：完整的交易历史

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `accountTag` | 支持多账号，不同账号数据隔离 |
| `packageId` | 小红书订单号，同账号下唯一 |
| `orderStatus` | 订单状态，用于追踪退款 |
| `commissionAmount` | 达人佣金，核心统计字段 |
| `roomId` | 关联直播间，用于按场次汇总 |
| `rawData` | 存储完整原始 JSON，防止字段遗漏 |

**状态值枚举**（参考）：
- 待付款
- 待发货
- 已发货
- 已完成
- 已退款
- 已关闭

### 3.2 XhsLiveStats（直播统计表）

**核心用途**：
- 直播复盘：分析各场直播表现
- 趋势分析：对比历史数据
- 效果评估：转化率、ROI 计算

**关键字段说明**：

| 字段 | 说明 |
|------|------|
| `roomId` | 直播间唯一标识 |
| `duration` | 直播时长，单位秒 |
| `totalViewers` | 总观看 UV |
| `totalSales` | 总销售额 |
| `validSales` | 有效销售额（扣除退款） |
| `commissionAmount` | 该场直播总佣金 |
| `payConversionRate` | 支付转化率 |

**为什么不需要软删除**：

直播统计数据属于「事实表」（Fact Table），记录的是已发生的历史事实，具有以下特点：
1. **不可变性**：直播结束后统计数据不再变化
2. **无业务删除需求**：不存在「撤销直播」或「隐藏直播」的业务场景
3. **审计完整性**：财务复盘需要完整的历史数据，删除会破坏审计链

如果需要标记异常数据，建议添加 `isValid` 或 `remark` 字段，而非软删除。

### 3.3 XhsSyncWatermark（同步水位表）

**核心用途**：
- 记录同步进度，避免重复拉取
- 支持断点续传
- 异常恢复时定位
- 追踪同步错误，便于排查问题

**同步类型**：
- `order`：订单同步
- `live`：直播统计同步

**错误记录字段**：
- `lastSyncError`：记录最后一次同步失败的错误信息
- `consecutiveErrors`：连续失败次数，成功后重置为 0；可用于触发告警（如连续失败 3 次）

---

## 四、索引设计

### 4.1 XhsOrder 索引

| 索引 | 字段 | 用途 |
|------|------|------|
| 唯一索引 | `(accountTag, packageId)` | 订单去重 |
| 复合索引 | `(accountTag, payTime)` | 按账号+时间范围查询 |
| 复合索引 | `(accountTag, roomId)` | 按账号+直播场次查询 |
| 复合索引 | `(accountTag, orderStatus)` | 按账号+状态查询 |
| 单字段索引 | `orderStatus` | 全局状态更新（定时任务） |

### 4.2 XhsLiveStats 索引

| 索引 | 字段 | 用途 |
|------|------|------|
| 唯一索引 | `(accountTag, roomId)` | 直播去重 |
| 复合索引 | `(accountTag, startTime)` | 按账号+时间范围查询 |
| 单字段索引 | `startTime` | 全局时间范围查询 |

---

## 五、查询场景

### 5.1 订单查询

```typescript
// 1. 按时间范围查询订单
const orders = await prisma.xhsOrder.findMany({
  where: {
    accountTag: 'default',
    payTime: {
      gte: startDate,
      lte: endDate,
    },
  },
  orderBy: { payTime: 'desc' },
});

// 2. 按直播场次汇总
const summary = await prisma.xhsOrder.groupBy({
  by: ['roomId', 'liveTitle'],
  where: { accountTag: 'default' },
  _sum: {
    userPayAmount: true,
    commissionAmount: true,
  },
  _count: { id: true },
});

// 3. 佣金统计（按月）
const commission = await prisma.$queryRaw`
  SELECT
    DATE_TRUNC('month', pay_time) as month,
    SUM(commission_amount) as total_commission,
    COUNT(*) as order_count
  FROM xhs_orders
  WHERE account_tag = 'default'
    AND pay_time >= ${startDate}
  GROUP BY DATE_TRUNC('month', pay_time)
  ORDER BY month DESC
`;

// 4. 查询待更新状态的订单
const pendingOrders = await prisma.xhsOrder.findMany({
  where: {
    orderStatus: { notIn: ['已完成', '已关闭', '已退款'] },
    payTime: { gte: thirtyDaysAgo },
  },
});
```

### 5.2 直播统计查询

```typescript
// 1. 最近直播列表
const lives = await prisma.xhsLiveStats.findMany({
  where: { accountTag: 'default' },
  orderBy: { startTime: 'desc' },
  take: 20,
});

// 2. 按时间范围统计
const stats = await prisma.xhsLiveStats.aggregate({
  where: {
    accountTag: 'default',
    startTime: { gte: startDate, lte: endDate },
  },
  _sum: {
    totalViewers: true,
    totalSales: true,
    commissionAmount: true,
  },
  _avg: {
    payConversionRate: true,
    duration: true,
  },
  _count: { id: true },
});
```

---

## 六、数据迁移

### 6.1 从旧系统迁移

> **重要**：原系统 `api_54kb` 金额字段使用了 `Float` 类型，迁移时必须使用 `CAST` 转换为 `Decimal`，
> 以避免浮点数精度问题。

如果需要从 `api_54kb` 迁移历史数据：

```sql
-- 1. 导出旧数据（在 api_54kb 数据库执行）
-- 注意：使用 CAST 将 Float 转换为 Decimal，保留 2 位小数
COPY (
  SELECT
    'default' as account_tag,
    "packageId" as package_id,
    "orderPackageStatus" as order_status,
    "payTime" as pay_time,
    "itemId" as item_id,
    "skuName" as sku_name,
    CAST("skuPrice" AS DECIMAL(10, 2)) as sku_price,
    CAST("userRealPayAmount" AS DECIMAL(10, 2)) as user_pay_amount,
    CAST("platformDiscountAmount" AS DECIMAL(10, 2)) as platform_discount,
    CAST("sellerRealIncomeAmount" AS DECIMAL(10, 2)) as seller_income,
    CAST("userCommissionAmount" AS DECIMAL(10, 2)) as commission_amount,
    CAST("commissionRate" AS DECIMAL(5, 4)) as commission_rate,
    CAST("refundAmount" AS DECIMAL(10, 2)) as refund_amount,
    "userId" as user_id,
    "userNickname" as user_nickname,
    "sellerId" as seller_id,
    "shopName" as shop_name,
    "bizId" as room_id,
    "bizTitleName" as live_title,
    "bizStartTime" as live_start_time,
    "originalData" as raw_data,
    "createdAt" as created_at
  FROM "XhsOrders"
) TO '/tmp/xhs_orders_export.csv' WITH CSV HEADER;

-- 2. 导入新数据（在 i_54kb_server 数据库执行）
COPY xhs_orders (
  account_tag, package_id, order_status, pay_time,
  item_id, sku_name, sku_price, user_pay_amount,
  platform_discount, seller_income, commission_amount,
  commission_rate, refund_amount, user_id, user_nickname,
  seller_id, shop_name, room_id, live_title,
  live_start_time, raw_data, created_at
)
FROM '/tmp/xhs_orders_export.csv' WITH CSV HEADER;
```

### 6.2 Float 精度问题说明

原系统中的金额字段（如 `skuPrice`、`userRealPayAmount`）使用 `Float` 类型存储，
可能存在浮点数精度问题（如 `9.99` 存储为 `9.990000000000001`）。

迁移时使用 `CAST(value AS DECIMAL(10, 2))` 可以：
1. 截断多余的小数位
2. 转换为精确的定点数格式
3. 避免新系统中继续累积误差

### 6.3 初始同步

首次部署后，需要手动触发全量同步：

```bash
# 同步最近 90 天订单
curl -X POST http://localhost:8100/api/v1/xhs/sync/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"accountTag": "default"}'

# 同步直播统计
curl -X POST http://localhost:8100/api/v1/xhs/sync/lives \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"accountTag": "default"}'
```

---

## 七、注意事项

### 7.1 数据一致性

- 订单 `packageId` 在同账号下唯一，使用 upsert 保证幂等
- 直播统计以 `roomId` 为唯一标识，直播结束后才同步
- 同步水位记录每次同步后更新，断点续传依赖此记录

### 7.2 性能考虑

- 订单表预计数据量：每月 1000-10000 条
- 直播统计表预计数据量：每月 30-100 条
- 当前索引设计足以支撑百万级数据查询

### 7.3 清理策略

- 暂不自动清理历史数据
- 如需清理，建议保留至少 2 年订单数据（财务审计需要）
- `rawData` 字段可考虑定期清理（保留关键字段后置空）
