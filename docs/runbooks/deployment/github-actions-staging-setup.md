# GitHub Actions Staging 部署配置

> 对齐 `engineering_foundation`：CI/CD 规范 + ADR-DEPLOY-001（staging 默认手动触发）。

## 目标

- 使用 `.github/workflows/cd.yml` 通过 `workflow_dispatch` 部署到 staging
- 使用 GitHub Environments 管理 staging 的 Secrets/审批（可选）

## 1) 创建 GitHub Environment

路径：GitHub 仓库 → Settings → Environments

- 新建：`staging`
- 审批（可选）：Required reviewers

## 2) 配置 Secrets

按 `cd.yml` 顶部注释中的清单配置（示例：Docker Registry、SSH、Postgres/Redis/JWT/CORS 等）。

建议：

- `DOCKER_*` 放在 Repository secrets（多环境共用）
- `STAGING_*` 放在 Environment secrets（仅 staging）

## 3) 手动触发部署（workflow_dispatch）

路径：GitHub 仓库 → Actions → CD → Run workflow

- `environment`：选择 `staging`
- 点击 Run

> 说明：默认不通过 `release/*` 分支触发 staging（避免长期分支治理成本）。

## 4) 验证与排障

- Actions 日志：检查 build/push/deploy 步骤是否成功
- 服务健康检查：`/health`
- 指标抓取：`/metrics`（如已接入 Prometheus）
