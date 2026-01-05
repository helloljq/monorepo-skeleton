#!/bin/bash
# =============================================================================
# Staging 环境服务器准备脚本
# =============================================================================
# 此脚本用于在服务器上准备部署环境
# 
# 使用方法:
#   1. 上传此脚本到服务器: scp setup-staging-server.sh <user>@<server>:~/
#   2. SSH 到服务器执行: bash setup-staging-server.sh
# =============================================================================

set -e

echo "🚀 开始准备 Staging 环境服务器..."

# 创建部署目录
echo "📁 创建部署目录..."
sudo mkdir -p /opt/xiaoyue-health/{backup,logs}
sudo chown -R $USER:$USER /opt/xiaoyue-health

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker 未安装，正在安装..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "✅ Docker 安装完成，请重新登录后继续"
    exit 0
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  Docker Compose 未安装，正在安装..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "✅ 服务器环境准备完成！"
echo ""
echo "📋 下一步操作:"
echo "1. 上传 .env 文件到服务器:"
echo "   scp .env.staging.server <user>@<server>:/opt/xiaoyue-health/.env"
echo ""
echo "2. 上传 docker-compose.prod.yml 到服务器:"
echo "   scp docker-compose.prod.yml <user>@<server>:/opt/xiaoyue-health/"
echo ""
echo "3. 在 GitHub 中配置 Secrets (Settings → Secrets and variables → Actions)"
echo ""
echo "4. 创建 release 分支触发部署:"
echo "   git checkout -b release/v1.0.0"
echo "   git push origin release/v1.0.0"
