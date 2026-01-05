# 依赖管理规范

> 本文档是依赖管理的**唯一事实来源**。

## 强制级别说明

| 标记 | 含义 | PR 影响 |
|------|------|---------|
| 🔴 | 阻塞 - 违反即拒绝 PR | 必须修复 |
| 🟡 | 建议修复 - 允许例外但需说明理由 | 应当修复 |
| 🟢 | 建议 - 经验性最佳实践 | 可选 |

---

## 版本兼容矩阵

### 运行时依赖

| 依赖 | 最低版本 | 推荐版本 | 最高测试版本 | 说明 |
|------|----------|----------|--------------|------|
| Node.js | 20.0.0 | 20.x LTS | 22.x | 仅支持 LTS 版本 |
| pnpm | 9.0.0 | 9.x | 9.x | 锁定大版本 |
| PostgreSQL | 14 | 16 | 17 | 生产环境推荐 16 |
| Redis | 6.0 | 7.x | 7.x | 支持 Cluster 模式 |

### 框架版本

| 框架 | 当前版本 | 升级策略 |
|------|----------|----------|
| NestJS | 11.x | 跟随官方 LTS |
| React (Web) | 19.x | 跟随稳定版 |
| React (小程序) | 18.x | 受 Taro 限制 |
| Taro | 4.x | 跟随官方稳定版 |
| Prisma | 5.x | 跟随官方稳定版 |

---

## 依赖锁定策略 🔴

### pnpm-lock.yaml

| 规则 | 级别 |
|------|------|
| 🔴 必须提交 `pnpm-lock.yaml` | 确保构建可重现 |
| 🔴 禁止手动编辑 lock 文件 | 由 pnpm 自动管理 |
| 🔴 CI 使用 `--frozen-lockfile` | 防止意外更新 |

```bash
# 🔴 CI 安装命令
pnpm install --frozen-lockfile

# 🔴 禁止在 CI 中使用
pnpm install  # 可能更新 lock 文件
```

### 版本号规范

```json
{
  "dependencies": {
    // 🔴 生产依赖：锁定主版本
    "react": "^19.2.0",
    "zod": "^4.2.1",

    // 🟡 workspace 依赖
    "@{{NAME}}/shared-types": "workspace:*"
  },
  "devDependencies": {
    // 🟡 开发依赖：可使用 ^ 或 ~
    "typescript": "~5.9.3",
    "eslint": "^9.39.1"
  }
}
```

---

## 新增依赖流程 🔴

### 评估清单

新增依赖前必须评估：

| 评估项 | 检查内容 | 级别 |
|--------|----------|------|
| 🔴 必要性 | 是否有现有依赖可替代？ | 必查 |
| 🔴 维护状态 | 最近更新时间？Issue 响应？ | 必查 |
| 🔴 安全性 | 是否有已知漏洞？ | 必查 |
| 🟡 体积影响 | 包大小？是否支持 tree-shaking？ | 应查 |
| 🟡 许可证 | 是否与项目兼容？ | 应查 |

### 审批流程

| 依赖类型 | 审批要求 |
|----------|----------|
| 常规工具库 | PR Review 通过即可 |
| 核心框架依赖 | 需要技术负责人批准 |
| 涉及安全的依赖 | 需要安全评审 |

### 添加步骤

```bash
# 1. 添加依赖
pnpm --filter <app> add <package>

# 2. 在 PR 描述中说明
- 为什么需要这个依赖
- 是否评估过替代方案
- 包大小影响

# 3. 确保 lock 文件更新
git add pnpm-lock.yaml
```

---

## 版本升级策略 🟡

### 升级频率

| 依赖类型 | 升级频率 | 说明 |
|----------|----------|------|
| 安全补丁 | 立即 | 发现漏洞后 24h 内 |
| Bug 修复 (patch) | 每周 | 合并到周更新 |
| 新功能 (minor) | 每月 | 月度维护窗口 |
| 大版本 (major) | 按需 | 需要评估和计划 |

### 升级流程

```bash
# 1. 检查过时依赖
pnpm outdated

# 2. 小版本更新（安全）
pnpm update

# 3. 大版本更新（谨慎）
pnpm --filter <app> add <package>@latest

# 4. 运行测试
pnpm test
pnpm build

# 5. 提交 PR，说明升级内容和影响
```

### 大版本升级清单

- [ ] 阅读 CHANGELOG 和迁移指南
- [ ] 在独立分支测试
- [ ] 更新相关代码适配
- [ ] 全量测试通过
- [ ] 更新文档（如有 Breaking Changes）

---

## 安全扫描 🔴

### 自动扫描

```bash
# 检查已知漏洞
pnpm audit

# CI 中配置
- name: Security audit
  run: pnpm audit --audit-level=high
```

### 漏洞响应

| 严重程度 | 响应时间 | 处理方式 |
|----------|----------|----------|
| Critical | 24h | 立即升级或移除 |
| High | 48h | 尽快升级 |
| Medium | 1 周 | 计划升级 |
| Low | 1 月 | 常规维护 |

---

## 禁止依赖清单 🔴

| 依赖 | 原因 | 替代方案 |
|------|------|----------|
| moment.js | 体积大，已停止维护 | date-fns |
| lodash (完整包) | 体积大 | lodash-es 或原生方法 |
| request | 已废弃 | axios 或 fetch |
| node-uuid | 已废弃 | uuid |

---

## Monorepo 特殊规则 🔴

### Workspace 依赖

```json
{
  "dependencies": {
    // 🔴 内部包使用 workspace 协议
    "@{{NAME}}/shared-types": "workspace:*",
    "@{{NAME}}/shared-utils": "workspace:*"
  }
}
```

### 依赖提升

| 规则 | 说明 |
|------|------|
| 🔴 共享依赖放根目录 | TypeScript, ESLint 等 |
| 🔴 应用特有依赖放各自目录 | NestJS, React 等 |
| 🟡 避免版本冲突 | 同一依赖尽量统一版本 |
