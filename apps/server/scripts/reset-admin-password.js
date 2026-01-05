/* eslint-disable no-console */
/**
 * 重置管理员密码脚本（CommonJS 版本，可直接在容器中运行）
 * 
 * 使用方法：
 *   docker exec xiaoyue-server-staging node scripts/reset-admin-password.js
 */

const { PrismaClient, IdentityProvider } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 重置管理员密码...\n");

  const email = process.env.DEFAULT_ADMIN_EMAIL || "admin@{{DOMAIN}}";
  const password = process.env.DEFAULT_ADMIN_PASSWORD || "password";
  const emailLower = email.toLowerCase();

  console.log(`📧 邮箱: ${emailLower}`);
  console.log(`🔑 新密码: ${password}\n`);

  try {
    // 1. 查找用户
    const user = await prisma.user.findFirst({
      where: { email: emailLower },
    });

    if (!user) {
      console.error("❌ 未找到用户，请先运行 seed 脚本创建管理员账户");
      process.exit(1);
    }

    console.log(`✅ 找到用户: ID=${user.id}, Email=${user.email}`);

    // 2. 生成密码哈希
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("✅ 密码已加密\n");

    // 3. 更新 User 表密码
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    console.log("✅ User 表密码已更新");

    // 4. 更新 UserIdentity 表密码
    const identity = await prisma.userIdentity.upsert({
      where: {
        provider_providerId: {
          provider: IdentityProvider.EMAIL,
          providerId: emailLower,
        },
      },
      update: {
        userId: user.id,
        credential: hashedPassword,
        verified: true,
      },
      create: {
        userId: user.id,
        provider: IdentityProvider.EMAIL,
        providerId: emailLower,
        credential: hashedPassword,
        verified: true,
      },
    });
    console.log("✅ UserIdentity 表密码已更新");

    // 5. 验证密码
    const isValid = await bcrypt.compare(password, identity.credential);
    if (isValid) {
      console.log("\n✅ 密码重置成功！");
      console.log(`📧 邮箱: ${emailLower}`);
      console.log(`🔑 密码: ${password}`);
    } else {
      console.error("\n❌ 密码验证失败，请检查");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ 重置失败:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

