/* eslint-disable no-console */
import { IdentityProvider, PrismaClient, RoleType } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

/**
 * 基础权限定义
 * 格式: { code, name, description, resource, action, module }
 */
const PERMISSIONS = [
  // 用户管理
  {
    code: "user:read",
    name: "查看用户",
    description: "查看用户列表和详情",
    resource: "user",
    action: "read",
    module: "system",
  },
  {
    code: "user:create",
    name: "创建用户",
    description: "创建新用户",
    resource: "user",
    action: "create",
    module: "system",
  },
  {
    code: "user:update",
    name: "更新用户",
    description: "更新用户信息",
    resource: "user",
    action: "update",
    module: "system",
  },
  {
    code: "user:delete",
    name: "删除用户",
    description: "删除用户",
    resource: "user",
    action: "delete",
    module: "system",
  },
  {
    code: "user:assign-role",
    name: "分配角色",
    description: "为用户分配或移除角色",
    resource: "user",
    action: "assign-role",
    module: "system",
  },

  // 角色管理
  {
    code: "role:read",
    name: "查看角色",
    description: "查看角色列表和详情",
    resource: "role",
    action: "read",
    module: "system",
  },
  {
    code: "role:create",
    name: "创建角色",
    description: "创建新角色",
    resource: "role",
    action: "create",
    module: "system",
  },
  {
    code: "role:update",
    name: "更新角色",
    description: "更新角色信息",
    resource: "role",
    action: "update",
    module: "system",
  },
  {
    code: "role:delete",
    name: "删除角色",
    description: "删除角色",
    resource: "role",
    action: "delete",
    module: "system",
  },
  {
    code: "role:assign-permission",
    name: "分配权限",
    description: "为角色分配或移除权限",
    resource: "role",
    action: "assign-permission",
    module: "system",
  },

  // 权限管理
  {
    code: "permission:read",
    name: "查看权限",
    description: "查看权限列表",
    resource: "permission",
    action: "read",
    module: "system",
  },

  // 审计日志
  {
    code: "audit:read",
    name: "查看审计日志",
    description: "查看系统审计日志",
    resource: "audit",
    action: "read",
    module: "system",
  },

  // 字典配置
  {
    code: "dictionary:read",
    name: "查看字典",
    description: "查看字典配置",
    resource: "dictionary",
    action: "read",
    module: "system",
  },
  {
    code: "dictionary:create",
    name: "创建字典",
    description: "创建字典配置",
    resource: "dictionary",
    action: "create",
    module: "system",
  },
  {
    code: "dictionary:update",
    name: "更新字典",
    description: "更新字典配置",
    resource: "dictionary",
    action: "update",
    module: "system",
  },
  {
    code: "dictionary:delete",
    name: "删除字典",
    description: "删除字典配置",
    resource: "dictionary",
    action: "delete",
    module: "system",
  },
];

/**
 * 角色定义
 */
const ROLES = [
  {
    code: "SUPER_ADMIN",
    name: "超级管理员",
    description: "拥有系统所有权限，跳过所有权限检查",
    type: RoleType.SYSTEM,
  },
  {
    code: "ADMIN",
    name: "管理员",
    description: "系统管理员，拥有大部分管理权限",
    type: RoleType.SYSTEM,
  },
  {
    code: "USER",
    name: "普通用户",
    description: "普通注册用户",
    type: RoleType.SYSTEM,
  },
];

/**
 * 角色-权限关联定义
 * SUPER_ADMIN 不需要关联权限，因为代码中会跳过权限检查
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    "user:read",
    "user:create",
    "user:update",
    "user:delete",
    "user:assign-role",
    "role:read",
    "role:create",
    "role:update",
    "role:delete",
    "role:assign-permission",
    "permission:read",
    "audit:read",
    "dictionary:read",
    "dictionary:create",
    "dictionary:update",
    "dictionary:delete",
  ],
  USER: [
    // 普通用户暂时没有后台管理权限
  ],
};

async function main() {
  console.log("🌱 开始初始化种子数据...\n");

  // 1. 创建权限
  console.log("📝 创建权限...");
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: permission,
      create: permission,
    });
  }
  console.log(`   ✅ 已创建 ${PERMISSIONS.length} 个权限\n`);

  // 2. 创建角色
  console.log("👥 创建角色...");
  const createdRoles: Record<string, number> = {};
  for (const role of ROLES) {
    const created = await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        type: role.type,
      },
      create: role,
    });
    createdRoles[role.code] = created.id;
    console.log(`   ✅ ${role.name} (${role.code})`);
  }
  console.log("");

  // 3. 创建角色-权限关联
  console.log("🔗 关联角色权限...");
  for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS)) {
    if (permissionCodes.length === 0) {
      console.log(`   ⏭️  ${roleCode} 无需关联权限`);
      continue;
    }

    const roleId = createdRoles[roleCode];
    if (!roleId) {
      console.log(`   ⚠️  角色 ${roleCode} 不存在，跳过`);
      continue;
    }

    // 获取权限 ID
    const permissions = await prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true, code: true },
    });

    // 批量创建关联（使用 upsert 避免重复）
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId: permission.id,
        },
      });
    }
    console.log(`   ✅ ${roleCode} 已关联 ${permissions.length} 个权限`);
  }
  console.log("");

  // 4. 确保默认超级管理员存在 (Upsert)
  console.log("👤 检查/创建默认超级管理员...");
  const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@{{DOMAIN}}";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "password";
  // 统一转换为小写，确保与登录验证逻辑一致
  const emailLower = email.toLowerCase();
  const hashedPassword = await bcrypt.hash(password, 10);
  const superAdminRole = await prisma.role.findUnique({
    where: { code: "SUPER_ADMIN" },
  });

  if (superAdminRole) {
    // 1. 查找或创建用户 (Upsert logic via findFirst + update/create)
    const existingUser = await prisma.user.findFirst({ where: { email: emailLower } });
    let userId: number;

    if (existingUser) {
      console.log(`   🔄 更新现有管理员密码: ${emailLower}`);
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          status: "ACTIVE",
          deletedAt: null,
        },
      });
      userId = updatedUser.id;
    } else {
      console.log(`   ➕ 创建新管理员: ${emailLower}`);
      const newUser = await prisma.user.create({
        data: {
          email: emailLower,
          password: hashedPassword,
          name: "Super Admin",
          status: "ACTIVE",
        },
      });
      userId = newUser.id;
    }

    // 2. 确保拥有 SUPER_ADMIN 角色
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: superAdminRole.id,
        },
      },
      update: {
        expiresAt: null,
      },
      create: {
        userId,
        roleId: superAdminRole.id,
      },
    });

    // 3. 确保拥有 EMAIL 身份（使用小写邮箱，与登录验证逻辑一致）
    await prisma.userIdentity.upsert({
      where: {
        provider_providerId: {
          provider: IdentityProvider.EMAIL,
          providerId: emailLower,
        },
      },
      update: {
        userId,
        credential: hashedPassword,
        verified: true,
      },
      create: {
        userId,
        provider: IdentityProvider.EMAIL,
        providerId: emailLower,
        credential: hashedPassword,
        verified: true,
      },
    });

    console.log(`   ✅ 管理员账户就绪: ${emailLower} / ${password}`);
  } else {
    console.error("   ❌ 未找到 SUPER_ADMIN 角色，无法创建管理员");
  }

  console.log("🎉 种子数据初始化完成！\n");
  console.log("💡 提示: SUPER_ADMIN 角色会跳过所有权限检查，无需关联权限");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
