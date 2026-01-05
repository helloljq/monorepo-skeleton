# =============================================================================
# Admin Web Dockerfile (Turbo Prune 优化版本)
# =============================================================================
# 使用 turbo prune 裁剪 Monorepo，显著减少 Docker Build Context 大小
#
# 构建命令（从项目根目录执行）：
#   docker build -f apps/admin-web/Dockerfile \
#     --build-arg VITE_API_BASE_URL=https://api.xiaoyueht.com \
#     -t xiaoyue-admin-web .
#
# 运行命令：
#   docker run -p 80:80 xiaoyue-admin-web
#
# 优化效果：
#   - Build Context 只包含 admin-web 及其依赖的 packages
#   - 排除了 server, www-web, miniprogram 等无关代码
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

# 裁剪出 admin-web 及其依赖的最小子集
# --docker 模式会生成:
#   out/json/     - 只包含 package.json（用于依赖安装，利用缓存）
#   out/full/     - 包含完整源码（用于构建）
#   out/pnpm-lock.yaml - 裁剪后的 lockfile
RUN turbo prune @xiaoyue-health/admin-web --docker

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

# 接收构建参数
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# 从 deps 阶段复制 node_modules
COPY --from=deps /app/ .

# 复制裁剪后的完整源码
COPY --from=pruner /app/out/full/ .

# 构建应用
RUN pnpm --filter @xiaoyue-health/admin-web build

# -----------------------------------------------------------------------------
# 阶段 3: 生产运行时 (Nginx)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runner

# 复制 Nginx 配置
COPY apps/admin-web/nginx.conf /etc/nginx/nginx.conf

# 复制构建产物
COPY --from=builder /app/apps/admin-web/dist /usr/share/nginx/html

# 创建非 root 用户运行 nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# 切换到非 root 用户
USER nginx

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/health || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
