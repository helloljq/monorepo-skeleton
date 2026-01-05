# Git 工作流

> 本文档是 Git 规范的**唯一事实来源**，其他文档通过链接引用。

## 分支策略

### 主要分支

| 分支 | 说明 | 保护规则 |
|------|------|----------|
| `main` | 生产环境代码 | 🔴 禁止直接推送，必须通过 PR |
| `develop` | 开发环境代码 | 🔴 禁止直接推送，必须通过 PR |

### 功能分支命名

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 功能 | `feat/<scope>/<desc>` | `feat/server/add-user-api` |
| 修复 | `fix/<scope>/<desc>` | `fix/admin-web/login-error` |
| 文档 | `docs/<desc>` | `docs/update-readme` |
| 重构 | `refactor/<scope>/<desc>` | `refactor/server/auth-module` |
| 发布 | `release/v<version>` | `release/v1.2.0` |
| 热修复 | `hotfix/<desc>` | `hotfix/fix-payment-bug` |

---

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范。

### 格式

```
<type>(<scope>): <description>

[body]

[footer]
```

### 类型 (type)

| 类型 | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(server): add user registration` |
| `fix` | Bug 修复 | `fix(admin-web): fix login redirect` |
| `docs` | 文档更新 | `docs: update README` |
| `style` | 代码格式（不影响逻辑） | `style: format with prettier` |
| `refactor` | 重构 | `refactor(auth): simplify token logic` |
| `perf` | 性能优化 | `perf(api): add response caching` |
| `test` | 测试相关 | `test(user): add service unit tests` |
| `chore` | 构建/工具链 | `chore: upgrade dependencies` |

### 范围 (scope)

| 范围 | 说明 |
|------|------|
| `server` | 后端服务 |
| `admin-web` | 管理后台 |
| `www-web` | WWW 移动端 |
| `miniprogram` | 小程序 |
| `shared` | 共享包 |
| `docs` | 文档 |

### 完整示例

```
feat(server): add user registration API

- Add POST /api/v1/users/register endpoint
- Add email verification logic
- Add unit tests for registration flow

Closes #123
```

---

## 工作流程

### 日常开发流程

```
1. 同步最新代码
   git checkout develop
   git pull origin develop

2. 创建功能分支
   git checkout -b feat/server/add-user-api

3. 开发并提交
   git add .
   git commit -m "feat(server): add user registration API"

4. 推送并创建 PR
   git push -u origin feat/server/add-user-api
   # 在 GitHub 创建 PR → develop

5. Code Review 通过后合并
   # 使用 Squash and Merge
```

### 冲突解决策略

```bash
# 1. 先同步目标分支
git checkout develop
git pull origin develop

# 2. 回到功能分支，rebase
git checkout feat/my-feature
git rebase develop

# 3. 解决冲突
# 编辑冲突文件，保留正确内容
git add .
git rebase --continue

# 4. 强制推送（仅限个人分支）
git push -f origin feat/my-feature
```

### Rebase vs Merge

| 场景 | 推荐方式 | 原因 |
|------|----------|------|
| 同步 develop 到功能分支 | `rebase` | 保持线性历史 |
| 功能分支合并到 develop | `squash merge` | 一个功能一个提交 |
| release 合并到 main | `merge` | 保留发布记录 |
| hotfix 合并 | `merge` | 保留修复记录 |

### 长期分支同步

```bash
# 每周至少同步一次 develop 到长期功能分支
git checkout feat/long-running-feature
git fetch origin
git rebase origin/develop

# 如果有冲突，及早解决
```

---

## Tag 规范

### 版本 Tag

```bash
# 格式：v<major>.<minor>.<patch>
git tag v1.2.0
git push origin v1.2.0
```

### 语义化版本

| 版本号变化 | 含义 | 示例 |
|------------|------|------|
| `1.0.0` → `2.0.0` | 不兼容的 API 变更 | 删除接口、改变参数 |
| `1.0.0` → `1.1.0` | 向后兼容的新功能 | 新增接口 |
| `1.0.0` → `1.0.1` | 向后兼容的 Bug 修复 | 修复问题 |

---

## PR 规范

### PR 标题

使用提交规范格式：`feat(server): add user registration API`

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

### 合并要求

- 🔴 CI 检查全部通过
- 🔴 至少 1 位 Reviewer 批准
- 🔴 无未解决的评论
- 🟡 分支已更新到最新 base

### 合并方式

| 场景 | 合并方式 |
|------|----------|
| 功能分支 → develop | Squash and Merge |
| release → main | Merge Commit |
| hotfix → main | Merge Commit |

---

## 禁止操作

| 操作 | 原因 |
|------|------|
| 🔴 `git push --force` 到 main/develop | 破坏共享历史 |
| 🔴 直接提交到 main/develop | 绕过 Code Review |
| 🔴 合并未经 CI 检查的代码 | 质量无保证 |
| 🔴 在 commit message 中使用中文 | 保持一致性 |
