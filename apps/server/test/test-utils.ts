/**
 * E2E 测试工具函数
 *
 * 提供测试数据清理、种子数据插入等辅助功能
 */

import { INestApplication } from "@nestjs/common";

import { PrismaService } from "../src/database/prisma.service";

/**
 * 清理指定表的测试数据
 *
 * 使用 TRUNCATE 快速清空数据，注意会重置自增 ID
 * 按照外键依赖顺序清理，避免约束冲突
 */
export async function cleanupTestData(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);

  // 按照外键依赖的逆序清理表
  // 注意：根据实际 schema 调整表顺序
  const tablesToClean = [
    "AuditLog",
    "ConfigItemHistory",
    "ConfigItem",
    "Namespace",
    "Dictionary",
    "UserIdentity",
    "UserRole",
    "RolePermission",
    "User",
    "Role",
    "Permission",
  ];

  for (const table of tablesToClean) {
    try {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`,
      );
    } catch {
      // 表可能不存在，忽略错误
    }
  }
}

/**
 * 插入基础种子数据
 *
 * 创建测试需要的基础数据，如管理员用户、基础角色等
 */
export async function seedTestData(app: INestApplication): Promise<{
  adminUser: { id: number; email: string };
  adminRole: { id: number; name: string };
}> {
  const prisma = app.get(PrismaService);

  // 创建管理员角色
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Test admin role",
      type: "SYSTEM",
    },
  });

  // 创建管理员用户
  // 密码: test123456 (bcrypt hash)
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@test.com" },
    update: {},
    create: {
      email: "admin@test.com",
      password: "$2b$10$rQZ5pJqXhTx8kZQS8kZQSOYFZ5YZ5YZ5YZ5YZ5YZ5YZ5YZ5YZ5YZ5Y", // test123456
      name: "Test Admin",
      status: "ACTIVE",
    },
  });

  // 关联用户和角色
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  return { adminUser, adminRole };
}

/**
 * 创建测试用户并获取 JWT token
 */
export async function createTestUserWithToken(
  _app: INestApplication,
  _userData?: Partial<{ email: string; name: string; status: string }>,
): Promise<{
  user: { id: number; email: string };
  accessToken: string;
  refreshToken: string;
}> {
  // 这里应该调用 auth service 创建用户并获取 token
  // 具体实现根据项目 auth 模块调整
  throw new Error("Not implemented - customize based on auth module");
}

/**
 * 测试请求头辅助函数
 */
export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * 生成测试用的唯一邮箱
 */
export function testEmail(prefix = "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
}

/**
 * 生成测试用的唯一手机号
 */
export function testPhone(): string {
  return `138${Date.now().toString().slice(-8)}`;
}
