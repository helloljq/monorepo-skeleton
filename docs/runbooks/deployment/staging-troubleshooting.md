# Staging 环境故障排查指南

> 本文档提供 Staging 环境常见问题的诊断和解决方案。

---

## 目录

1. [管理员账户登录问题](#管理员账户登录问题)
2. [数据库连接问题](#数据库连接问题)
3. [常见问题 FAQ](#常见问题-faq)

---

## 管理员账户登录问题

### 问题描述

无法使用默认账号密码登录管理后台。

**默认账号**：

- 邮箱：`admin@{{DOMAIN}}`
- 密码：`password`

### 快速诊断

#### 1. 检查账户是否存在

```bash
docker exec -i xiaoyue-server-staging node << 'EOF'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const email = 'admin@{{DOMAIN}}';
  const user = await prisma.user.findFirst({ where: { email } });
  const identity = await prisma.userIdentity.findUnique({
    where: { provider_providerId: { provider: 'EMAIL', providerId: email } }
  });
  console.log('User:', user ? '✅ 存在 (ID: ' + user.id + ')' : '❌ 不存在');
  console.log('Identity:', identity ? '✅ 存在 (HasCredential: ' + !!identity.credential + ')' : '❌ 不存在');
  await prisma.$disconnect();
})();
EOF
```

#### 2. 检查 seed 是否执行

```bash
docker logs xiaoyue-server-staging 2>&1 | grep -i seed
```

### 解决方案

#### 方案 1：重新运行 seed 脚本（推荐）

```bash
# 使用 docker-compose exec 自动继承环境变量
docker-compose -f docker-compose.prod.yml exec -T server pnpm prisma db seed

# 或者明确传递 DATABASE_URL（如果不使用 docker-compose）
docker exec -e DATABASE_URL="$DATABASE_URL" xiaoyue-server-staging pnpm prisma db seed
```

> **注意**：使用 `docker-compose exec` 会自动继承容器的环境变量，推荐使用。

#### 方案 2：手动创建/重置账户

```bash
docker exec -i xiaoyue-server-staging sh -c 'DATABASE_URL="postgresql://xy_staging:密码@100.108.227.32:5410/xy_staging" node' << 'EOF'
const { PrismaClient, IdentityProvider, RoleType } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

(async () => {
  try {
    const email = 'admin@{{DOMAIN}}';
    const password = 'password';
    const emailLower = email.toLowerCase();
    const hashed = await bcrypt.hash(password, 10);

    // 1. 创建或更新用户
    let user = await prisma.user.findFirst({ where: { email: emailLower } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: emailLower, password: hashed, name: 'Super Admin', status: 'ACTIVE' }
      });
      console.log('✅ 用户已创建');
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed, status: 'ACTIVE', deletedAt: null }
      });
      console.log('✅ 用户已更新');
    }

    // 2. 确保 SUPER_ADMIN 角色存在
    const role = await prisma.role.upsert({
      where: { code: 'SUPER_ADMIN' },
      update: {},
      create: {
        code: 'SUPER_ADMIN',
        name: '超级管理员',
        description: '拥有系统所有权限，跳过所有权限检查',
        type: RoleType.SYSTEM,
        isEnabled: true
      }
    });

    // 3. 关联用户和角色
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: { expiresAt: null },
      create: { userId: user.id, roleId: role.id }
    });

    // 4. 创建/更新 EMAIL 身份
    await prisma.userIdentity.upsert({
      where: { provider_providerId: { provider: IdentityProvider.EMAIL, providerId: emailLower } },
      update: { userId: user.id, credential: hashed, verified: true },
      create: { userId: user.id, provider: IdentityProvider.EMAIL, providerId: emailLower, credential: hashed, verified: true }
    });

    console.log('\n🎉 管理员账户创建成功！');
    console.log('📧 邮箱: admin@{{DOMAIN}}');
    console.log('🔑 密码: password');
  } catch (error) {
    console.error('❌ 失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
EOF
```

> **提示**：将 `密码` 替换为实际的数据库密码，或使用环境变量 `$DATABASE_URL`。

---

## 数据库连接问题

### 问题描述

容器无法连接到数据库，错误信息：`Can't reach database server at nas:5410`

### 诊断步骤

#### 1. 检查 hosts 配置

```bash
docker exec xiaoyue-server-staging cat /etc/hosts | grep nas
```

应该看到：`100.108.227.32 nas`

#### 2. 测试网络连通性

```bash
# 测试 ping
docker exec xiaoyue-server-staging ping -c 2 nas

# 测试端口
docker exec xiaoyue-server-staging nc -zv nas 5410
```

#### 3. 检查 DATABASE_URL

```bash
docker exec xiaoyue-server-staging env | grep DATABASE_URL
```

### 解决方案

#### 方案 1：添加 hosts 映射（临时）

```bash
docker exec -u root xiaoyue-server-staging sh -c "echo '100.108.227.32 nas' >> /etc/hosts"
```

> **注意**：容器重启后失效。

#### 方案 2：使用 IP 地址（临时）

如果 hosts 映射不生效，临时使用 IP 地址：

```bash
# 执行迁移
docker exec xiaoyue-server-staging sh -c 'DATABASE_URL="postgresql://xy_staging:密码@100.108.227.32:5410/xy_staging" pnpm prisma migrate deploy'
```

#### 方案 3：更新 docker-compose 配置（永久）

确保 `docker-compose.prod.yml` 中有 `extra_hosts` 配置：

```yaml
services:
  server:
    extra_hosts:
      - "nas:100.108.227.32"
```

然后重启容器：

```bash
cd /volume1/docker/{{NAME}}_staging
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

---

## 常见问题 FAQ

### Q1: seed 脚本执行失败，提示找不到 ts-node

**原因**：生产环境容器只安装生产依赖，不包含 `ts-node`。

**解决方案**：

1. 使用方案 2 手动创建账户（见上文）
2. 或等待下次重新构建镜像（已更新 Dockerfile，会包含 scripts 目录）

### Q2: 密码验证失败

**诊断**：检查密码哈希是否正确

```bash
docker exec -i xiaoyue-server-staging node << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
(async () => {
  const email = 'admin@{{DOMAIN}}';
  const identity = await prisma.userIdentity.findUnique({
    where: { provider_providerId: { provider: 'EMAIL', providerId: email } }
  });
  if (identity && identity.credential) {
    const testPasswords = ['password', 'admin', '123456'];
    for (const pwd of testPasswords) {
      const match = await bcrypt.compare(pwd, identity.credential);
      if (match) {
        console.log('✅ 匹配密码:', pwd);
        break;
      }
    }
  }
  await prisma.$disconnect();
})();
EOF
```

**解决**：使用方案 2 重置密码。

### Q3: ping 通但端口连不上

**可能原因**：

1. PostgreSQL 只监听 localhost
2. 防火墙阻止
3. 容器网络隔离

**解决**：

1. 检查 PostgreSQL 配置 `listen_addresses`
2. 检查防火墙规则
3. 使用 IP 地址连接（见数据库连接问题 - 方案 2）

### Q4: 邮箱大小写不匹配

**问题**：seed 脚本中邮箱可能没有统一转小写。

**解决**：已修复 seed 脚本，重新运行即可。

---

## 验证修复

修复后，尝试登录：

- 访问：https://admin-staging.{{DOMAIN}}
- 邮箱：`admin@{{DOMAIN}}`
- 密码：`password`

或使用 API 测试：

```bash
curl -X POST https://api-staging.{{DOMAIN}}/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@{{DOMAIN}}","password":"password","deviceId":"test"}'
```

---

## 预防措施

1. **确保 seed 在部署时执行**：检查 `.github/workflows/cd.yml` 中是否有 `pnpm prisma db seed`
2. **使用环境变量设置密码**：通过 `DEFAULT_ADMIN_PASSWORD` 设置强密码
3. **首次登录后立即修改密码**
4. **确保 docker-compose 配置正确**：包含 `extra_hosts` 配置

---

## 相关文档

- [GitHub Actions 配置](./github-actions-staging-setup.md)
- [数据库配置](./database.md)
- [环境说明](./environments.md)
