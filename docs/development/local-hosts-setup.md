# 本地开发 Hosts 配置

## 概述

为了保持本地开发环境与线上环境的一致性，我们统一使用域名访问，而不是 `localhost:端口` 的形式。

## 配置步骤

### 1. 编辑 hosts 文件

根据你的操作系统，编辑 hosts 文件：

**macOS / Linux:**
```bash
sudo vim /etc/hosts
```

**Windows:**
```
C:\Windows\System32\drivers\etc\hosts
```

### 2. 添加以下配置

```
127.0.0.1 api-dev.{{DOMAIN}}
127.0.0.1 www-dev.{{DOMAIN}}
127.0.0.1 admin-dev.{{DOMAIN}}
```

### 3. 保存并验证

**macOS / Linux:**
```bash
# 刷新 DNS 缓存
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# 验证配置
ping api-dev.{{DOMAIN}}
```

**Windows:**
```cmd
# 刷新 DNS 缓存
ipconfig /flushdns

# 验证配置
ping api-dev.{{DOMAIN}}
```

## 本地访问地址

配置完成后，使用以下地址访问本地服务：

| 服务 | 地址 | 说明 |
|------|------|------|
| **Server API** | https://api-dev.{{DOMAIN}} | 后端 API 服务 (通过 Caddy 映射到 8100) |
| **Admin Web** | https://admin-dev.{{DOMAIN}} | 管理后台 (通过 Caddy 映射到 3100) |
| **H5 Web** | https://www-dev.{{DOMAIN}} | H5 移动端 (通过 Caddy 映射到 3200) |

### 常用访问链接

| 服务 | 链接 |
|------|------|
| Swagger 文档 | https://api-dev.{{DOMAIN}}/api |
| 健康检查 | https://api-dev.{{DOMAIN}}/health |
| 监控指标 | https://api-dev.{{DOMAIN}}/metrics |
| 管理后台 | https://admin-dev.{{DOMAIN}} |
| H5 页面 | https://www-dev.{{DOMAIN}} |

## 为什么使用域名而不是 localhost？

### 优势

1. **环境一致性**: 本地、测试、生产环境使用相同的域名模式
2. **Cookie 隔离**: 不同应用的 Cookie 不会相互干扰
3. **CORS 配置**: 与线上环境保持一致的 CORS 策略
4. **微信开发**: 微信小程序等需要配置合法域名
5. **SSL 测试**: 便于本地测试 HTTPS（可配置本地证书）

### 域名规范

```
{应用类型}-{环境}.{{DOMAIN}}

应用类型: api | admin | www
环境:     dev | staging | (空 = 生产)
```

## 常见问题

### Q: 为什么不需要带端口号？

A: 本地开发时，我们通过 Caddy 做了端口映射，将 80 端口的请求自动转发到对应的服务端口（API:8100, Admin:3100, H5:3200）。这样可以保持与线上环境一致的访问方式。

### Q: 可以不配置 hosts 吗？

A: 不建议。为了团队开发的一致性和避免环境差异导致的问题，请务必配置 hosts。

### Q: 忘记配置 hosts 会怎样？

A: 浏览器会提示无法访问该域名。请按照本文档配置 hosts 后重试。

### Q: 如何快速切换环境？

A: 通过修改 `.env` 文件中的 `VITE_API_BASE_URL` 等配置，或使用不同的 `.env.[mode]` 文件。

## 相关文档

- [环境说明](../deployment/environments.md)
- [入职指南](../ONBOARDING.md)
