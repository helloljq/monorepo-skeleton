# Git 工作流

> 本仓库的 Git 约定对齐 `engineering_foundation`：
>
> - 分支/PR：`engineering_foundation/docs/05-git-workflow/git-workflow.md`
> - Commit message / hooks / CI：`engineering_foundation/docs/04-quality-gate/quality-gate.md`

## 分支策略（MUST）

- 主分支：`main`
- 不维护长期 `develop` 分支
- 团队仓库：**禁止**直接推送 `main`，所有变更必须通过 PR 合并
- 功能分支命名：`<type>/<name>`（`kebab-case`）
  - 允许的 `type`：`feat|fix|refactor|perf|test|chore|docs|hotfix`
  - 示例：`feat/add-user-login`、`fix/123-payment-bug`、`hotfix/v1.2.1`

> 说明：若你是单人维护仓库并希望允许直推 `main`，需先满足 `engineering_foundation` 的 Solo Repo Mode 验收要求（质量门禁/可回滚/可追溯）。

## Commit message 规范（MUST）

格式：

```
<type>(<scope?>): <subject>
```

- `type`：`feat|fix|docs|style|refactor|test|chore|build|perf|ci|revert`
- `subject`：不能为空；小写开头；不以 `.` 结尾

示例：

```
feat(auth): add web cookie login
fix(ci): fail on lint warnings
```

## PR 规范（MUST）

- PR 标题必须符合 Conventional Commits（scope 可选）：`feat: add xxx`
- PR 描述使用模板：`.github/pull_request_template.md`
- PR 校验工作流：`.github/workflows/pr-lint.yml`

## 日常开发流程

```bash
# 1) 拉取主分支
git checkout main
git pull origin main

# 2) 创建分支
git checkout -b feat/add-user-login

# 3) 开发 + 提交（本地会触发 husky：pre-commit/commit-msg）
git add .
git commit -m "feat(auth): add web cookie login"

# 4) 推送并创建 PR（目标分支：main）
git push -u origin feat/add-user-login
```

## 禁止操作（MUST NOT）

- `git push` 到 `main`（团队仓库）
- `git push --force` 到 `main`
- 绕过 CI/质量门禁合并
