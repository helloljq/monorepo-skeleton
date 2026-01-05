# 配置中心功能

> 创建日期: 2025-12-25
> 状态: 设计中
> 负责人: -

## 概述

设计并实现一个轻量级配置中心，与现有的字典管理（Dictionary）模块区分开来，用于管理应用配置、功能开关、第三方服务配置等。

## 需求背景

### 与字典管理的区别

| 维度 | 字典管理 (Dictionary) | 配置中心 (Config Center) |
|------|----------------------|-------------------------|
| **定位** | 业务枚举/下拉选项 | 应用配置/功能开关/运营配置 |
| **典型数据** | gender, user_status, order_type | mini_program_home_banners, xhs_cookies, feature_flags |
| **组织方式** | type + key (扁平) | namespace + key (分组隔离) |
| **主要消费者** | 前端 UI 渲染 | 后端服务 / 前端配置逻辑 |
| **变更频率** | 低（枚举稳定） | 中高（运营调整、灰度） |
| **敏感性** | 低 | 可能含敏感数据（API Key、Cookie） |
| **版本管理** | 无（单版本） | 有（变更历史、回滚） |
| **实时性要求** | 接受缓存 | 可能需要实时推送 |

### 典型使用场景

1. **小程序首页 Banner**：`mini_program:home_banners` - JSON 配置
2. **第三方 Cookie**：`third_party:xhs_cookies` - 加密字符串
3. **功能开关**：`feature_flags:new_checkout_flow` - 灰度配置

## 核心功能需求

1. **命名空间管理**：按业务域隔离配置
2. **配置项 CRUD**：键值对管理，支持多种值类型
3. **版本历史**：记录每次变更，支持回滚
4. **敏感配置加密**：AES-256-GCM 加密存储
5. **JSON Schema 校验**：可选的配置格式校验
6. **缓存与实时推送**：Redis 缓存 + WebSocket 变更通知

## 验收标准

### 基础功能

- [ ] 完成数据库模型设计与迁移（含 `onDelete: Restrict`）
- [ ] 完成软删除集成 (`SOFT_DELETE_MODELS` + `soft-delete-check`)
- [ ] 完成环境变量配置 (`CONFIG_ENCRYPTION_KEY`, `CONFIG_CACHE_TTL_SECONDS` in `env.schema.ts`)
- [ ] 命名空间保留字校验（namespaces, batch, config 等）
- [ ] 配置项 key 保留字校验（batch, history, rollback, meta）
- [ ] 实现命名空间 CRUD API
- [ ] 实现配置项 CRUD API
- [ ] 实现版本历史与回滚功能
- [ ] 实现敏感配置加密/解密
- [ ] 实现 JSON Schema 校验（使用 ajv）
- [ ] 实现 Redis 缓存策略（含分布式锁防击穿、TTL 抖动防雪崩）
- [ ] 实现 WebSocket 变更推送（含鉴权、token 刷新）
- [ ] 添加错误码到 `error-codes.ts`（14000-14999）

### 安全

- [ ] 加密密钥格式校验（hex 字符串正则）
- [ ] 敏感配置审计日志脱敏处理
- [ ] Redis 操作失败的降级处理

### 测试覆盖

- [ ] 完成单元测试
- [ ] 完成 E2E 测试
- [ ] 多实例部署下 WebSocket 推送测试
- [ ] 加密配置读写完整性测试（加密→存储→解密→验证）

### 文档

- [ ] 完成 Swagger API 文档
- [ ] 完成前端使用指南

## 相关文档

- [实现方案](./implementation_plan.md)
