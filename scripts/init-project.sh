#!/bin/bash
# =============================================================================
# Monorepo 项目初始化脚本
# =============================================================================
# 使用方法:
#   ./scripts/init-project.sh <NAME> <TITLE> <DOMAIN>
#
# 参数:
#   NAME   - 项目标识（小写字母+数字，用于包名、容器名、数据库名）
#   TITLE  - 项目显示名称（用于文档和 UI）
#   DOMAIN - 项目域名
#
# 示例:
#   ./scripts/init-project.sh i54kb "54KB 工具站" 54kb.com
#   ./scripts/init-project.sh myapp "我的应用" myapp.com
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查参数
if [ "$#" -ne 3 ]; then
    log_error "参数数量不正确"
    echo ""
    echo "使用方法: $0 <NAME> <TITLE> <DOMAIN>"
    echo ""
    echo "参数说明:"
    echo "  NAME   - 项目标识（小写字母+数字，用于包名、容器名、数据库名）"
    echo "  TITLE  - 项目显示名称（用于文档和 UI）"
    echo "  DOMAIN - 项目域名"
    echo ""
    echo "示例:"
    echo "  $0 i54kb \"54KB 工具站\" 54kb.com"
    exit 1
fi

NAME="$1"
TITLE="$2"
DOMAIN="$3"

# 验证 NAME 格式（小写字母开头，只能包含小写字母和数字）
if ! [[ "$NAME" =~ ^[a-z][a-z0-9]*$ ]]; then
    log_error "NAME 格式不正确: '$NAME'"
    echo "NAME 必须以小写字母开头，只能包含小写字母和数字"
    exit 1
fi

# 验证 DOMAIN 格式
if ! [[ "$DOMAIN" =~ ^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$ ]]; then
    log_error "DOMAIN 格式不正确: '$DOMAIN'"
    exit 1
fi

echo ""
echo "=============================================="
echo "  Monorepo 项目初始化"
echo "=============================================="
echo ""
echo "  NAME:   $NAME"
echo "  TITLE:  $TITLE"
echo "  DOMAIN: $DOMAIN"
echo ""
echo "=============================================="
echo ""

read -p "确认以上配置? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "已取消"
    exit 0
fi

# 获取脚本所在目录的父目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

log_info "开始替换占位符..."

# 替换所有文件中的占位符
# 注意: 使用 perl 以获得更好的跨平台兼容性

# 查找需要处理的文件
find . -type f \( \
    -name "*.json" -o \
    -name "*.ts" -o \
    -name "*.tsx" -o \
    -name "*.js" -o \
    -name "*.yml" -o \
    -name "*.yaml" -o \
    -name "*.md" -o \
    -name "*.sh" -o \
    -name "Dockerfile" -o \
    -name ".env*" \
\) ! -path "./node_modules/*" ! -path "./.git/*" ! -name "init-project.sh" -print0 | \
xargs -0 perl -i -pe "
    s/\{\{NAME\}\}/$NAME/g;
    s/\{\{TITLE\}\}/$TITLE/g;
    s/\{\{DOMAIN\}\}/$DOMAIN/g;
"

log_success "占位符替换完成"

# 删除骨架专用文件
log_info "清理骨架专用文件..."
rm -f SKELETON.md 2>/dev/null || true

# 更新 README
log_info "更新 README..."
cat > README.md << EOF
# $TITLE

基于 Monorepo 架构的全栈应用。

## 技术栈

- **Monorepo**: pnpm workspace + Turborepo
- **Server**: NestJS 11 + Prisma + PostgreSQL + Redis + Zod
- **Admin Web**: React 19 + Vite + shadcn/ui + TanStack Query + Zustand
- **WWW Web**: React 19 + Vite + Tailwind CSS
- **Miniprogram**: Taro 4 + React + TypeScript

## 快速开始

\`\`\`bash
# 安装依赖
pnpm install

# 启动开发服务（不含小程序）
pnpm dev

# 启动所有服务（含小程序，需 Node.js < 22）
pnpm dev:all
\`\`\`

## 项目结构

\`\`\`
$NAME/
├── apps/
│   ├── server/          # NestJS 后端 (端口 8100)
│   ├── admin-web/       # React 管理后台 (端口 3100)
│   ├── www-web/         # WWW 移动端 (端口 3200)
│   └── miniprogram/     # 微信小程序 (Taro)
├── packages/
│   ├── shared-types/    # 共享 TS 类型
│   └── shared-utils/    # 共享工具函数
├── tooling/             # 共享配置
├── deploy/              # 部署配置
└── docs/                # 项目文档
\`\`\`

## 文档

- [CLAUDE.md](./CLAUDE.md) - AI 辅助开发指南
- [docs/](./docs/) - 详细文档

## 开发规范

详见各应用的 \`CLAUDE.md\` 文件。
EOF

log_success "README 更新完成"

# 生成密钥提示
echo ""
log_info "生成密钥建议..."
echo ""
echo "请生成以下密钥用于部署:"
echo ""
echo "  JWT_ACCESS_SECRET=$(openssl rand -hex 32)"
echo "  JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
echo "  CONFIG_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo ""

# 初始化 Git（如果还没有）
if [ ! -d ".git" ]; then
    log_info "初始化 Git 仓库..."
    git init
    git add .
    git commit -m "chore: 初始化项目 $NAME"
    log_success "Git 仓库初始化完成"
else
    log_warn "Git 仓库已存在，跳过初始化"
fi

echo ""
log_success "=============================================="
log_success "  项目初始化完成！"
log_success "=============================================="
echo ""
echo "下一步:"
echo "  1. 安装依赖:    pnpm install"
echo "  2. 配置环境变量: 复制 .env.example 文件并填写"
echo "  3. 启动开发:    pnpm dev"
echo ""
