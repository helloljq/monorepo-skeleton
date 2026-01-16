# CI/CD 流程

> 对齐 `engineering_foundation`：CI/CD 规范 + ADR-DEPLOY-001（dev/staging/prod 触发策略）。

## 触发策略（ADR-DEPLOY-001）

- dev：`push main` 自动部署（建议以 CI green 为前置）
- staging：手动触发部署（workflow_dispatch）
- production：`vX.Y.Z` tag 触发 + 环境审批（GitHub Environments）

## 工作流文件

- CI：`.github/workflows/ci.yml`
  - PR：`format:check + lint:ci + typecheck + test`
  - main：额外执行 `build`
  - PR 提交范围：`commitlint`
- PR 规范校验：`.github/workflows/pr-lint.yml`
- Dev 自动部署（占位）：`.github/workflows/deploy-dev.yml`
- Staging/Prod 部署：`.github/workflows/cd.yml`

## CI（合并前质量闸门）

### PR 触发

- 目标分支：`main`
- 草稿 PR 默认跳过（节省 CI 资源）

### 质量闸门（MUST）

CI 必须通过以下检查才允许合并：

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint:ci
pnpm typecheck
pnpm test
pnpm build   # 仅 main 分支执行（见 ci.yml）
```

## CD（部署）

### Dev（自动）

触发：push `main`（见 `.github/workflows/deploy-dev.yml`）

> 说明：此工作流为占位模板，请按实际部署平台（Docker/Vercel/K8s/Serverless）替换部署步骤。

### Staging（手动）

触发：`workflow_dispatch`（见 `.github/workflows/cd.yml`）

- 建议在 GitHub Settings > Environments 创建 `staging`
- 可选开启审批（Required reviewers）

### Production（Tag + 审批）

触发：push tag `vX.Y.Z`（见 `.github/workflows/cd.yml`）

- 必须在 GitHub Settings > Environments 创建 `production`
- 必须开启审批（Required reviewers）
- 版本可追溯：Tag/SHA
- 回滚入口：重新部署旧 tag 对应镜像/产物

## Secrets / Vars 清单（最小集）

按实际部署方式补齐；本仓库提供的 `cd.yml` 中已列出需要的 Secrets（Docker Registry + 各环境 SSH/DB/Redis/JWT/CORS 等）。
