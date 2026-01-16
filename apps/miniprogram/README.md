# @{{NAME}}/miniprogram

{{TITLE}}微信小程序，基于 Taro 4 + React。

## 开发

> 注意：Taro 工具链对 Node 版本较敏感；开发小程序请使用 Node.js >= 20（如遇 Node.js 22 兼容问题，建议切换到 Node.js 20）。

```bash
# 安装依赖
pnpm install

# 启动开发模式
pnpm dev

# 构建生产版本
pnpm build
```

## 技术栈

- Taro 4
- React 18
- TypeScript
- Sass

## 开发说明

1. 运行 `pnpm dev` 启动开发模式
2. 打开微信开发者工具，导入项目目录下的 `dist` 文件夹
3. 修改代码后会自动重新编译

## 配置

- `project.config.json` - 微信小程序项目配置
- `config/index.ts` - Taro 构建配置
- `src/app.config.ts` - 小程序全局配置
