# @{{NAME}}/shared-utils

{{TITLE}}共享工具函数包，用于前后端共享的通用工具。

## 使用

```typescript
import { isValidPhone, formatAmount, uuid } from '@{{NAME}}/shared-utils'
```

## 包含工具

### 校验

- `isValidPhone(phone)` - 校验手机号格式
- `isValidEmail(email)` - 校验邮箱格式
- `PHONE_REGEX` - 手机号正则
- `EMAIL_REGEX` - 邮箱正则

### 金额

- `formatAmount(cents)` - 格式化金额（分 -> 元）
- `parseAmount(yuan)` - 解析金额（元 -> 分）

### 通用

- `sleep(ms)` - 延时函数
- `uuid()` - 生成 UUID v4
- `safeJsonParse(json, fallback)` - 安全解析 JSON
- `isEmpty(obj)` - 对象是否为空
- `removeUndefined(obj)` - 移除对象中的 undefined 值
