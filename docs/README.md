# {{TITLE}} - 项目文档

欢迎来到{{TITLE}}项目文档中心。

## 文档体系说明

本项目采用**双轨文档体系**，服务于不同的阅读场景：

| 文档类型           | 位置                  | 目标读者    | 特点                           |
| ------------------ | --------------------- | ----------- | ------------------------------ |
| **CLAUDE.md 系列** | 根目录 + 各应用根目录 | AI 辅助工具 | 模板驱动、可复制粘贴、快速参考 |
| **docs/ 目录**     | 本目录                | 人类开发者  | 详细解释、规范理由、例外情况   |
| **GLOSSARY.md**    | 根目录                | AI + 人类   | 业务术语统一定义               |

### 如何选择阅读哪个文档？

- **AI 辅助开发**：优先阅读 `CLAUDE.md` 系列，包含即用型模板
- **理解设计决策**：阅读 `docs/` 下的详细文档
- **查找业务术语**：阅读 `GLOSSARY.md`

### 文档内容重叠说明

部分内容（如项目结构、常用命令）在多处出现，这是**有意设计**：

- CLAUDE.md 侧重"怎么做"（模板 + 步骤）
- docs/ 侧重"为什么"（规范 + 理由）

---

## 快速入口

| 我是...        | 从这里开始                                       |
| -------------- | ------------------------------------------------ |
| **新同事**     | [入职指南](./runbooks/development/onboarding.md) |
| **后端开发**   | [后端开发规范](../apps/server/CLAUDE.md)         |
| **前端开发**   | [Admin Web 规范](../apps/admin-web/CLAUDE.md)    |
| **小程序开发** | [小程序规范](../apps/miniprogram/CLAUDE.md)      |
| **想提交代码** | [贡献指南](../CONTRIBUTING.md)                   |

---

## 文档索引

### 架构设计

| 文档                                              | 说明         |
| ------------------------------------------------- | ------------ |
| [整体架构概览](./design/architecture/overview.md) | 系统架构设计 |
| [技术栈说明](./design/architecture/tech-stack.md) | 技术选型说明 |
| [架构决策记录](./design/architecture/decisions/)  | ADR 记录     |

### 开发规范

| 文档                                                           | 说明                         |
| -------------------------------------------------------------- | ---------------------------- |
| [入职指南](./runbooks/development/onboarding.md)               | 环境搭建、开发流程、实战任务 |
| [本地 Hosts 配置](./runbooks/development/local-hosts-setup.md) | 域名配置、访问地址           |
| [代码风格规范](./runbooks/development/code-style.md)           | 命名、格式、最佳实践         |
| [Git 工作流](./runbooks/development/git-workflow.md)           | 分支策略、提交规范           |
| [测试规范](./runbooks/development/testing.md)                  | 单元测试、E2E 测试           |
| [Code Review 清单](./runbooks/development/review-checklist.md) | 审查要点、拒绝清单           |
| [依赖管理规范](./runbooks/development/dependencies.md)         | 版本兼容、升级策略           |

### 部署运维

| 文档                                                                         | 说明                                |
| ---------------------------------------------------------------------------- | ----------------------------------- |
| [快速参考指南](./runbooks/deployment/quickstart.md)                          | 本地开发、Staging/Prod 部署速查     |
| [完整部署手册](./runbooks/deployment/deployment-guide.md)                    | 从零开始的详细部署步骤              |
| [Docker 基础设施](./runbooks/deployment/docker-infrastructure.md)            | Docker 部署方案（dev/staging/prod） |
| [环境说明](./runbooks/deployment/environments.md)                            | 各环境配置差异                      |
| [数据库配置](./runbooks/deployment/database.md)                              | PostgreSQL/Redis 配置和运维         |
| [CI/CD 流程](./runbooks/deployment/ci-cd.md)                                 | 自动化部署流程                      |
| [GitHub Actions 配置](./runbooks/deployment/github-actions-staging-setup.md) | Staging 环境 CI/CD 详细配置         |
| [密钥管理](./runbooks/deployment/secrets-management.md)                      | 环境变量和密钥管理规范              |
| [小程序发布](./runbooks/deployment/miniprogram-release.md)                   | 微信小程序发布流程                  |
| [Staging 故障排查](./runbooks/deployment/staging-troubleshooting.md)         | Staging 环境常见问题诊断和解决      |

### 项目管理

| 文档                                | 说明             |
| ----------------------------------- | ---------------- |
| [技术债清单](./design/tech-debt.md) | 已知技术债务追踪 |

### 产品文档

| 文档                                               | 说明         |
| -------------------------------------------------- | ------------ |
| [产品文档索引](./requirements/product/README.md)   | 产品相关文档 |
| [PRD 模板](./requirements/product/prd/template.md) | 需求文档模板 |

---

## 应用文档

| 应用            | 开发规范                                   | 详细指南                                                                   |
| --------------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| **Server**      | [CLAUDE.md](../apps/server/CLAUDE.md)      | [development-guidelines.md](../apps/server/docs/development-guidelines.md) |
| **Admin Web**   | [CLAUDE.md](../apps/admin-web/CLAUDE.md)   | -                                                                          |
| **WWW Web**     | [CLAUDE.md](../apps/www-web/CLAUDE.md)     | -                                                                          |
| **Miniprogram** | [CLAUDE.md](../apps/miniprogram/CLAUDE.md) | -                                                                          |

---

## 规范强度说明

文档中的规范分为三个等级：

| 等级         | 符号        | 说明                     | PR 影响  |
| ------------ | ----------- | ------------------------ | -------- |
| **【强制】** | 🔴 阻塞     | 违反即拒绝 PR            | 必须修复 |
| **【推荐】** | 🟡 建议修复 | 允许不执行，但需说明理由 | 建议修复 |
| **【建议】** | 🟢 建议     | 经验性最佳实践           | 可选     |

> **符号说明**：不同文档可能使用文字（【强制】）或符号（🔴）表示，两者含义等价。

---

## 文档维护

### 文档位置规范

| 类型         | 位置                    | 示例               |
| ------------ | ----------------------- | ------------------ |
| 跨应用文档   | `/docs/`                | 架构设计、开发规范 |
| 应用内部文档 | `/apps/*/docs/`         | 模块设计、API 说明 |
| 包使用说明   | `/packages/*/README.md` | 使用指南           |

### 文档命名规范

| 类型     | 格式                | 示例                        |
| -------- | ------------------- | --------------------------- |
| 通用文档 | kebab-case.md       | `code-style.md`             |
| ADR      | NNN-title.md        | `001-monorepo-structure.md` |
| PRD      | YYYYMMDD-feature.md | `20241225-user-auth.md`     |

### 贡献文档

1. 发现文档错误或过时？提交 PR 修复
2. 有新的最佳实践？添加到相应文档
3. 新功能需要文档？随代码一起提交
