# 小红书模块实现方案

> 创建日期: 2025-12-26
> 版本: v1.0

## 一、目录结构

```
src/modules/xhs/
├── xhs.module.ts                      # 模块入口
│
├── auth/                              # 认证管理
│   ├── xhs-auth.service.ts            # Cookie 获取、多账号、过期检测
│   └── interfaces/
│       └── xhs-account.interface.ts   # 账号数据结构定义
│
├── proxy/                             # API 代理
│   ├── xhs-proxy.service.ts           # 统一请求封装
│   ├── xhs-proxy.controller.ts        # 代理接口
│   └── xhs-signature.util.ts          # 签名工具（X-s、X-t）
│
├── sync/                              # 数据同步
│   ├── xhs-order-sync.service.ts      # 订单增量同步
│   ├── xhs-live-sync.service.ts       # 直播统计同步
│   ├── xhs-sync.scheduler.ts          # 定时任务
│   └── xhs-sync.controller.ts         # 手动触发接口
│
├── data/                              # 数据查询
│   ├── xhs-order.service.ts           # 订单查询
│   ├── xhs-order.controller.ts
│   ├── xhs-live-stats.service.ts      # 直播统计查询
│   └── xhs-live-stats.controller.ts
│
├── dto/                               # 数据传输对象
│   ├── xhs-proxy.dto.ts
│   ├── xhs-order-query.dto.ts
│   ├── xhs-live-stats-query.dto.ts
│   ├── xhs-sync-trigger.dto.ts
│   └── index.ts
│
└── __tests__/                         # 测试
    ├── xhs-auth.service.spec.ts
    ├── xhs-signature.util.spec.ts
    └── xhs-order-sync.service.spec.ts
```

### 1.2 模块入口定义

```typescript
// xhs.module.ts

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

// Auth
import { XhsAuthService } from './auth/xhs-auth.service';

// Proxy
import { XhsProxyService } from './proxy/xhs-proxy.service';
import { XhsProxyController } from './proxy/xhs-proxy.controller';

// Sync
import { XhsOrderSyncService } from './sync/xhs-order-sync.service';
import { XhsLiveSyncService } from './sync/xhs-live-sync.service';
import { XhsSyncScheduler } from './sync/xhs-sync.scheduler';
import { XhsSyncController } from './sync/xhs-sync.controller';

// Data
import { XhsOrderService } from './data/xhs-order.service';
import { XhsOrderController } from './data/xhs-order.controller';
import { XhsLiveStatsService } from './data/xhs-live-stats.service';
import { XhsLiveStatsController } from './data/xhs-live-stats.controller';

// Accounts
import { XhsAccountController } from './auth/xhs-account.controller';

// 依赖模块
import { ConfigModule } from '@/modules/config/config.module';
import { RedisModule } from '@/common/redis/redis.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),
    ScheduleModule.forRoot(),
    ConfigModule,  // 提供 ConfigItemService
    RedisModule,   // 提供 RedisLock
  ],
  controllers: [
    XhsProxyController,
    XhsSyncController,
    XhsOrderController,
    XhsLiveStatsController,
    XhsAccountController,
  ],
  providers: [
    // Auth
    XhsAuthService,
    // Proxy
    XhsProxyService,
    // Sync
    XhsOrderSyncService,
    XhsLiveSyncService,
    XhsSyncScheduler,
    // Data
    XhsOrderService,
    XhsLiveStatsService,
  ],
  exports: [
    XhsAuthService,
    XhsProxyService,
  ],
})
export class XhsModule {}
```

---

## 二、认证管理模块

### 2.1 Cookie 数据结构

```typescript
// auth/interfaces/xhs-account.interface.ts

export interface XhsCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;  // Unix timestamp (秒)
  sameSite?: string;
}

export interface XhsCookieConfig {
  origin: string;                       // "https://www.xiaohongshu.com"
  hostname: string;                     // "www.xiaohongshu.com"
  deviceId: string;
  deviceName?: string;
  accountTag: string;                   // "default", "backup"
  accountName: string;                  // "默认账号"
  timestamp: number;                    // 上传时间戳
  cookieCount: number;
  httpOnlyCount: number;
  cookies: XhsCookie[];
  cookieObj: Record<string, string>;    // 扁平化的 cookie 键值对
}

export interface XhsAccount {
  // 账号标识
  accountTag: string;
  accountName: string;

  // 认证信息
  cookies: XhsCookie[];
  cookieObj: Record<string, string>;

  // 计算属性（从 cookieObj 提取）
  userId: string;               // x-user-id-ark.xiaohongshu.com
  authorization: string;        // access-token-redlive 去掉前缀
  a1: string;                   // 签名用
  webSession: string;

  // 元信息
  deviceId: string;
  updatedAt: number;            // Cookie 更新时间（来自配置）
  expiresAt: number;            // 最早过期时间（计算得出）
}
```

### 2.2 认证服务实现

> **接口说明**：使用 `ConfigItemService.findOne(namespace, key)` 方法从配置中心获取 Cookie 数据。
> 该方法已在 `src/modules/config/config-item/config-item.service.ts:180` 行定义。
>
> **并发保护**：使用 Singleflight 模式，多个请求同时 cache miss 时只发起一次配置中心请求。

```typescript
// auth/xhs-auth.service.ts

import { ConfigItemService } from '@/modules/config/config-item/config-item.service';

@Injectable()
export class XhsAuthService {
  private readonly logger = new Logger(XhsAuthService.name);
  private readonly accountCache = new Map<string, { account: XhsAccount; cachedAt: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5分钟缓存

  // Singleflight: 追踪正在进行的请求，避免并发穿透
  private readonly pendingRequests = new Map<string, Promise<XhsAccount>>();

  constructor(
    private readonly configItemService: ConfigItemService,
  ) {}

  /**
   * 获取账号认证信息（带 Singleflight 并发保护）
   * @param accountTag 账号标识，默认 "default"
   */
  async getAccount(accountTag = 'default'): Promise<XhsAccount> {
    // 1. 检查内存缓存
    const cached = this.accountCache.get(accountTag);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL_MS) {
      return cached.account;
    }

    // 2. Singleflight: 如果有正在进行的请求，直接等待复用结果
    const pending = this.pendingRequests.get(accountTag);
    if (pending) {
      return pending;
    }

    // 3. 发起新请求并注册到 pending
    const promise = this.fetchAndCacheAccount(accountTag);
    this.pendingRequests.set(accountTag, promise);

    try {
      return await promise;
    } finally {
      // 请求完成后移除 pending 记录
      this.pendingRequests.delete(accountTag);
    }
  }

  /**
   * 实际获取并缓存账号信息（内部方法）
   */
  private async fetchAndCacheAccount(accountTag: string): Promise<XhsAccount> {
    const key = accountTag === 'default' ? 'xhs-cookies' : `xhs-cookies-${accountTag}`;

    // 1. 从配置中心获取
    let config: ConfigItem;
    try {
      config = await this.configItemService.findOne('script-data', key);
    } catch (error) {
      throw new BusinessException({
        code: ApiErrorCode.XHS_ACCOUNT_NOT_FOUND,
        message: `小红书账号 "${accountTag}" 未配置`,
      });
    }

    // 2. 解析并验证
    const cookieConfig = config.value as XhsCookieConfig;
    const account = this.parseAccount(cookieConfig, accountTag);

    // 3. 检查过期
    const now = Date.now();
    if (account.expiresAt < now) {
      throw new BusinessException({
        code: ApiErrorCode.XHS_AUTH_EXPIRED,
        message: `账号 "${accountTag}" 的认证已过期，请更新 Cookie`,
        data: {
          expiredAt: new Date(account.expiresAt).toISOString(),
          accountTag,
        },
      });
    }

    // 4. 即将过期预警（3天内）
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (account.expiresAt - now < THREE_DAYS_MS) {
      this.logger.warn(
        `账号 "${accountTag}" 的 Cookie 即将过期: ${new Date(account.expiresAt).toISOString()}`
      );
    }

    // 5. 缓存并返回
    this.accountCache.set(accountTag, { account, cachedAt: now });
    return account;
  }

  /**
   * 列出所有可用账号
   */
  async listAccounts(): Promise<Array<{
    tag: string;
    name: string;
    expiresAt: number;
    isExpired: boolean;
  }>> {
    const configs = await this.configItemService.findAll('script-data', {
      keyPrefix: 'xhs-cookies',
      isEnabled: true,
    });

    return configs.data.map((c) => {
      const data = c.value as XhsCookieConfig;
      const expiresAt = this.getEarliestExpiry(data.cookies);
      return {
        tag: data.accountTag || 'default',
        name: data.accountName || '未命名',
        expiresAt,
        isExpired: expiresAt < Date.now(),
      };
    });
  }

  /**
   * 清除账号缓存
   */
  invalidateCache(accountTag?: string): void {
    if (accountTag) {
      this.accountCache.delete(accountTag);
    } else {
      this.accountCache.clear();
    }
  }

  private parseAccount(config: XhsCookieConfig, tag: string): XhsAccount {
    const { cookieObj } = config;

    // 提取关键认证信息
    const accessToken = cookieObj['access-token-redlive.xiaohongshu.com'] || '';

    return {
      accountTag: tag,
      accountName: config.accountName || tag,
      cookies: config.cookies,
      cookieObj,
      userId: cookieObj['x-user-id-ark.xiaohongshu.com'] || '',
      authorization: accessToken.startsWith('customer.red_live.')
        ? accessToken.slice(18)
        : accessToken,
      a1: cookieObj['a1'] || '',
      webSession: cookieObj['web_session'] || '',
      deviceId: config.deviceId,
      updatedAt: config.timestamp,
      expiresAt: this.getEarliestExpiry(config.cookies),
    };
  }

  private getEarliestExpiry(cookies: XhsCookie[]): number {
    // 找出最早过期的关键 Cookie
    const keyCookies = ['web_session', 'access-token-redlive.xiaohongshu.com', 'a1'];

    const expiryTimes = cookies
      .filter((c) => keyCookies.some((k) => c.name.includes(k)) && c.expirationDate)
      .map((c) => c.expirationDate! * 1000); // 转为毫秒

    if (expiryTimes.length === 0) {
      // 默认30天后过期
      return Date.now() + 30 * 24 * 60 * 60 * 1000;
    }

    return Math.min(...expiryTimes);
  }
}
```

---

## 三、签名工具

> **注意**：签名算法直接从原系统 `api_54kb/src/utils/xhsXSEncrypt.js` 迁移，保持完全一致。

### 3.1 签名服务实现

```typescript
// proxy/xhs-signature.util.ts

import * as crypto from 'crypto';

// 自定义 Base64 字符集
const XN = 'A4NjFqYu5wPHsO0XTdDgMa2r1ZQocVte9UJBvk6/7=yRnhISGKblCWi+LpfE8xzm3';
const XN64 = XN[64];

/**
 * 小红书请求签名工具
 *
 * 来源：https://github.com/Cloxl/xhshow
 *
 * 签名由两部分组成：
 * - X-s: 加密后的签名字符串（格式：XYW_<base64_payload>）
 * - X-t: 时间戳
 */
export class XhsSignatureUtil {
  // AES 密钥（4个 int32 使用 writeUInt32BE 转为 16 字节）
  // 原值：[929260340, 1633971297, 895580464, 925905270]
  private static readonly WORDS = [929260340, 1633971297, 895580464, 925905270];
  private static readonly KEY_BYTES = Buffer.concat(
    XhsSignatureUtil.WORDS.map((word) => {
      const buf = Buffer.alloc(4);
      buf.writeUInt32BE(word);
      return buf;
    })
  );

  // AES IV
  private static readonly IV = Buffer.from('4uzjr7mbsibcaldp');

  /**
   * 生成 MD5 哈希
   */
  static md5(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * AES-128-CBC 加密
   */
  static aesEncrypt(text: string): string {
    const textEncoded = Buffer.from(text).toString('base64');
    const cipher = crypto.createCipheriv('aes-128-cbc', this.KEY_BYTES, this.IV);
    let encrypted = cipher.update(textEncoded, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  /**
   * Base64 转 Hex
   */
  static base64ToHex(encodedData: string): string {
    const decodedData = Buffer.from(encodedData, 'base64');
    return decodedData.toString('hex');
  }

  /**
   * Payload 加密（完整实现，与原系统一致）
   */
  static encryptPayload(payload: string, platform: string): string {
    const obj = {
      signSvn: '56',
      signType: 'x2',
      appID: platform,
      signVersion: '1',
      payload: this.base64ToHex(payload),
    };
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  /**
   * 生成 X-s 签名
   * @param url 请求 URL（不含域名）
   * @param a1 Cookie 中的 a1 值
   * @param timestamp 时间戳
   * @param platform 平台标识，默认 'xhs-pc-web'
   */
  static generateXs(
    url: string,
    a1: string,
    timestamp: number,
    platform = 'xhs-pc-web',
  ): string {
    const x1 = this.md5('url=' + url);
    const x2 = '0|0|0|1|0|0|1|0|0|0|1|0|0|0|0|1|0|0|0';
    const text = `x1=${x1};x2=${x2};x3=${a1};x4=${timestamp};`;

    const encrypted = this.aesEncrypt(text);
    return 'XYW_' + this.encryptPayload(encrypted, platform);
  }

  /**
   * 生成简化版签名（用于部分 API，如 captcha）
   * @param timestamp 时间戳
   * @param payload POST 数据
   */
  static encryptSign(timestamp: number, payload: unknown): string {
    const url = `${timestamp}test/api/redcaptcha/v2/captcha/register${JSON.stringify(payload)}`;
    const md5Hash = this.md5(url);
    const md5Ascii = Array.from(md5Hash).map((char) => char.charCodeAt(0));

    let result = '';
    for (let i = 0; i < md5Ascii.length; i += 3) {
      const u = md5Ascii[i] || 0;
      const c = md5Ascii[i + 1] || 0;
      const s = md5Ascii[i + 2] || 0;

      const l = u >> 2;
      const f = ((u & 3) << 4) | (c >> 4);
      const p = c ? ((c & 15) << 2) | (s >> 6) : 64;
      const d = s ? s & 63 : 64;

      result +=
        XN[l] + XN[f] + (p < 64 ? XN[p] : XN64) + (d < 64 ? XN[d] : XN64);
    }
    return result;
  }
}
```

### 3.2 签名测试用例

> **重要**：实现时需要从原系统 `api_54kb` 获取真实测试向量，确保签名完全一致。

```typescript
// __tests__/xhs-signature.util.spec.ts

describe('XhsSignatureUtil', () => {
  /**
   * 测试向量获取方法：
   * 1. 在原系统 api_54kb 中添加日志输出
   * 2. 运行原系统并调用签名接口
   * 3. 记录输入参数和输出结果作为对照
   */

  // 测试向量（需要从原系统获取真实数据替换）
  const testVectors = [
    {
      description: '直播数据接口签名',
      input: {
        url: '/api/sns/red/live/manager/v1/data/room/metric',
        a1: '19777e5d29clc854yay8c5978prcb41ygbf1c8y9430000223045',
        timestamp: 1735200000000,
        platform: 'xhs-pc-web',
      },
      // 从原系统获取的期望输出（示例，需替换为真实值）
      expectedXs: 'XYW_eyJzaWduU3ZuIjoiNTYiLCJzaWduVHlwZSI6IngyIiwiYXBwSUQiOiJ4aHMtcGMtd2ViIiwic2lnblZlcnNpb24iOiIxIiwicGF5bG9hZCI6Ii4uLiJ9',
    },
    {
      description: 'PGY 商品接口签名',
      input: {
        url: '/api/draco/distribution/data/seller_order_list',
        a1: '19777e5d29clc854yay8c5978prcb41ygbf1c8y9430000223045',
        timestamp: 1735200000000,
        platform: 'xhs-pc-web',
      },
      expectedXs: null, // 待填充
    },
  ];

  describe('generateXs', () => {
    it('should generate X-s signature starting with XYW_', () => {
      const { url, a1, timestamp, platform } = testVectors[0].input;
      const xs = XhsSignatureUtil.generateXs(url, a1, timestamp, platform);

      expect(xs).toMatch(/^XYW_/);
      // 解码 Base64 部分，验证结构
      const payload = xs.slice(4); // 去掉 'XYW_' 前缀
      const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
      expect(decoded).toHaveProperty('signSvn', '56');
      expect(decoded).toHaveProperty('signType', 'x2');
      expect(decoded).toHaveProperty('appID', platform);
      expect(decoded).toHaveProperty('signVersion', '1');
      expect(decoded).toHaveProperty('payload');
    });

    // TODO: 实现时取消注释，填入真实测试向量
    // testVectors.forEach((vector) => {
    //   if (vector.expectedXs) {
    //     it(`should match original system output: ${vector.description}`, () => {
    //       const { url, a1, timestamp, platform } = vector.input;
    //       const xs = XhsSignatureUtil.generateXs(url, a1, timestamp, platform);
    //       expect(xs).toBe(vector.expectedXs);
    //     });
    //   }
    // });
  });

  describe('KEY_BYTES validation', () => {
    it('should use correct WORDS array', () => {
      const expectedWords = [929260340, 1633971297, 895580464, 925905270];
      // 验证 WORDS 数组正确（可通过反射或公开静态属性）
      expect(XhsSignatureUtil['WORDS']).toEqual(expectedWords);
    });

    it('should generate correct 16-byte key from WORDS', () => {
      // 使用 writeUInt32BE 将 4 个 int32 转为 16 字节
      const expectedKeyHex = '376da534616c8c61356249d037306d76';
      const keyBytes = XhsSignatureUtil['KEY_BYTES'];
      expect(keyBytes.toString('hex')).toBe(expectedKeyHex);
    });
  });

  describe('md5', () => {
    it('should generate correct MD5 hash', () => {
      const input = 'url=/api/sns/red/live/manager/v1/data/room/metric';
      const hash = XhsSignatureUtil.md5(input);
      expect(hash).toBe('e5b8a7c9f3d2e1b4a5c6d7e8f9a0b1c2'); // 示例，需验证
    });
  });
});
```

### 3.3 获取测试向量脚本

实现时可在原系统添加以下代码获取测试向量：

```javascript
// 在 api_54kb/src/utils/xhsXSEncrypt.js 中临时添加
static async generateXsWithLog(url, a1, timestamp, platform = 'xhs-pc-web') {
  const xs = await this.generateXs(url, a1, timestamp, platform);
  console.log('=== 签名测试向量 ===');
  console.log(JSON.stringify({
    input: { url, a1, timestamp, platform },
    output: { xs }
  }, null, 2));
  return xs;
}
```

---

## 四、API 代理模块

### 4.1 代理服务实现

```typescript
// proxy/xhs-proxy.service.ts

export interface XhsRequestOptions {
  api: string;                          // API 路径
  method?: 'GET' | 'POST';
  params?: Record<string, unknown>;
  data?: unknown;
  accountTag?: string;                  // 使用的账号
  platform?: XhsPlatform;               // 目标平台
}

export type XhsPlatform = 'live-assistant' | 'pgy' | 'redlive' | 'ark';

@Injectable()
export class XhsProxyService {
  private readonly logger = new Logger(XhsProxyService.name);

  constructor(
    private readonly authService: XhsAuthService,
    private readonly httpService: HttpService,  // 通过 DI 注入，需在模块中导入 HttpModule
  ) {}

  /**
   * 通用请求方法
   */
  async request<T>(options: XhsRequestOptions): Promise<T> {
    const account = await this.authService.getAccount(options.accountTag);
    const platform = options.platform || this.detectPlatform(options.api);

    // 1. 构建完整 URL
    const baseUrl = this.getBaseUrl(platform);
    const url = `${baseUrl}${options.api}`;

    // 2. 生成签名
    const timestamp = Date.now();
    const xs = XhsSignatureUtil.generateXs(options.api, account.a1, timestamp);

    // 3. 构建请求头
    const headers = this.buildHeaders(account, { xs, xt: timestamp }, platform);

    // 4. 发起请求
    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: options.method || 'GET',
          url,
          headers,
          params: options.params,
          data: options.data,
          timeout: 30000,
        })
      );

      return this.handleResponse<T>(response.data);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private getBaseUrl(platform: XhsPlatform): string {
    const urls: Record<XhsPlatform, string> = {
      'live-assistant': 'https://live-assistant.xiaohongshu.com',
      'pgy': 'https://pgy.xiaohongshu.com',
      'redlive': 'https://redlive.xiaohongshu.com',
      'ark': 'https://ark.xiaohongshu.com',
    };
    return urls[platform];
  }

  private detectPlatform(api: string): XhsPlatform {
    if (api.includes('/edith/') || api.includes('/draco/')) {
      return 'pgy';
    }
    return 'live-assistant';
  }

  private buildHeaders(
    account: XhsAccount,
    signature: { xs: string; xt: number },
    platform: XhsPlatform,
  ): Record<string, string> {
    const baseHeaders = {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      'sec-ch-ua': '"Chromium";v="119", "Not?A_Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'x-s': signature.xs,
      'x-t': String(signature.xt),
    };

    // 根据平台添加认证头
    if (platform === 'live-assistant' || platform === 'redlive') {
      return {
        ...baseHeaders,
        'authority': `${platform}.xiaohongshu.com`,
        'origin': `https://${platform}.xiaohongshu.com`,
        'referer': `https://${platform}.xiaohongshu.com/`,
        'authorization': account.authorization,
        'account-id': account.userId,
        'cookie': `access-token-redlive.xiaohongshu.com=customer.red_live.${account.authorization};`,
      };
    }

    if (platform === 'pgy') {
      return {
        ...baseHeaders,
        'authority': 'pgy.xiaohongshu.com',
        'origin': 'https://pgy.xiaohongshu.com',
        'referer': 'https://pgy.xiaohongshu.com/',
        'cookie': this.buildCookieString(account.cookieObj),
      };
    }

    return baseHeaders;
  }

  private buildCookieString(cookieObj: Record<string, string>): string {
    return Object.entries(cookieObj)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  private handleResponse<T>(data: any): T {
    // 小红书响应格式：{ code: 0, data: {...}, msg: '' }
    if (data.code !== 0 && data.code !== 200 && data.success !== true) {
      throw new BusinessException({
        code: ApiErrorCode.XHS_API_ERROR,
        message: data.msg || data.message || '小红书接口返回错误',
        data: { xhsCode: data.code },
      });
    }
    return data.data ?? data;
  }

  private handleError(error: any): never {
    if (error instanceof BusinessException) {
      throw error;
    }

    const status = error.response?.status;
    const message = error.response?.data?.msg || error.message;

    if (status === 401 || status === 403) {
      throw new BusinessException({
        code: ApiErrorCode.XHS_AUTH_INVALID,
        message: 'Cookie 已失效，请重新登录小红书并更新',
      });
    }

    throw new BusinessException({
      code: ApiErrorCode.XHS_REQUEST_FAILED,
      message: `小红书请求失败: ${message}`,
      data: { status },
    });
  }
}
```

### 4.2 代理控制器

```typescript
// proxy/xhs-proxy.controller.ts

@ApiTags('小红书-代理')
@Controller('xhs')  // 全局已配置 /api/v1 前缀，此处不重复添加
export class XhsProxyController {
  constructor(private readonly proxyService: XhsProxyService) {}

  /**
   * 直播数据代理
   */
  @Get('live/:api')
  @ApiOperation({ summary: '获取直播相关数据' })
  async getLiveData(
    @Param('api') api: string,
    @Query() query: XhsProxyQueryDto,
  ) {
    const apiMapping: Record<string, string> = {
      'overview': '/api/sns/red/live/manager/v1/data/room/metric',
      'products': '/api/sns/red/live/manager/v1/data/goods/info',
      'viewers': '/api/sns/red/live/manager/v1/data/room/user_rank',
      'traffic': '/api/sns/red/live/manager/v1/data/room/traffic_detail',
      'goods-list': '/api/sns/red/live/manager/v2/mall/goods_list',
      'replay': '/api/sns/red/live/replay/room/data',
    };

    const apiPath = apiMapping[api];
    if (!apiPath) {
      throw new BadRequestException(`未知的 API: ${api}`);
    }

    const { _account, ...params } = query;
    return this.proxyService.request({
      api: apiPath,
      params,
      accountTag: _account,
    });
  }

  /**
   * 直播操作代理
   */
  @Post('live/action')
  @ApiOperation({ summary: '执行直播操作（讲解、弹窗等）' })
  async executeLiveAction(@Body() dto: XhsLiveActionDto) {
    const actionMapping: Record<string, string> = {
      'start-explain': '/api/sns/red/live/manager/v1/mall/goods_explain/start_explain',
      'stop-explain': '/api/sns/red/live/manager/v1/mall/goods_explain/stop_explain',
      'popup-card': '/api/sns/red/live/manager/v1/mall/goods_card/popup',
      'close-card': '/api/sns/red/live/manager/v1/mall/goods_card/close',
    };

    const apiPath = actionMapping[dto.action];
    if (!apiPath) {
      throw new BadRequestException(`未知的操作: ${dto.action}`);
    }

    return this.proxyService.request({
      method: 'POST',
      api: apiPath,
      data: dto.payload,
      accountTag: dto.accountTag,
    });
  }

  /**
   * 通用代理（高级用户）
   */
  @Post('proxy')
  @ApiOperation({ summary: '通用 API 代理' })
  async genericProxy(@Body() dto: XhsGenericProxyDto) {
    return this.proxyService.request({
      method: dto.method || 'GET',
      api: dto.api,
      params: dto.params,
      data: dto.data,
      accountTag: dto.accountTag,
      platform: dto.platform,
    });
  }
}
```

---

## 五、订单同步模块

### 5.1 同步服务实现

> **并发控制**：同步操作使用分布式锁防止同一账号并发同步，避免重复数据或竞争条件。
> 锁超时时间设为 5 分钟，覆盖正常同步时长。

```typescript
// sync/xhs-order-sync.service.ts

import { RedisLock } from '@/common/redis/redis-lock';
import { ApiErrorCode, BusinessException } from '@/common/errors';

@Injectable()
export class XhsOrderSyncService {
  private readonly logger = new Logger(XhsOrderSyncService.name);
  private readonly LOCK_TTL_MS = 5 * 60 * 1000; // 5 分钟锁超时

  constructor(
    private readonly prisma: PrismaService,
    private readonly proxyService: XhsProxyService,
    private readonly authService: XhsAuthService,
    private readonly redisLock: RedisLock,
  ) {}

  /**
   * 增量同步订单（带分布式锁）
   */
  async syncOrders(accountTag = 'default', options?: SyncOptions): Promise<SyncResult> {
    const lockKey = `xhs:sync:order:${accountTag}`;

    // 1. 尝试获取分布式锁
    const acquired = await this.redisLock.acquire(lockKey, this.LOCK_TTL_MS);
    if (!acquired) {
      throw new BusinessException({
        code: ApiErrorCode.XHS_SYNC_IN_PROGRESS,
        message: `账号 "${accountTag}" 的订单同步正在进行中，请稍后再试`,
      });
    }

    try {
      return await this.doSyncOrders(accountTag, options);
    } finally {
      // 确保释放锁
      await this.redisLock.release(lockKey);
    }
  }

  /**
   * 实际同步逻辑（内部方法）
   */
  private async doSyncOrders(accountTag: string, options?: SyncOptions): Promise<SyncResult> {
    const account = await this.authService.getAccount(accountTag);

    // 1. 获取同步水位
    const watermark = await this.getWatermark(accountTag, 'order');
    const startTime = options?.startTime || watermark?.lastSyncTime || this.getDefaultStartTime();
    const endTime = options?.endTime || new Date();

    this.logger.log(
      `开始同步订单: account=${accountTag}, range=${startTime.toISOString()} ~ ${endTime.toISOString()}`
    );

    let page = 1;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      // 2. 分页拉取订单
      const result = await this.fetchOrderPage(account, {
        startTime,
        endTime,
        page,
        pageSize: 50,
      });

      if (!result.items?.length) {
        hasMore = false;
        break;
      }

      // 3. 批量 upsert
      const synced = await this.upsertOrders(accountTag, result.items);
      totalSynced += synced;

      this.logger.log(`已同步第 ${page} 页，本页 ${synced} 条`);

      // 4. 检查是否还有下一页
      hasMore = result.items.length >= 50;
      page++;

      // 5. 避免请求过快
      await this.sleep(500);
    }

    // 6. 更新水位
    await this.updateWatermark(accountTag, 'order', endTime);

    this.logger.log(`同步完成: 共同步 ${totalSynced} 条订单`);
    return { synced: totalSynced, startTime, endTime };
  }

  /**
   * 同步订单状态更新（退款等，带分布式锁）
   */
  async syncOrderStatusUpdates(accountTag = 'default'): Promise<{ checked: number; updated: number }> {
    const lockKey = `xhs:sync:order-status:${accountTag}`;

    const acquired = await this.redisLock.acquire(lockKey, this.LOCK_TTL_MS);
    if (!acquired) {
      throw new BusinessException({
        code: ApiErrorCode.XHS_SYNC_IN_PROGRESS,
        message: `账号 "${accountTag}" 的订单状态更新正在进行中`,
      });
    }

    try {
      return await this.doSyncOrderStatusUpdates(accountTag);
    } finally {
      await this.redisLock.release(lockKey);
    }
  }

  private async doSyncOrderStatusUpdates(accountTag: string): Promise<{ checked: number; updated: number }> {
    // 获取本地「非终态」的订单
    const pendingOrders = await this.prisma.xhsOrder.findMany({
      where: {
        accountTag,
        orderStatus: { notIn: ['已完成', '已关闭', '已退款'] },
        payTime: { gte: this.getDaysAgo(30) },
      },
      select: { id: true, packageId: true, orderStatus: true },
    });

    this.logger.log(`检查 ${pendingOrders.length} 条待更新订单状态`);

    let updated = 0;
    for (const order of pendingOrders) {
      try {
        const latest = await this.fetchOrderDetail(accountTag, order.packageId);
        if (latest && latest.status !== order.orderStatus) {
          await this.prisma.xhsOrder.update({
            where: { id: order.id },
            data: {
              orderStatus: latest.status,
              refundAmount: latest.refundAmount,
              rawData: latest,
            },
          });
          updated++;
          this.logger.log(`订单 ${order.packageId} 状态更新: ${order.orderStatus} -> ${latest.status}`);
        }
        await this.sleep(200);
      } catch (error) {
        this.logger.warn(`检查订单 ${order.packageId} 状态失败: ${error.message}`);
      }
    }

    return { checked: pendingOrders.length, updated };
  }

  private async fetchOrderPage(
    account: XhsAccount,
    params: { startTime: Date; endTime: Date; page: number; pageSize: number },
  ): Promise<{ items: any[]; total: number }> {
    const result = await this.proxyService.request<any>({
      api: '/api/draco/distribution/data/seller_order_list',
      method: 'GET',
      params: {
        anchor_id: account.userId,
        start_time: params.startTime.getTime(),
        end_time: params.endTime.getTime(),
        page: params.page,
        size: params.pageSize,
      },
      platform: 'pgy',
    });

    return {
      items: result.list || [],
      total: result.total || 0,
    };
  }

  private async upsertOrders(accountTag: string, items: any[]): Promise<number> {
    let count = 0;
    for (const item of items) {
      try {
        await this.prisma.xhsOrder.upsert({
          where: {
            accountTag_packageId: { accountTag, packageId: item.package_id },
          },
          create: this.mapToCreateInput(accountTag, item),
          update: this.mapToUpdateInput(item),
        });
        count++;
      } catch (error) {
        this.logger.warn(`Upsert 订单 ${item.package_id} 失败: ${error.message}`);
      }
    }
    return count;
  }

  private mapToCreateInput(accountTag: string, item: any): Prisma.XhsOrderCreateInput {
    return {
      accountTag,
      packageId: item.package_id,
      orderStatus: item.order_package_status,
      payTime: item.pay_time ? new Date(item.pay_time) : null,
      itemId: item.item_id,
      skuId: item.sku_id,
      skuName: item.sku_name,
      skuImage: item.sku_image,
      skuPrice: item.sku_price,
      quantity: item.quantity || 1,
      userPayAmount: item.user_real_pay_amount,
      platformDiscount: item.platform_discount_amount,
      sellerIncome: item.seller_real_income_amount,
      commissionAmount: item.user_commission_amount,
      commissionRate: item.commission_rate,
      refundAmount: item.refund_amount,
      userId: item.user_id,
      userNickname: item.user_nickname,
      sellerId: item.seller_id,
      shopName: item.shop_name,
      roomId: item.biz_id,
      liveTitle: item.biz_title_name,
      liveStartTime: item.biz_start_time ? new Date(item.biz_start_time) : null,
      planType: item.plan_type,
      rawData: item,
    };
  }

  private mapToUpdateInput(item: any): Prisma.XhsOrderUpdateInput {
    return {
      orderStatus: item.order_package_status,
      refundAmount: item.refund_amount,
      rawData: item,
    };
  }

  private async getWatermark(accountTag: string, syncType: string) {
    return this.prisma.xhsSyncWatermark.findUnique({
      where: { accountTag_syncType: { accountTag, syncType } },
    });
  }

  private async updateWatermark(accountTag: string, syncType: string, lastSyncTime: Date) {
    await this.prisma.xhsSyncWatermark.upsert({
      where: { accountTag_syncType: { accountTag, syncType } },
      create: { accountTag, syncType, lastSyncTime },
      update: { lastSyncTime },
    });
  }

  private getDefaultStartTime(): Date {
    return this.getDaysAgo(90);
  }

  private getDaysAgo(days: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 5.2 定时任务

> **重要**：定时任务属于非 HTTP 场景，Prisma 写操作需要审计上下文。
> 必须使用 `runWithSystemAuditContext()` 包装所有涉及数据库写入的操作。

```typescript
// sync/xhs-sync.scheduler.ts

import { runWithSystemAuditContext } from '@/common/audit/audit-context';

@Injectable()
export class XhsSyncScheduler {
  private readonly logger = new Logger(XhsSyncScheduler.name);

  constructor(
    private readonly orderSyncService: XhsOrderSyncService,
    private readonly liveSyncService: XhsLiveSyncService,
    private readonly authService: XhsAuthService,
  ) {}

  /**
   * 每小时同步新订单
   */
  @Cron('0 0 * * * *')
  async syncOrdersHourly() {
    // 使用系统审计上下文包装，确保 Prisma 写操作有审计记录
    await runWithSystemAuditContext('XhsSyncScheduler.syncOrdersHourly', async () => {
      this.logger.log('开始定时同步订单...');

      const accounts = await this.authService.listAccounts();
      for (const account of accounts) {
        if (account.isExpired) {
          this.logger.warn(`跳过已过期账号: ${account.tag}`);
          continue;
        }

        try {
          const result = await this.orderSyncService.syncOrders(account.tag);
          this.logger.log(`账号 ${account.tag} 同步完成: ${result.synced} 条`);
        } catch (error) {
          this.logger.error(`同步账号 ${account.tag} 订单失败: ${error.message}`);
        }
      }
    });
  }

  /**
   * 每天凌晨检查订单状态更新（退款等）
   */
  @Cron('0 0 3 * * *')
  async syncOrderStatusDaily() {
    await runWithSystemAuditContext('XhsSyncScheduler.syncOrderStatusDaily', async () => {
      this.logger.log('开始检查订单状态更新...');

      const accounts = await this.authService.listAccounts();
      for (const account of accounts) {
        if (account.isExpired) continue;

        try {
          const result = await this.orderSyncService.syncOrderStatusUpdates(account.tag);
          this.logger.log(
            `账号 ${account.tag} 状态检查完成: 检查 ${result.checked} 条，更新 ${result.updated} 条`
          );
        } catch (error) {
          this.logger.error(`检查账号 ${account.tag} 订单状态失败: ${error.message}`);
        }
      }
    });
  }

  /**
   * 每天凌晨同步直播统计
   */
  @Cron('0 0 4 * * *')
  async syncLiveStatsDaily() {
    await runWithSystemAuditContext('XhsSyncScheduler.syncLiveStatsDaily', async () => {
      this.logger.log('开始同步直播统计...');

      const accounts = await this.authService.listAccounts();
      for (const account of accounts) {
        if (account.isExpired) continue;

        try {
          const result = await this.liveSyncService.syncRecentLives(account.tag);
          this.logger.log(`账号 ${account.tag} 直播统计同步完成: ${result.synced} 场`);
        } catch (error) {
          this.logger.error(`同步账号 ${account.tag} 直播统计失败: ${error.message}`);
        }
      }
    });
  }
}
```

---

## 六、错误码定义

> **错误码段分配说明**：
> - 15000-15999：ScriptUpload 模块（已占用）
> - 16000-16999：预留给后续模块
> - 17000-17999：小红书模块（本模块）

```typescript
// 在 error-codes.ts 中添加（使用 17000-17999 命名空间）

export const ApiErrorCode = {
  // ... existing codes ...

  // 17000-17999: 小红书模块

  // 认证相关 (170xx)
  XHS_ACCOUNT_NOT_FOUND: 17000,      // 账号未配置
  XHS_AUTH_EXPIRED: 17001,           // Cookie 已过期
  XHS_AUTH_INVALID: 17002,           // Cookie 无效

  // API 请求相关 (171xx)
  XHS_API_ERROR: 17100,              // 小红书接口返回错误
  XHS_REQUEST_FAILED: 17101,         // 请求失败
  XHS_RATE_LIMITED: 17102,           // 请求频率限制

  // 同步相关 (172xx)
  XHS_SYNC_IN_PROGRESS: 17200,       // 同步进行中
  XHS_SYNC_FAILED: 17201,            // 同步失败
};
```

---

## 七、Zod DTO 定义

> **规范**：本项目使用 Zod + nestjs-zod，所有 DTO 必须通过 `createZodDto(schema)` 导出。
> Query 参数中的数字必须使用 `z.coerce.number()` 做类型收敛。

### 7.1 代理相关 DTO

```typescript
// dto/xhs-proxy.dto.ts

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// 代理查询参数
const xhsProxyQuerySchema = z.object({
  _account: z.string().optional().describe('使用的账号标识'),
  room_id: z.string().optional().describe('直播间 ID'),
  biz_id: z.string().optional().describe('业务 ID'),
  anchor_id: z.string().optional().describe('主播 ID'),
});

export class XhsProxyQueryDto extends createZodDto(xhsProxyQuerySchema) {}

// 直播操作 DTO
const xhsLiveActionSchema = z.object({
  action: z.enum([
    'start-explain',
    'stop-explain',
    'popup-card',
    'close-card',
  ]).describe('操作类型'),
  payload: z.record(z.unknown()).describe('操作载荷'),
  accountTag: z.string().optional().default('default').describe('账号标识'),
});

export class XhsLiveActionDto extends createZodDto(xhsLiveActionSchema) {}

// 通用代理 DTO
const xhsGenericProxySchema = z.object({
  api: z.string().min(1).describe('API 路径'),
  method: z.enum(['GET', 'POST']).optional().default('GET'),
  params: z.record(z.unknown()).optional().describe('URL 查询参数'),
  data: z.unknown().optional().describe('POST 请求体'),
  accountTag: z.string().optional().default('default'),
  platform: z.enum(['live-assistant', 'pgy', 'redlive', 'ark']).optional(),
});

export class XhsGenericProxyDto extends createZodDto(xhsGenericProxySchema) {}
```

### 7.2 订单查询 DTO

> **规范**：根据项目规范 5.5，验证错误消息必须使用中文。

```typescript
// dto/xhs-order-query.dto.ts

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const xhsOrderQuerySchema = z.object({
  // 分页（使用 coerce 处理 query string，添加中文错误消息）
  page: z.coerce
    .number({ invalid_type_error: '页码必须为数字' })
    .int({ message: '页码必须为整数' })
    .min(1, { message: '页码至少为 1' })
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: '每页数量必须为数字' })
    .int({ message: '每页数量必须为整数' })
    .min(1, { message: '每页至少 1 条' })
    .max(100, { message: '每页最多 100 条' })
    .default(20),

  // 筛选条件
  accountTag: z.string().optional().default('default'),
  orderStatus: z.string().optional().describe('订单状态'),
  startTime: z.coerce.date({ invalid_type_error: '开始时间格式无效' }).optional(),
  endTime: z.coerce.date({ invalid_type_error: '结束时间格式无效' }).optional(),
  roomId: z.string().optional().describe('直播间 ID'),
  keyword: z.string().max(100, { message: '搜索关键词最多 100 字符' }).optional(),

  // 排序
  sortBy: z.enum(['payTime', 'commissionAmount', 'userPayAmount'], {
    errorMap: () => ({ message: '排序字段无效，可选值：payTime, commissionAmount, userPayAmount' }),
  }).optional().default('payTime'),
  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: '排序方向无效，可选值：asc, desc' }),
  }).optional().default('desc'),
});

export class XhsOrderQueryDto extends createZodDto(xhsOrderQuerySchema) {}

// 订单统计查询
const xhsOrderStatsQuerySchema = z.object({
  accountTag: z.string().optional().default('default'),
  startTime: z.coerce.date({
    required_error: '统计开始时间必填',
    invalid_type_error: '开始时间格式无效',
  }),
  endTime: z.coerce.date({
    required_error: '统计结束时间必填',
    invalid_type_error: '结束时间格式无效',
  }),
  groupBy: z.enum(['day', 'week', 'month', 'room'], {
    errorMap: () => ({ message: '分组维度无效，可选值：day, week, month, room' }),
  }).optional().default('day'),
});

export class XhsOrderStatsQueryDto extends createZodDto(xhsOrderStatsQuerySchema) {}
```

### 7.3 直播统计查询 DTO

```typescript
// dto/xhs-live-stats-query.dto.ts

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const xhsLiveStatsQuerySchema = z.object({
  page: z.coerce
    .number({ invalid_type_error: '页码必须为数字' })
    .int({ message: '页码必须为整数' })
    .min(1, { message: '页码至少为 1' })
    .default(1),
  limit: z.coerce
    .number({ invalid_type_error: '每页数量必须为数字' })
    .int({ message: '每页数量必须为整数' })
    .min(1, { message: '每页至少 1 条' })
    .max(100, { message: '每页最多 100 条' })
    .default(20),

  accountTag: z.string().optional().default('default'),
  startTime: z.coerce.date({ invalid_type_error: '开始时间格式无效' }).optional(),
  endTime: z.coerce.date({ invalid_type_error: '结束时间格式无效' }).optional(),

  sortBy: z.enum(['liveStartTime', 'totalSales', 'totalCommission', 'peakViewers'], {
    errorMap: () => ({ message: '排序字段无效，可选值：liveStartTime, totalSales, totalCommission, peakViewers' }),
  }).optional().default('liveStartTime'),
  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: () => ({ message: '排序方向无效，可选值：asc, desc' }),
  }).optional().default('desc'),
});

export class XhsLiveStatsQueryDto extends createZodDto(xhsLiveStatsQuerySchema) {}
```

### 7.4 同步触发 DTO

```typescript
// dto/xhs-sync-trigger.dto.ts

import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const xhsSyncTriggerSchema = z.object({
  accountTag: z.string().optional().default('default').describe('账号标识'),
  startTime: z.coerce.date().optional().describe('同步起始时间'),
  endTime: z.coerce.date().optional().describe('同步结束时间'),
});

export class XhsSyncTriggerDto extends createZodDto(xhsSyncTriggerSchema) {}

// 同步状态响应
const xhsSyncStatusSchema = z.object({
  accountTag: z.string(),
  syncType: z.enum(['order', 'live']),
  lastSyncTime: z.date().nullable(),
  isRunning: z.boolean(),
});

export class XhsSyncStatusDto extends createZodDto(xhsSyncStatusSchema) {}
```

### 7.5 DTO 索引文件

```typescript
// dto/index.ts

export * from './xhs-proxy.dto';
export * from './xhs-order-query.dto';
export * from './xhs-live-stats-query.dto';
export * from './xhs-sync-trigger.dto';
```

---

## 八、实现步骤

### Phase 1：基础设施

1. [ ] 创建 Prisma Schema 并执行迁移
2. [ ] 添加错误码到 `error-codes.ts` (17000-17999)
3. [ ] 实现 `XhsSignatureUtil` 签名工具
4. [ ] 实现 `XhsAuthService` 认证管理

### Phase 2：API 代理

5. [ ] 实现 `XhsProxyService` 请求封装
6. [ ] 实现 `XhsProxyController` 代理接口
7. [ ] 编写代理接口 E2E 测试

### Phase 3：数据同步

8. [ ] 实现 `XhsOrderSyncService` 订单同步
9. [ ] 实现 `XhsLiveSyncService` 直播统计同步
10. [ ] 实现 `XhsSyncScheduler` 定时任务
11. [ ] 实现 `XhsSyncController` 手动触发接口

### Phase 4：数据查询

12. [ ] 实现 `XhsOrderService` 订单查询
13. [ ] 实现 `XhsOrderController` 订单接口
14. [ ] 实现 `XhsLiveStatsService` 直播统计查询
15. [ ] 实现 `XhsLiveStatsController` 直播统计接口

### Phase 5：测试与文档

16. [ ] 单元测试（签名、认证）
17. [ ] E2E 测试（同步、查询）
18. [ ] Swagger API 文档
19. [ ] 油猴脚本对接指南
