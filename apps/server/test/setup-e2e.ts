/**
 * E2E 测试数据库隔离设置
 *
 * 策略：使用独立的 PostgreSQL schema 隔离测试数据
 *
 * 本地开发：使用 `test` schema
 * CI 环境：使用动态 schema（test_${GITHUB_RUN_ID}）
 *
 * 每次测试前：
 * 1. 删除并重建测试 schema
 * 2. 应用 Prisma migrations
 * 3. 可选：插入种子数据
 */

import { execSync } from "child_process";

// 获取测试 schema 名称
function getTestSchemaName(): string {
  // CI 环境使用动态 schema
  if (process.env.GITHUB_RUN_ID) {
    return `test_${process.env.GITHUB_RUN_ID}`;
  }
  // 本地开发使用固定 schema
  return "test";
}

// 设置测试数据库 URL
function getTestDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const schemaName = getTestSchemaName();

  // 替换或添加 schema 参数
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schemaName);

  return url.toString();
}

// 重置测试数据库
async function resetTestDatabase(): Promise<void> {
  const testUrl = getTestDatabaseUrl();
  const schemaName = getTestSchemaName();

  console.log(`🧪 Resetting test database schema: ${schemaName}`);

  // 设置测试数据库 URL
  process.env.DATABASE_URL = testUrl;

  try {
    // 使用 Prisma 重置数据库（会删除并重建 schema，然后应用 migrations）
    execSync("npx prisma migrate reset --force --skip-seed", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: testUrl },
    });

    console.log(`✅ Test database ready: schema=${schemaName}`);
  } catch (error) {
    console.error("❌ Failed to reset test database:", error);
    throw error;
  }
}

// 清理测试数据库（CI 完成后删除动态 schema）
async function cleanupTestDatabase(): Promise<void> {
  // 只在 CI 环境清理动态 schema
  if (!process.env.GITHUB_RUN_ID) {
    return;
  }

  const schemaName = getTestSchemaName();
  console.log(`🧹 Cleaning up test schema: ${schemaName}`);

  // 注意：这里需要使用原始 DATABASE_URL 连接到默认 schema 来删除测试 schema
  // 实际清理可以在 CI workflow 的 post 步骤中完成
}

// Jest 全局设置
export default async function globalSetup(): Promise<void> {
  console.log("\n📦 E2E Test Global Setup\n");

  await resetTestDatabase();
}

// 导出工具函数供测试使用
export { cleanupTestDatabase, getTestDatabaseUrl, getTestSchemaName };
