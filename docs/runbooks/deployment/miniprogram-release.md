# 微信小程序发布流程

本文档描述{{TITLE}}微信小程序的完整发布流程。

---

## 一、发布前准备

### 1.1 配置检查清单

- [ ] `project.config.json` 中 `appid` 已替换为真实值
- [ ] 后端 API 地址配置正确
- [ ] 已在微信公众平台配置服务器域名
- [ ] 本地构建测试通过

### 1.2 服务器域名配置

在 [微信公众平台](https://mp.weixin.qq.com/) 配置：

**路径**: 开发管理 → 开发设置 → 服务器域名

| 域名类型              | 配置值                   |
| --------------------- | ------------------------ |
| request 合法域名      | `https://api.{{DOMAIN}}` |
| uploadFile 合法域名   | `https://api.{{DOMAIN}}` |
| downloadFile 合法域名 | `https://api.{{DOMAIN}}` |

---

## 二、手动发布流程（推荐）

### 步骤 1: 构建小程序

```bash
# 进入小程序目录
cd apps/miniprogram

# 安装依赖
pnpm install

# 构建生产版本
pnpm build
```

### 步骤 2: 使用微信开发者工具上传

1. 打开 **微信开发者工具**
2. 导入项目：选择 `apps/miniprogram/dist` 目录
3. 确认 AppID 正确显示
4. 点击 **上传** 按钮
5. 填写版本号和版本描述

**版本号规范**:

- 格式: `主版本.次版本.修订版本` (如 `1.2.3`)
- 与项目版本保持一致

### 步骤 3: 提交审核

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入 **版本管理**
3. 找到刚上传的开发版本
4. 点击 **提交审核**
5. 填写审核信息

### 步骤 4: 发布上线

审核通过后：

1. 在版本管理中找到审核通过的版本
2. 点击 **发布** 按钮
3. 确认发布

---

## 三、CI 自动上传（可选）

如需 CI 自动上传到微信后台，按以下步骤配置：

### 3.1 获取上传密钥

1. 登录微信公众平台
2. 进入 **开发管理 → 开发设置**
3. 找到 **小程序代码上传**
4. 下载代码上传密钥
5. 添加开发者 IP 白名单（GitHub Actions IP 或 `0.0.0.0/0`）

### 3.2 配置 GitHub Secrets

| Secret 名称              | 说明                        |
| ------------------------ | --------------------------- |
| `MINIPROGRAM_APPID`      | 小程序 AppID                |
| `MINIPROGRAM_UPLOAD_KEY` | 上传密钥内容（Base64 编码） |

### 3.3 CI 配置文件

创建 `.github/workflows/miniprogram.yml`：

```yaml
name: Miniprogram CI

on:
  push:
    branches: [main]
    paths:
      - "apps/miniprogram/**"
  workflow_dispatch:
    inputs:
      version:
        description: "版本号 (如 1.0.0)"
        required: true
      desc:
        description: "版本描述"
        required: true

jobs:
  build-and-upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build miniprogram
        run: pnpm --filter @{{NAME}}/miniprogram build

      - name: Setup miniprogram-ci
        run: npm install -g miniprogram-ci

      - name: Upload to WeChat
        env:
          APPID: ${{ secrets.MINIPROGRAM_APPID }}
        run: |
          echo "${{ secrets.MINIPROGRAM_UPLOAD_KEY }}" | base64 -d > private.key

          VERSION="${{ github.event.inputs.version || '0.0.0' }}"
          DESC="${{ github.event.inputs.desc || 'CI 自动上传' }}"

          miniprogram-ci upload \
            --pp apps/miniprogram/dist \
            --pkp ./private.key \
            --appid $APPID \
            --uv $VERSION \
            --ud "$DESC" \
            -r 1

          rm private.key
```

---

## 四、环境配置

### 4.1 API 地址配置

在 `apps/miniprogram/src/config/index.ts` 中配置：

```typescript
// API 基础地址
export const API_BASE_URL =
  process.env.TARO_APP_API_BASE_URL || "https://api.{{DOMAIN}}";
```

### 4.2 构建时注入

```bash
# 开发环境
TARO_APP_API_BASE_URL=http://localhost:8100 pnpm dev

# 生产环境
TARO_APP_API_BASE_URL=https://api.{{DOMAIN}} pnpm build
```

---

## 五、常见问题

### Q: 上传失败提示 "请求过于频繁"

**A**: 微信限制上传频率，等待几分钟后重试。

### Q: 预览时提示 "网络请求失败"

**A**:

1. 检查服务器域名是否已配置
2. 开发时可在开发者工具中勾选「不校验合法域名」

### Q: 审核被拒绝

**A**: 常见原因：

- 未填写隐私协议
- 功能未完善
- 存在 Bug
- 违反小程序规范

查看审核结果中的具体原因并修复。

---

## 六、发布检查清单

### 发布前

- [ ] 代码已合并到 main 分支
- [ ] 本地构建测试通过
- [ ] 真机预览测试通过
- [ ] 后端 API 已部署
- [ ] 服务器域名已配置

### 发布后

- [ ] 线上版本功能验证
- [ ] 关键流程测试
- [ ] 用户反馈监控
