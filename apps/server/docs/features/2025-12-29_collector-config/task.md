# 配置驱动的数据采集系统

> 创建日期: 2025-12-29
> 状态: 设计中

## 需求背景

### 现状问题

当前 `syncAllCookies.js` 油猴脚本采用硬编码方式：
- 在所有网站运行（`@match *://*/*`）
- 采集逻辑固定，无法灵活调整
- 新增平台需要修改脚本代码
- 无法针对不同平台采集不同类型的数据（Cookie / localStorage / sessionStorage）

### 目标

实现配置驱动的数据采集系统，让油猴脚本根据后台配置动态决定：
1. **在哪些域名采集** - 域名匹配规则
2. **采集什么数据** - Cookie、localStorage、sessionStorage 的选择
3. **采集哪些字段** - 字段级别的白名单/黑名单过滤
4. **何时触发采集** - 页面加载、Storage 变化、定时等

## 功能需求

### 采集规则管理

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/v1/collector/rules` | GET | JWT | 规则列表（分页） |
| `/api/v1/collector/rules/:id` | GET | JWT | 规则详情 |
| `/api/v1/collector/rules` | POST | JWT | 创建规则 |
| `/api/v1/collector/rules/:id` | PUT | JWT | 更新规则 |
| `/api/v1/collector/rules/:id` | DELETE | JWT | 删除规则 |
| `/api/v1/collector/rules/:id/toggle` | PATCH | JWT | 启用/禁用规则 |

### 配置下发接口

| 接口 | 方法 | 认证 | 说明 |
|------|------|------|------|
| `/api/v1/collector/config` | GET | X-Script-Token | 获取所有启用的规则（供油猴脚本调用） |

## 核心配置项

### 域名匹配

| 匹配类型 | 示例 | 说明 |
|---------|------|------|
| 精确匹配 | `pgy.xiaohongshu.com` | 只匹配该域名 |
| 后缀匹配 | `.xiaohongshu.com` | 匹配所有子域名 |
| 正则匹配 | `.*\.xiaohongshu\.com$` | 正则表达式匹配 |

### 采集类型

| 类型 | 说明 | 特殊要求 |
|------|------|---------|
| Cookie | 浏览器 Cookie | 需要 `GM_cookie` 权限获取 httpOnly |
| localStorage | 本地存储 | 直接访问 |
| sessionStorage | 会话存储 | 直接访问 |

### 字段过滤

| 模式 | 说明 | 示例 |
|------|------|------|
| include | 仅采集指定字段 | `["a1", "web_session", "access-token-*"]` |
| exclude | 排除指定字段 | `["_ga", "_gid", "analytics_*"]` |
| all | 采集全部 | - |

支持通配符 `*` 匹配任意字符。

### 触发条件

| 条件 | 说明 |
|------|------|
| onPageLoad | 页面加载时触发 |
| onStorageChange | localStorage/sessionStorage 变化时触发 |
| intervalMinutes | 定时触发（分钟） |

## 使用场景示例

### 场景一：小红书商家后台

```yaml
名称: 小红书商家后台
域名: pgy.xiaohongshu.com (精确匹配)
采集:
  Cookie:
    - 范围: 主域名下所有
    - 包含 httpOnly: 是
    - 字段: a1, web_session, access-token-*, x-user-id-*
  localStorage:
    - 字段: live_access_token, pgy-access-token
  sessionStorage:
    - 字段: agent_user_info
触发: 页面加载 + Storage变化 + 每30分钟
```

### 场景二：蝉妈妈

```yaml
名称: 蝉妈妈
域名: .chanmama.com (后缀匹配)
采集:
  Cookie:
    - 范围: 全部
    - 包含 httpOnly: 是
触发: 页面加载
```

### 场景三：抖音巨量百应

```yaml
名称: 抖音巨量百应
域名: buyin.jinritemai.com (精确匹配)
采集:
  Cookie:
    - 范围: 全部
    - 排除: _ga, _gid, sensorsdata*
触发: 页面加载
```

## 确认的设计决策

- [x] 配置存储在独立的 `CollectorRule` 表
- [x] 油猴脚本缓存配置，TTL 10 分钟
- [x] 使用现有的 `X-Script-Token` 认证机制
- [x] 规则支持优先级，同一域名匹配多规则时使用最高优先级
- [x] 前端提供可视化配置界面

## 边界场景说明

### 规则数量上限

| 项目 | 限制 | 说明 |
|------|------|------|
| 单用户规则总数 | 100 条 | 超过后需删除旧规则 |
| 单次批量操作 | 50 条 | 批量启用/禁用接口限制 |
| 字段过滤 keys | 50 项/规则 | 避免配置过于复杂 |

**性能说明**: 油猴脚本每次获取所有启用的规则，100 条规则约 20KB JSON，对网络和解析性能影响可忽略。

### 多规则命中策略

当同一域名匹配多个规则时，**只使用优先级最高的规则**，不合并采集。

**设计理由**:
- 简化脚本逻辑，降低运行时复杂度
- 避免字段过滤冲突（如规则 A 白名单、规则 B 黑名单如何处理？）
- 若需采集更多字段，应修改现有规则而非创建新规则

**调试建议**: 使用「域名匹配测试」接口可查看所有命中规则及最终生效规则。

### 缓存与离线降级策略

```
┌─────────────────────────────────────────────────────────────────┐
│                    配置获取流程                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. 检查本地缓存是否有效（10 分钟 TTL）                          │
│     ├─ 有效 → 直接使用缓存配置                                   │
│     └─ 过期 → 继续步骤 2                                        │
│                                                                 │
│  2. 请求服务端配置                                               │
│     ├─ 成功 → 更新缓存，使用新配置                               │
│     ├─ 304 Not Modified → 延长缓存 TTL，使用缓存配置             │
│     └─ 网络错误 → 继续步骤 3                                    │
│                                                                 │
│  3. 降级处理                                                    │
│     ├─ 有过期缓存 → 使用过期缓存（打印 warn 日志）               │
│     └─ 无缓存 → 脚本不采集（打印 error 日志）                    │
└─────────────────────────────────────────────────────────────────┘
```

**用户提示**: 脚本会在浏览器控制台打印配置状态，运维人员可通过 F12 查看。

### 上报 Key 格式校验

后端在接收上报数据时，会对 `uploadKey` 进行轻量级校验，避免因规则配置错误导致垃圾数据：

```
校验规则: ^ck_[a-z0-9_]+$
示例有效: ck_pgy_xiaohongshu_com_w2s9x58u_default
示例无效: CK_XXX, ck-xxx, ck_xxx/yyy
```

**校验失败处理**:
- 返回 400 错误，数据不入库
- 记录告警日志，便于排查规则配置问题

### uploadKeyTemplate 修改风险提示

⚠️ **重要**: 修改 `uploadKeyTemplate` 会导致数据断层！

| 操作 | 后果 |
|------|------|
| 原 Key: `ck_xhs_{deviceId}` | 历史数据存储在此 Key 下 |
| 改为: `cookie_xhs_{deviceId}` | 新数据存到新 Key，历史数据"丢失" |

**API 行为**:
- 更新规则时，若 `uploadKeyTemplate` 发生变化，响应中会包含警告字段
- 前端应弹窗二次确认："修改 Key 模板将导致历史数据无法关联，是否继续？"

```json
{
  "code": 0,
  "data": { ... },
  "warning": {
    "field": "uploadKeyTemplate",
    "message": "Key 模板已变更，历史数据将无法与新数据关联"
  }
}
```

**建议**: 规则创建时谨慎设计 Key 模板，避免后续修改。

### 规则临时禁用（替代有效期功能）

本系统不提供「规则有效期」字段。临时规则场景（如促销期间）建议：

1. 创建规则时在名称或描述中标注「临时 - 2025春节活动」
2. 活动结束后手动禁用或删除
3. 可使用批量禁用接口一次性关闭多个活动规则

**设计理由**: 自动过期容易导致意外问题（运营忘记延长），显式操作更安全。

---

## 用户指南

### Token 获取流程

油猴脚本需要 `X-Script-Token` 进行身份认证，获取方式：

1. 登录管理后台 → 「系统设置」→「脚本管理」
2. 点击「生成 Token」，复制 32 位字符串
3. 粘贴到油猴脚本的 `SCRIPT_TOKEN` 常量中

```javascript
const SCRIPT_TOKEN = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // 从后台复制
```

> **注意**: Token 与当前登录账号绑定，请勿泄露。如需重置，在后台重新生成即可。

### deviceId 与 accountTag 说明

| 变量 | 用途 | 来源 | 示例 |
|------|------|------|------|
| `deviceId` | 区分不同设备/浏览器 | 脚本自动生成（首次运行时生成 UUID 并持久化到本地存储） | `w2s9x58u` |
| `accountTag` | 区分同一设备上的不同账号配置 | 用户手动配置（脚本顶部常量，默认 `default`） | `主账号`、`备用号` |

**多设备场景**:
- 同一用户在 3 台电脑上使用脚本 → 生成 3 条数据，deviceId 不同
- 后台通过 `uploadKeyTemplate` 生成的 Key 可区分来源
- 示例: `ck_pgy_xiaohongshu_com_abc123_主账号` vs `ck_pgy_xiaohongshu_com_xyz789_主账号`

**accountTag 配置方式**:
```javascript
// 脚本顶部配置
const ACCOUNT_TAG = '主账号'; // 可改为: '备用号', '测试号' 等
```

### 采集数据的存储与查看

本功能模块只负责**采集规则配置**，采集到的数据存储在现有的 Cookie 管理系统中：

- **数据查看**: 管理后台 →「Cookie 管理」→ 按 Key 搜索
- **Key 格式**: 由 `uploadKeyTemplate` 定义，如 `ck_pgy_xiaohongshu_com_{deviceId}_{accountTag}`
- **数据结构**: 包含 cookies、localStorage、sessionStorage 等字段

> 如需按设备/账号筛选数据，在 Cookie 管理页面使用 Key 关键词搜索即可。

---

## FAQ

### Q1: 如何判断规则是否生效？

1. **后台验证**: 使用「域名匹配测试」接口，输入目标域名查看是否命中
2. **脚本验证**: 打开目标网站，F12 控制台搜索 `[Collector]` 查看日志
3. **数据验证**: 检查对应 Key 的 Cookie 数据是否有更新

### Q2: 创建规则后为什么没有采集到数据？

排查步骤：
1. 确认规则已启用（`isEnabled: true`）
2. 使用域名匹配测试确认规则能命中目标域名
3. 确认触发条件正确（如 `onPageLoad: true`）
4. 确认字段过滤配置正确（白名单模式需列出所有要采集的字段）
5. 检查油猴脚本是否已更新配置（缓存 10 分钟，可手动清除）

### Q3: 如何处理 Cookie 采集不完整？

可能原因及解决方案：
- **httpOnly Cookie 未采集**: 确认 `includeHttpOnly: true` 且脚本有 `GM_cookie` 权限
- **子域名 Cookie 未采集**: 确认 `scope: "all"` 而非 `"current"`
- **字段被过滤**: 检查 `filter.keys` 是否包含目标字段，注意通配符写法

### Q4: 正则表达式怎么写？

常用正则模板：
| 场景 | 正则表达式 | 说明 |
|------|-----------|------|
| 所有子域名 | `.*\.example\.com$` | 匹配 a.example.com, b.c.example.com |
| 特定前缀 | `^admin\..*` | 匹配 admin.xxx.com |
| 多域名 | `(a\|b)\.example\.com$` | 匹配 a.example.com 或 b.example.com |

**注意**: 正则表达式需要转义特殊字符，`.` 要写成 `\.`

### Q5: 修改规则后多久生效？

- **服务端缓存**: 60 秒（Redis TTL）
- **脚本端缓存**: 10 分钟（本地 TTL）
- **最长生效时间**: 约 11 分钟

如需立即生效，可让用户在油猴脚本管理页面手动清除存储数据。
