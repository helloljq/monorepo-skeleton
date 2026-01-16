/* eslint-disable no-console */
/**
 * 检查管理员账户状态脚本（CommonJS 版本，可直接在容器中运行）
 *
 * 使用方法：
 *   docker exec xiaoyue-server-staging node scripts/check-admin-account.js
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 检查管理员账户状态...\n");

  const email =
    process.env.DEFAULT_ADMIN_EMAIL || "admin@monorepo-skeleton.test";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "password";
  const emailLower = email.toLowerCase();

  console.log(`📧 查找邮箱: ${email} (小写: ${emailLower})\n`);

  try {
    // 1. 检查 User 表
    console.log("1️⃣ 检查 User 表...");
    const user = await prisma.user.findFirst({
      where: { email: emailLower },
      include: {
        UserRole_UserRole_userIdToUser: {
          include: {
            Role: true,
          },
        },
      },
    });

    if (!user) {
      console.log("   ❌ 未找到用户");
      console.log(`   💡 尝试查找所有包含 'admin' 的用户:`);
      const allAdmins = await prisma.user.findMany({
        where: {
          email: { contains: "admin", mode: "insensitive" },
        },
        select: { id: true, email: true, status: true },
      });
      if (allAdmins.length > 0) {
        allAdmins.forEach((u) => {
          console.log(
            `      - ID: ${u.id}, Email: ${u.email}, Status: ${u.status}`,
          );
        });
      } else {
        console.log("      (无)");
      }
    } else {
      console.log(`   ✅ 找到用户:`);
      console.log(`      - ID: ${user.id}`);
      console.log(`      - Email: ${user.email}`);
      console.log(`      - Name: ${user.name}`);
      console.log(`      - Status: ${user.status}`);
      console.log(`      - DeletedAt: ${user.deletedAt || "null"}`);
      console.log(
        `      - 角色数量: ${user.UserRole_UserRole_userIdToUser.length}`,
      );
      user.UserRole_UserRole_userIdToUser.forEach((ur) => {
        console.log(
          `         - ${ur.Role.code} (enabled: ${ur.Role.isEnabled})`,
        );
      });
    }

    console.log("");

    // 2. 检查 UserIdentity 表
    console.log("2️⃣ 检查 UserIdentity 表...");
    const identity = await prisma.userIdentity.findUnique({
      where: {
        provider_providerId: {
          provider: "EMAIL",
          providerId: emailLower,
        },
      },
    });

    if (!identity) {
      console.log("   ❌ 未找到 EMAIL 身份");
      console.log(`   💡 尝试查找所有 EMAIL 身份:`);
      const allIdentities = await prisma.userIdentity.findMany({
        where: { provider: "EMAIL" },
        select: {
          providerId: true,
          userId: true,
          verified: true,
          credential: true,
        },
        take: 10,
      });
      if (allIdentities.length > 0) {
        allIdentities.forEach((i) => {
          const hasCredential = !!i.credential;
          console.log(
            `      - ProviderId: ${i.providerId}, UserId: ${i.userId}, Verified: ${i.verified}, HasCredential: ${hasCredential}`,
          );
        });
      } else {
        console.log("      (无)");
      }
    } else {
      console.log(`   ✅ 找到 EMAIL 身份:`);
      console.log(`      - ProviderId: ${identity.providerId}`);
      console.log(`      - UserId: ${identity.userId}`);
      console.log(`      - Verified: ${identity.verified}`);
      console.log(`      - HasCredential: ${!!identity.credential}`);
      if (identity.credential) {
        console.log(`      - CredentialLength: ${identity.credential.length}`);

        // 3. 测试密码验证
        console.log("\n3️⃣ 测试密码验证...");
        const isMatch = await bcrypt.compare(password, identity.credential);
        if (isMatch) {
          console.log(`   ✅ 密码验证成功: "${password}"`);
        } else {
          console.log(`   ❌ 密码验证失败: "${password}"`);
          console.log(`   💡 尝试常见密码:`);
          const commonPasswords = ["password", "admin", "123456", "admin123"];
          for (const pwd of commonPasswords) {
            const match = await bcrypt.compare(pwd, identity.credential);
            if (match) {
              console.log(`      ✅ 匹配密码: "${pwd}"`);
            }
          }
        }
      } else {
        console.log("   ⚠️  credential 为空，无法验证密码");
      }
    }

    console.log("\n4️⃣ 检查 SUPER_ADMIN 角色...");
    const superAdminRole = await prisma.role.findUnique({
      where: { code: "SUPER_ADMIN" },
    });

    if (!superAdminRole) {
      console.log("   ❌ 未找到 SUPER_ADMIN 角色");
    } else {
      console.log(`   ✅ 找到 SUPER_ADMIN 角色 (ID: ${superAdminRole.id})`);
    }

    console.log("\n📋 总结:");
    if (user && identity && identity.credential) {
      const passwordMatch = await bcrypt.compare(password, identity.credential);
      if (passwordMatch) {
        console.log("   ✅ 账户配置正确，应该可以登录");
        console.log(`   📧 邮箱: ${emailLower}`);
        console.log(`   🔑 密码: ${password}`);
      } else {
        console.log("   ⚠️  账户存在但密码不匹配");
        console.log(`   💡 建议: 运行重置密码脚本`);
      }
    } else {
      console.log("   ❌ 账户未正确初始化");
      console.log(`   💡 建议: 运行重置密码脚本创建/修复账户`);
    }
  } catch (error) {
    console.error("❌ 检查失败:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
