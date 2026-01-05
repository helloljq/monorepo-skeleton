# CI/CD 流程

## 流程概览

```
代码提交 → CI 检查 → Code Review → 合并 → 自动部署
    │          │           │          │         │
    │          │           │          │         ├─ develop → dev 环境
    │          │           │          │         ├─ release/* → staging 环境
    │          │           │          │         └─ main → production 环境
    │          │           │          │
    │          │           │          └─ Squash Merge
    │          │           │
    │          │           └─ 至少 1 人批准
    │          │
    │          └─ Build + Lint + Typecheck + Test
    │
    └─ 创建 PR
```

---

## CI 流水线

### 触发条件

- Push 到 `main` 或 `develop` 分支
- 创建 Pull Request

### 检查步骤

```yaml
# .github/workflows/ci.yml
jobs:
  build:
    steps:
      - name: 安装依赖
        run: pnpm install --frozen-lockfile

      - name: 生成 Prisma Client
        run: pnpm --filter server prisma:generate

      - name: 代码检查
        run: pnpm lint

      - name: 类型检查
        run: pnpm typecheck

      - name: 构建
        run: pnpm build

  test:
    needs: build
    steps:
      - name: 运行测试
        run: pnpm test
```

### PR 合并要求

- [ ] CI 检查全部通过
- [ ] 至少 1 位 Reviewer 批准
- [ ] 无未解决的评论
- [ ] 分支已更新到最新 base

---

## 部署流程

### 开发环境 (dev)

**触发**: 合并到 `develop` 分支

```bash
# 自动执行
1. 构建 Docker 镜像
2. 推送到镜像仓库
3. 更新 dev 环境 Deployment
4. 执行数据库迁移
5. 健康检查
```

### 预发布环境 (staging)

**触发**: 创建 `release/*` 分支

```bash
# 自动执行
1. 构建 Docker 镜像（带版本标签）
2. 部署到 staging 环境
3. 执行数据库迁移
4. 运行 E2E 测试
5. 通知相关人员验证
```

### 生产环境 (production)

**触发**: 合并到 `main` 分支（需手动批准）

```bash
# 自动执行（需人工批准门禁）
1. 构建生产镜像
2. 滚动更新部署
3. 执行数据库迁移
4. 健康检查
5. 验证核心功能
6. 保留旧版本用于回滚
```

---

## 发布流程

### 版本号规范

遵循 [Semantic Versioning](https://semver.org/)：

```
MAJOR.MINOR.PATCH
  │      │     │
  │      │     └─ 向后兼容的 Bug 修复
  │      └─ 向后兼容的新功能
  └─ 不兼容的 API 变更
```

### 发布步骤

```bash
# 1. 从 develop 创建 release 分支
git checkout develop
git pull
git checkout -b release/v1.2.0

# 2. 更新版本号
# 编辑 package.json 等

# 3. 提交并推送
git commit -m "chore: bump version to v1.2.0"
git push -u origin release/v1.2.0

# 4. 在 staging 环境验证

# 5. 验证通过后，合并到 main
# 创建 PR: release/v1.2.0 → main

# 6. 打 Tag
git checkout main
git pull
git tag v1.2.0
git push origin v1.2.0

# 7. 合并回 develop
git checkout develop
git merge main
git push
```

### 发布清单

- [ ] 更新 CHANGELOG.md
- [ ] 版本号已更新
- [ ] staging 环境验证通过
- [ ] 数据库迁移脚本已测试
- [ ] 相关方已通知
- [ ] 回滚方案已准备

---

## 回滚策略

### 应用回滚

```bash
# Kubernetes 回滚到上一版本
kubectl rollout undo deployment/server -n production

# 或指定版本
kubectl rollout undo deployment/server -n production --to-revision=5
```

### 数据库回滚

- **【强制】迁移脚本必须支持回滚**
- **【强制】生产回滚前必须备份**
- **【推荐】使用蓝绿部署减少回滚需求**

---

## 监控与告警

### 部署监控

| 指标 | 阈值 | 告警方式 |
|------|------|----------|
| 部署失败 | 任何失败 | 即时通知 |
| 健康检查失败 | 连续 3 次 | 即时通知 |
| 错误率上升 | > 1% | 5 分钟内通知 |
| 响应时间上升 | P99 > 2s | 10 分钟内通知 |

### 发布后验证

```bash
# 自动执行
1. 健康检查通过
2. 核心 API 响应正常
3. 错误率无异常上升
4. 响应时间无异常上升
```

---

## 紧急发布

### Hotfix 流程

```bash
# 1. 从 main 创建 hotfix 分支
git checkout main
git checkout -b hotfix/fix-critical-bug

# 2. 修复问题
# 编写代码和测试

# 3. 创建 PR → main（加急审查）

# 4. 合并后自动部署

# 5. 合并回 develop
git checkout develop
git merge main
git push
```

### 紧急发布条件

- 生产环境严重故障
- 安全漏洞
- 数据损坏风险

### 紧急发布要求

- [ ] 最小化变更范围
- [ ] 至少 1 人审查
- [ ] 快速回归测试
- [ ] 发布后持续监控 30 分钟
