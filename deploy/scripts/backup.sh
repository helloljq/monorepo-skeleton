#!/bin/bash
# 数据库备份脚本
#
# 使用方法:
#   ./backup.sh staging  # 备份 staging 环境
#   ./backup.sh prod     # 备份 prod 环境
#
# Crontab 配置:
#   0 3 * * * /opt/xiaoyue/scripts/backup.sh staging >> /var/log/xiaoyue-backup.log 2>&1
#   0 4 * * * /opt/xiaoyue/scripts/backup.sh prod >> /var/log/xiaoyue-backup.log 2>&1

set -e

ENV=${1:-staging}
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/opt/xiaoyue/backups/${ENV}
RETENTION_DAYS=${2:-7}  # 默认保留 7 天
ENV_FILE="/opt/xiaoyue/${ENV}/.env"

# OSS 配置
OSS_BUCKET="oss://xyht-backup"
OSS_PATH="${OSS_BUCKET}/${ENV}"
UPLOAD_TO_OSS=true  # 设为 false 可禁用 OSS 上传

echo "=========================================="
echo "Starting backup for ${ENV} environment"
echo "Date: ${DATE}"
echo "=========================================="

# 检查环境目录
if [ ! -d "/opt/xiaoyue/${ENV}" ]; then
    echo "Error: Environment directory /opt/xiaoyue/${ENV} not found"
    exit 1
fi

# 检查环境变量文件
if [ ! -f "${ENV_FILE}" ]; then
    echo "Error: Environment file ${ENV_FILE} not found"
    exit 1
fi

# 创建备份目录
mkdir -p ${BACKUP_DIR}

# 安全读取环境变量（避免 source 的安全隐患）
get_env_var() {
    local var_name=$1
    grep -E "^${var_name}=" "${ENV_FILE}" | cut -d'=' -f2- | tr -d '"' | tr -d "'"
}

POSTGRES_USER=$(get_env_var "POSTGRES_USER")
POSTGRES_DB=$(get_env_var "POSTGRES_DB")
REDIS_PASSWORD=$(get_env_var "REDIS_PASSWORD")

# 设置默认值
POSTGRES_USER=${POSTGRES_USER:-xiaoyue}
POSTGRES_DB=${POSTGRES_DB:-xiaoyue_${ENV}}

# PostgreSQL 备份
echo "Backing up PostgreSQL..."
if docker exec xy-${ENV}-postgres pg_dump \
    -U ${POSTGRES_USER} \
    ${POSTGRES_DB} | gzip > ${BACKUP_DIR}/pg_${DATE}.sql.gz; then
    echo "PostgreSQL backup completed: ${BACKUP_DIR}/pg_${DATE}.sql.gz"
else
    echo "Error: PostgreSQL backup failed"
    exit 1
fi

# Redis 备份（使用 LASTSAVE 检查实际完成）
echo "Backing up Redis..."

# 获取当前 LASTSAVE 时间戳
PREV_LASTSAVE=$(docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD}" xy-${ENV}-redis redis-cli --no-auth-warning LASTSAVE 2>/dev/null | grep -oE '[0-9]+' || echo "0")

# 触发 BGSAVE
if docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD}" xy-${ENV}-redis redis-cli --no-auth-warning BGSAVE >/dev/null 2>&1; then
    echo "Redis BGSAVE triggered, waiting for completion..."

    # 等待 BGSAVE 完成（最多等待 60 秒）
    WAIT_COUNT=0
    MAX_WAIT=60
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        CURRENT_LASTSAVE=$(docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD}" xy-${ENV}-redis redis-cli --no-auth-warning LASTSAVE 2>/dev/null | grep -oE '[0-9]+' || echo "0")
        if [ "$CURRENT_LASTSAVE" != "$PREV_LASTSAVE" ]; then
            echo "Redis BGSAVE completed"
            break
        fi
        sleep 1
        WAIT_COUNT=$((WAIT_COUNT + 1))
    done

    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        echo "Warning: Redis BGSAVE timeout, proceeding anyway"
    fi

    # 复制 RDB 文件
    if docker cp xy-${ENV}-redis:/data/dump.rdb ${BACKUP_DIR}/redis_${DATE}.rdb 2>/dev/null; then
        echo "Redis backup completed: ${BACKUP_DIR}/redis_${DATE}.rdb"
    else
        echo "Warning: Redis backup copy failed (dump.rdb may not exist)"
    fi
else
    echo "Warning: Redis BGSAVE failed"
fi

# 清理过期备份（本地）
echo "Cleaning up old local backups (older than ${RETENTION_DAYS} days)..."
find ${BACKUP_DIR} -name "pg_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find ${BACKUP_DIR} -name "redis_*.rdb" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

# 上传到 OSS
if [ "${UPLOAD_TO_OSS}" = true ] && command -v ossutil &> /dev/null; then
    echo ""
    echo "Uploading backups to OSS..."

    # 上传 PostgreSQL 备份
    if [ -f "${BACKUP_DIR}/pg_${DATE}.sql.gz" ]; then
        if ossutil cp "${BACKUP_DIR}/pg_${DATE}.sql.gz" "${OSS_PATH}/pg_${DATE}.sql.gz" --meta x-oss-storage-class:IA; then
            echo "PostgreSQL backup uploaded to OSS: ${OSS_PATH}/pg_${DATE}.sql.gz"
        else
            echo "Warning: Failed to upload PostgreSQL backup to OSS"
        fi
    fi

    # 上传 Redis 备份
    if [ -f "${BACKUP_DIR}/redis_${DATE}.rdb" ]; then
        if ossutil cp "${BACKUP_DIR}/redis_${DATE}.rdb" "${OSS_PATH}/redis_${DATE}.rdb" --meta x-oss-storage-class:IA; then
            echo "Redis backup uploaded to OSS: ${OSS_PATH}/redis_${DATE}.rdb"
        else
            echo "Warning: Failed to upload Redis backup to OSS"
        fi
    fi

    echo ""
    echo "OSS backup contents:"
    ossutil ls "${OSS_PATH}/" --limited-num 10 2>/dev/null || echo "Failed to list OSS contents"
else
    if [ "${UPLOAD_TO_OSS}" = true ]; then
        echo "Warning: ossutil not found, skipping OSS upload"
    fi
fi

# 显示本地备份结果
echo ""
echo "Local backup directory contents:"
ls -lh ${BACKUP_DIR}

echo ""
echo "=========================================="
echo "Backup completed successfully"
echo "=========================================="
