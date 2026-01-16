# 贡献指南

感谢你对 {{TITLE}} 项目的贡献！

## 快速开始

### 1. 环境准备

```bash
# 克隆仓库
git clone <repo-url>
cd {{TITLE}}

# 安装依赖
pnpm install

# 配置环境变量（按应用存放；仅提交 .env.example）
cp apps/server/.env.example apps/server/.env
cp apps/admin-web/.env.example apps/admin-web/.env
cp apps/www-web/.env.example apps/www-web/.env
# 小程序如需本地构建环境变量：cp apps/miniprogram/.env.example apps/miniprogram/.env
```

详细环境配置请参考 [入职指南](./docs/runbooks/development/onboarding.md)。

### 2. 开发流程

```
领取任务 → 创建分支 → 开发实现 → 提交代码 → 创建 PR → Code Review → 合并
```

---

## 规范引用

本项目采用「单一事实来源」原则，各类规范在指定文档中定义：

| 规范类型               | 唯一来源                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| Git 工作流、分支、提交 | [git-workflow.md](./docs/runbooks/development/git-workflow.md)         |
| 代码风格               | [code-style.md](./docs/runbooks/development/code-style.md)             |
| 测试规范               | [testing.md](./docs/runbooks/development/testing.md)                   |
| Code Review            | [review-checklist.md](./docs/runbooks/development/review-checklist.md) |

---

## 提交前检查

```bash
pnpm lint        # 代码检查
pnpm typecheck   # 类型检查
pnpm test        # 运行测试
```

---

## Pull Request

### PR 要求

- 🔴 CI 检查全部通过
- 🔴 至少 1 位 Reviewer 批准
- 🔴 无未解决的评论
- 🟡 填写 PR 描述模板

### PR 描述模板

```markdown
## 变更说明

- 简述做了什么变更
- 为什么要做这个变更

## 测试计划

- [ ] 单元测试通过
- [ ] 手动测试步骤...

## 截图（如有 UI 变更）
```

---

## 各应用开发规范

| 应用        | 规范文档                                                   |
| ----------- | ---------------------------------------------------------- |
| Server      | [apps/server/CLAUDE.md](./apps/server/CLAUDE.md)           |
| Admin Web   | [apps/admin-web/CLAUDE.md](./apps/admin-web/CLAUDE.md)     |
| WWW Web     | [apps/www-web/CLAUDE.md](./apps/www-web/CLAUDE.md)         |
| Miniprogram | [apps/miniprogram/CLAUDE.md](./apps/miniprogram/CLAUDE.md) |

---

## 文档规范

| 类型         | 位置                    |
| ------------ | ----------------------- |
| 跨应用文档   | `/docs/`                |
| 应用内部文档 | `/apps/*/docs/`         |
| 包使用说明   | `/packages/*/README.md` |

### 文档命名

- 通用文档: `kebab-case.md`
- ADR: `NNN-title.md`
- PRD: `YYYYMMDD-feature-name.md`

---

## 问题反馈

1. 查看现有 Issues
2. 创建新 Issue，使用相应模板
3. 提供足够的上下文和复现步骤
