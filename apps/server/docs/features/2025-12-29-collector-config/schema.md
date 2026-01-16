# 数据库设计

> 创建日期: 2025-12-29

## 表结构

### collector_rules (采集规则表)

| 字段                | 类型         | 约束               | 说明                         |
| ------------------- | ------------ | ------------------ | ---------------------------- |
| id                  | INT          | PK, AUTO_INCREMENT | 主键                         |
| name                | VARCHAR(100) | NOT NULL           | 规则名称                     |
| description         | VARCHAR(500) |                    | 规则描述                     |
| is_enabled          | BOOLEAN      | DEFAULT true       | 是否启用                     |
| priority            | INT          | DEFAULT 10         | 优先级（0-100，越大越优先）  |
| domain_pattern      | VARCHAR(200) | NOT NULL           | 域名匹配模式                 |
| domain_match_type   | VARCHAR(20)  | NOT NULL           | 匹配类型: exact/suffix/regex |
| collectors          | JSON         | NOT NULL           | 采集配置                     |
| upload_key_template | VARCHAR(200) | NOT NULL           | 上报 Key 模板                |
| trigger             | JSON         | NOT NULL           | 触发条件配置                 |
| created_at          | TIMESTAMP    | DEFAULT NOW()      | 创建时间                     |
| updated_at          | TIMESTAMP    | ON UPDATE          | 更新时间                     |
| created_by_id       | INT          |                    | 创建人 ID                    |
| updated_by_id       | INT          |                    | 最后更新人 ID                |
| deleted_at          | TIMESTAMP    |                    | 软删除时间                   |
| deleted_by_id       | INT          |                    | 删除人 ID                    |
| delete_reason       | VARCHAR(200) |                    | 删除原因                     |

## JSON 字段结构

### collectors (采集配置)

```json
{
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
}
```

### trigger (触发配置)

```json
{
  "onPageLoad": true,
  "onStorageChange": true,
  "intervalMinutes": 30
}
```

## Prisma Schema

```prisma
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

## 索引设计

| 索引名               | 字段                   | 类型 | 说明             |
| -------------------- | ---------------------- | ---- | ---------------- |
| PRIMARY              | id                     | 主键 | -                |
| idx_enabled_priority | (is_enabled, priority) | 普通 | 配置下发查询优化 |
| idx_domain           | domain_pattern         | 普通 | 按域名搜索       |
| idx_deleted_at       | deleted_at             | 普通 | 软删除查询优化   |

## 数据示例

```sql
INSERT INTO collector_rules (name, description, priority, domain_pattern, domain_match_type, collectors, upload_key_template, trigger)
VALUES
(
  '小红书商家后台',
  '采集 pgy 平台的认证信息',
  10,
  'pgy.xiaohongshu.com',
  'exact',
  '{
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
  }',
  'ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}',
  '{
    "onPageLoad": true,
    "onStorageChange": true,
    "intervalMinutes": 30
  }'
),
(
  '蝉妈妈',
  '采集蝉妈妈平台 Cookie',
  10,
  '.chanmama.com',
  'suffix',
  '{
    "cookie": {
      "enabled": true,
      "scope": "all",
      "includeHttpOnly": true
    }
  }',
  'ck_chanmama_{deviceId}_{accountTag}',
  '{
    "onPageLoad": true,
    "onStorageChange": false
  }'
);
```

## 字段约束说明

### domain_match_type

| 值       | 说明     | 示例                               |
| -------- | -------- | ---------------------------------- |
| `exact`  | 精确匹配 | `pgy.xiaohongshu.com` 只匹配该域名 |
| `suffix` | 后缀匹配 | `.xiaohongshu.com` 匹配所有子域名  |
| `regex`  | 正则匹配 | `.*\.xiaohongshu\.com$`            |

### collectors.\*.filter.mode

| 值        | 说明                           |
| --------- | ------------------------------ |
| `include` | 白名单模式，只采集列表中的字段 |
| `exclude` | 黑名单模式，排除列表中的字段   |

### collectors.cookie.scope

| 值        | 说明                            |
| --------- | ------------------------------- |
| `current` | 只采集当前精确域名的 Cookie     |
| `all`     | 采集主域名下所有子域名的 Cookie |

### upload_key_template 变量

| 变量           | 说明                     | 示例值                |
| -------------- | ------------------------ | --------------------- |
| `{domain}`     | 当前域名（下划线替换点） | `pgy_xiaohongshu_com` |
| `{deviceId}`   | 设备 ID                  | `w2s9x58u`            |
| `{accountTag}` | 账号标签                 | `default`             |
| `{timestamp}`  | 时间戳                   | `1703836800000`       |
