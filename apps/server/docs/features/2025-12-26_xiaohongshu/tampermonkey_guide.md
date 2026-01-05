# 油猴脚本对接指南

> 创建日期: 2025-12-26
> 版本: v1.0

## 概述

本指南说明如何通过油猴脚本（Tampermonkey）自动上传小红书 Cookie 到服务端配置中心。

## 一、数据格式规范

### 1.1 Cookie 配置结构

油猴脚本需要收集并上传以下格式的数据：

```typescript
interface XhsCookieConfig {
  // 来源信息
  origin: string;                       // "https://www.xiaohongshu.com"
  hostname: string;                     // "www.xiaohongshu.com"

  // 设备信息（用于追踪来源）
  deviceId: string;                     // 浏览器指纹或随机 UUID
  deviceName?: string;                  // 可选，设备描述

  // 账号标识
  accountTag: string;                   // "default", "backup" 等
  accountName: string;                  // "主账号", "备用账号" 等显示名称

  // 上传时间
  timestamp: number;                    // Date.now()

  // Cookie 统计
  cookieCount: number;                  // Cookie 总数
  httpOnlyCount: number;                // HttpOnly Cookie 数量

  // Cookie 数据
  cookies: XhsCookie[];                 // 完整 Cookie 数组
  cookieObj: Record<string, string>;    // 扁平化键值对（便于快速查找）
}

interface XhsCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;              // Unix 时间戳（秒）
  sameSite?: string;
}
```

### 1.2 关键 Cookie 字段

以下 Cookie 字段是认证所必需的：

| Cookie 名称 | 用途 | 必需 |
|-------------|------|------|
| `a1` | 签名计算 | 是 |
| `web_session` | Web 会话 | 是 |
| `access-token-redlive.xiaohongshu.com` | 直播 API 认证 | 是 |
| `x-user-id-ark.xiaohongshu.com` | 用户 ID | 是 |

### 1.3 示例数据

```json
{
  "origin": "https://www.xiaohongshu.com",
  "hostname": "www.xiaohongshu.com",
  "deviceId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "deviceName": "Chrome MacOS",
  "accountTag": "default",
  "accountName": "主账号",
  "timestamp": 1735200000000,
  "cookieCount": 25,
  "httpOnlyCount": 8,
  "cookies": [
    {
      "name": "a1",
      "value": "19777e5d29clc854yay8c5978prcb41ygbf1c8y9430000223045",
      "domain": ".xiaohongshu.com",
      "path": "/",
      "secure": true,
      "httpOnly": false,
      "expirationDate": 1766736000
    },
    {
      "name": "web_session",
      "value": "xxx...",
      "domain": ".xiaohongshu.com",
      "path": "/",
      "secure": true,
      "httpOnly": true,
      "expirationDate": 1766736000
    }
  ],
  "cookieObj": {
    "a1": "19777e5d29clc854yay8c5978prcb41ygbf1c8y9430000223045",
    "web_session": "xxx...",
    "access-token-redlive.xiaohongshu.com": "customer.red_live.xxx...",
    "x-user-id-ark.xiaohongshu.com": "60b13baa0000000001000c63"
  }
}
```

---

## 二、上传接口

### 2.1 配置中心 API

使用配置中心的 ScriptUpload 接口上传 Cookie 数据：

```
POST /api/v1/config/script-data
Content-Type: application/json
Authorization: Bearer <access_token>
```

**请求体：**

```json
{
  "key": "xhs-cookies",
  "value": { /* XhsCookieConfig 对象 */ },
  "description": "小红书 Cookie - 主账号"
}
```

### 2.2 多账号配置

- 默认账号使用 key: `xhs-cookies`
- 其他账号使用 key: `xhs-cookies-{accountTag}`

```javascript
// 默认账号
{ "key": "xhs-cookies", "value": { "accountTag": "default", ... } }

// 备用账号
{ "key": "xhs-cookies-backup", "value": { "accountTag": "backup", ... } }
```

### 2.3 上传示例代码

```javascript
// ==UserScript==
// @name         小红书 Cookie 同步
// @namespace    https://i.54kb.com/
// @version      1.0
// @description  自动同步小红书 Cookie 到服务端
// @match        https://*.xiaohongshu.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
  'use strict';

  const API_BASE = 'https://i.54kb.com/api/v1';
  const SYNC_INTERVAL = 30 * 60 * 1000; // 30 分钟

  // 获取认证 Token（需要预先配置）
  const AUTH_TOKEN = GM_getValue('auth_token', '');

  if (!AUTH_TOKEN) {
    console.warn('[XHS Cookie Sync] 未配置认证 Token，请先设置');
    return;
  }

  // 收集 Cookie
  async function collectCookies() {
    return new Promise((resolve) => {
      // 使用 chrome.cookies API 或 document.cookie
      // 注意：HttpOnly Cookie 需要通过扩展 API 获取

      const cookies = [];
      const cookieObj = {};

      // 解析 document.cookie（仅能获取非 HttpOnly）
      document.cookie.split(';').forEach(c => {
        const [name, ...valueParts] = c.trim().split('=');
        const value = valueParts.join('=');
        if (name && value) {
          cookies.push({
            name,
            value,
            domain: location.hostname,
            path: '/',
            secure: location.protocol === 'https:',
            httpOnly: false,
          });
          cookieObj[name] = value;
        }
      });

      resolve({
        origin: location.origin,
        hostname: location.hostname,
        deviceId: getDeviceId(),
        accountTag: 'default',
        accountName: '主账号',
        timestamp: Date.now(),
        cookieCount: cookies.length,
        httpOnlyCount: 0,
        cookies,
        cookieObj,
      });
    });
  }

  // 生成或获取设备 ID
  function getDeviceId() {
    let deviceId = GM_getValue('device_id', '');
    if (!deviceId) {
      deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      GM_setValue('device_id', deviceId);
    }
    return deviceId;
  }

  // 上传 Cookie
  async function uploadCookies(cookieConfig) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${API_BASE}/config/script-data`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`,
        },
        data: JSON.stringify({
          key: 'xhs-cookies',
          value: cookieConfig,
          description: `小红书 Cookie - ${cookieConfig.accountName}`,
        }),
        onload: (response) => {
          if (response.status === 200 || response.status === 201) {
            console.log('[XHS Cookie Sync] 上传成功');
            resolve(JSON.parse(response.responseText));
          } else {
            console.error('[XHS Cookie Sync] 上传失败:', response.status);
            reject(new Error(`Upload failed: ${response.status}`));
          }
        },
        onerror: (error) => {
          console.error('[XHS Cookie Sync] 请求错误:', error);
          reject(error);
        },
      });
    });
  }

  // 主同步函数
  async function sync() {
    try {
      const cookieConfig = await collectCookies();

      // 检查关键 Cookie 是否存在
      const requiredCookies = ['a1', 'web_session'];
      const hasMissing = requiredCookies.some(c => !cookieConfig.cookieObj[c]);

      if (hasMissing) {
        console.warn('[XHS Cookie Sync] 缺少必要 Cookie，跳过上传');
        return;
      }

      await uploadCookies(cookieConfig);
      GM_setValue('last_sync_time', Date.now());
    } catch (error) {
      console.error('[XHS Cookie Sync] 同步失败:', error);
    }
  }

  // 初始化
  const lastSyncTime = GM_getValue('last_sync_time', 0);
  const timeSinceLastSync = Date.now() - lastSyncTime;

  // 距离上次同步超过间隔时执行
  if (timeSinceLastSync > SYNC_INTERVAL) {
    setTimeout(sync, 5000); // 页面加载后 5 秒执行
  }

  // 定时同步
  setInterval(sync, SYNC_INTERVAL);

  console.log('[XHS Cookie Sync] 脚本已加载');
})();
```

---

## 三、浏览器扩展方案

### 3.1 获取 HttpOnly Cookie

油猴脚本无法直接访问 HttpOnly Cookie，推荐使用浏览器扩展：

```javascript
// background.js (Chrome Extension)
chrome.cookies.getAll({ domain: '.xiaohongshu.com' }, (cookies) => {
  const cookieConfig = {
    origin: 'https://www.xiaohongshu.com',
    hostname: 'www.xiaohongshu.com',
    deviceId: getDeviceId(),
    accountTag: 'default',
    accountName: '主账号',
    timestamp: Date.now(),
    cookieCount: cookies.length,
    httpOnlyCount: cookies.filter(c => c.httpOnly).length,
    cookies: cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      expirationDate: c.expirationDate,
      sameSite: c.sameSite,
    })),
    cookieObj: cookies.reduce((obj, c) => {
      obj[c.name] = c.value;
      return obj;
    }, {}),
  };

  // 上传到服务端...
});
```

### 3.2 权限配置

```json
// manifest.json
{
  "manifest_version": 3,
  "name": "小红书 Cookie 同步",
  "version": "1.0",
  "permissions": [
    "cookies",
    "storage"
  ],
  "host_permissions": [
    "https://*.xiaohongshu.com/*"
  ]
}
```

---

## 四、账号管理

### 4.1 查看账号列表

```
GET /api/v1/xhs/accounts
Authorization: Bearer <access_token>
```

**响应：**

```json
{
  "code": 0,
  "data": [
    {
      "tag": "default",
      "name": "主账号",
      "expiresAt": 1766736000000,
      "isExpired": false,
      "daysUntilExpiry": 30
    }
  ]
}
```

### 4.2 检查账号状态

```
GET /api/v1/xhs/accounts/{tag}/status
```

**响应：**

```json
{
  "code": 0,
  "data": {
    "tag": "default",
    "name": "主账号",
    "isValid": true,
    "expiresAt": 1766736000000,
    "daysUntilExpiry": 30,
    "lastUpdated": "2025-12-26T10:00:00.000Z",
    "userId": "60b13baa0000000001000c63"
  }
}
```

### 4.3 刷新账号缓存

当 Cookie 更新后，调用此接口清除服务端缓存：

```
POST /api/v1/xhs/accounts/{tag}/refresh
```

---

## 五、错误处理

### 5.1 常见错误

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| 17000 | 账号未配置 | 检查 key 是否正确上传 |
| 17001 | Cookie 已过期 | 重新登录小红书并上传 |
| 17002 | Cookie 无效 | 检查必需字段是否完整 |

### 5.2 过期检测

服务端会自动检测 Cookie 过期时间：

- **过期**：返回 17001 错误，需要重新登录
- **即将过期**（3天内）：正常返回但会记录警告日志

### 5.3 自动重试策略

```javascript
async function uploadWithRetry(cookieConfig, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await uploadCookies(cookieConfig);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## 六、安全注意事项

1. **Token 保护**：认证 Token 应安全存储，避免泄露
2. **HTTPS 传输**：所有请求必须使用 HTTPS
3. **最小权限**：油猴脚本仅在小红书域名下运行
4. **定期更新**：Cookie 有效期有限，需定期更新
5. **账号隔离**：不同账号使用不同的 accountTag

---

## 七、常见问题

### Q: 为什么需要 HttpOnly Cookie？

A: `access-token-redlive.xiaohongshu.com` 等关键认证 Cookie 设置了 HttpOnly 标志，无法通过 `document.cookie` 获取。需要使用浏览器扩展的 `chrome.cookies` API。

### Q: Cookie 多久需要更新一次？

A: 小红书 Cookie 通常有效期为 30 天左右。建议：
- 每次登录后立即同步
- 设置定时任务每天检查过期状态
- 收到 17001 错误时立即重新登录

### Q: 如何支持多账号？

A: 使用不同的 accountTag：
- 默认账号：key = `xhs-cookies`
- 备用账号：key = `xhs-cookies-backup`
- 更多账号：key = `xhs-cookies-{自定义标识}`

### Q: 上传失败怎么办？

A: 检查以下项目：
1. 认证 Token 是否有效
2. 网络连接是否正常
3. 请求格式是否正确
4. 服务端是否可用
