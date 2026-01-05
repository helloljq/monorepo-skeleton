# =============================================================================
# Server Dockerfile (Turbo Prune 优化版本)
# =============================================================================
# 使用 turbo prune 裁剪 Monorepo，显著减少 Docker Build Context 大小
#
# 构建命令（从项目根目录执行）：
#   docker build -f apps/server/Dockerfile -t xiaoyue-server .
#
# 运行命令：
#   docker run -p 8100:8100 --env-file .env xiaoyue-server
#
# 优化效果：
#   - Build Context 只包含 server 及其依赖的 packages
#   - 排除了 admin-web, www-web, miniprogram 等无关代码
#   - 提升缓存命中率，加速增量构建
# =============================================================================

# -----------------------------------------------------------------------------
# 阶段 0: Monorepo 裁剪 (Turbo Prune)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS pruner

WORKDIR /app

# 安装 turbo（全局）
RUN npm install -g turbo@^2

# 复制整个 Monorepo（Docker 会自动应用 .dockerignore）
COPY . .

# 裁剪出 server 及其依赖的最小子集
# --docker 模式会生成:
#   out/json/     - 只包含 package.json（用于依赖安装，利用缓存）
#   out/full/     - 包含完整源码（用于构建）
#   out/pnpm-lock.yaml - 裁剪后的 lockfile
RUN turbo prune @xiaoyue-health/server --docker

# -----------------------------------------------------------------------------
# 阶段 1: 依赖安装（利用缓存）
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# 安装 pnpm（使用 corepack 锁定版本）
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 只复制 package.json 文件（最大化缓存利用）
COPY --from=pruner /app/out/json/ .

# 复制裁剪后的 lockfile
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# 安装所有依赖（包含 devDependencies，构建需要）
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# 阶段 2: 构建
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/ .

# 复制裁剪后的完整源码
COPY --from=pruner /app/out/full/ .

# 生成 Prisma Client
RUN pnpm --filter @xiaoyue-health/server prisma:generate

# 构建 server
RUN pnpm --filter @xiaoyue-health/server build

# 编译 seed.ts 为 seed.js（避免生产环境需要 ts-node）
RUN cd apps/server && npx tsc prisma/seed.ts --outDir prisma --skipLibCheck --esModuleInterop --resolveJsonModule

# -----------------------------------------------------------------------------
# 阶段 3: 生产运行时
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache openssl dumb-init

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# 安装 pnpm（使用 npm 全局安装，确保所有用户都可用）
# 不使用 corepack，因为它的缓存对非 root 用户不可见
RUN npm install -g pnpm@9.15.0

# 从 pruner 阶段复制裁剪后的 package.json 文件
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml

# 只安装生产依赖
# HUSKY=0 禁用 husky 的 prepare 脚本（husky 是 devDependency，--prod 模式下不会安装）
RUN HUSKY=0 pnpm install --frozen-lockfile --prod --ignore-scripts

# 复制 Prisma schema 和迁移文件
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma

# 复制脚本文件（用于维护和故障排查）
COPY --from=builder /app/apps/server/scripts ./apps/server/scripts

# 生成 Prisma Client（生产环境需要）
RUN cd apps/server && pnpm prisma:generate

# 复制构建产物
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# 复制编译后的 seed.js（从 builder 阶段）
COPY --from=builder /app/apps/server/prisma/seed.js ./apps/server/prisma/seed.js

# 设置文件所有权
RUN chown -R nestjs:nodejs /app

# 切换到非 root 用户
USER nestjs

# 设置工作目录到 server
WORKDIR /app/apps/server

# 环境变量
ENV NODE_ENV=production
ENV PORT=8100

# 暴露端口
EXPOSE 8100

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8100/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1))"

# 使用 dumb-init 作为 PID 1 进程（正确处理信号）
ENTRYPOINT ["dumb-init", "--"]

# 启动命令
CMD ["node", "dist/src/main"]
