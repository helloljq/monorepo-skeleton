#!/bin/bash
# 数据库恢复脚本
#
# 使用方法:
#   ./restore.sh staging pg_20250104_030000.sql.gz           # 恢复 PostgreSQL
#   ./restore.sh staging redis_20250104_030000.rdb           # 恢复 Redis
#   ./restore.sh staging pg_20250104_030000.sql.gz --force   # 强制恢复（不确认）

set -e

ENV=${1:-staging}
BACKUP_FILE=$2
FORCE=${3:-}
BACKUP_DIR=/opt/xiaoyue/backups/${ENV}
ENV_FILE="/opt/xiaoyue/${ENV}/.env"

echo "=========================================="
echo "Database Restore Script"
echo "Environment: ${ENV}"
echo "Backup file: ${BACKUP_FILE}"
echo "=========================================="

# 检查参数
if [ -z "${BACKUP_FILE}" ]; then
    echo "Usage: $0 <env> <backup_file> [--force]"
    echo ""
    echo "Available backups in ${BACKUP_DIR}:"
    ls -lh ${BACKUP_DIR} 2>/dev/null || echo "No backups found"
    exit 1
fi

# 检查备份文件
FULL_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
if [ ! -f "${FULL_PATH}" ]; then
    echo "Error: Backup file not found: ${FULL_PATH}"
    exit 1
fi

# 检查环境变量文件
if [ ! -f "${ENV_FILE}" ]; then
    echo "Error: Environment file ${ENV_FILE} not found"
    exit 1
fi

# 安全读取环境变量
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

# 确认操作
if [ "${FORCE}" != "--force" ]; then
    echo ""
    echo "WARNING: This will DESTROY and RECREATE the current database!"
    echo "All existing data will be LOST!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [ "${confirm}" != "yes" ]; then
        echo "Aborted"
        exit 0
    fi
fi

# 根据文件类型执行恢复
if [[ "${BACKUP_FILE}" == pg_*.sql.gz ]] || [[ "${BACKUP_FILE}" == pg_*.sql ]]; then
    echo "Restoring PostgreSQL from ${BACKUP_FILE}..."

    # 1. 终止所有到目标数据库的连接
    echo "Terminating existing connections..."
    docker exec xy-${ENV}-postgres psql -U ${POSTGRES_USER} -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" \
        2>/dev/null || true

    # 2. 删除旧数据库
    echo "Dropping existing database..."
    docker exec xy-${ENV}-postgres dropdb -U ${POSTGRES_USER} ${POSTGRES_DB} --if-exists

    # 3. 创建新数据库
    echo "Creating new database..."
    docker exec xy-${ENV}-postgres createdb -U ${POSTGRES_USER} ${POSTGRES_DB}

    # 4. 恢复数据
    echo "Restoring data..."
    if [[ "${BACKUP_FILE}" == *.gz ]]; then
        gunzip -c ${FULL_PATH} | docker exec -i xy-${ENV}-postgres psql \
            -U ${POSTGRES_USER} \
            -d ${POSTGRES_DB} \
            --quiet
    else
        cat ${FULL_PATH} | docker exec -i xy-${ENV}-postgres psql \
            -U ${POSTGRES_USER} \
            -d ${POSTGRES_DB} \
            --quiet
    fi

    echo "PostgreSQL restore completed"

elif [[ "${BACKUP_FILE}" == redis_*.rdb ]]; then
    echo "Restoring Redis from ${BACKUP_FILE}..."

    # 1. 停止 Redis
    echo "Stopping Redis container..."
    cd /opt/xiaoyue/${ENV}
    docker compose stop redis

    # 2. 复制 RDB 文件
    echo "Copying RDB file..."
    docker cp ${FULL_PATH} xy-${ENV}-redis:/data/dump.rdb

    # 3. 启动 Redis
    echo "Starting Redis container..."
    docker compose start redis

    # 4. 等待 Redis 就绪
    echo "Waiting for Redis to be ready..."
    sleep 3

    # 5. 验证
    if docker exec -e REDISCLI_AUTH="${REDIS_PASSWORD}" xy-${ENV}-redis redis-cli --no-auth-warning ping | grep -q PONG; then
        echo "Redis restore completed and verified"
    else
        echo "Warning: Redis may not have started correctly"
    fi

else
    echo "Error: Unknown backup file format"
    echo "Expected: pg_*.sql.gz, pg_*.sql, or redis_*.rdb"
    exit 1
fi

echo ""
echo "=========================================="
echo "Restore completed successfully"
echo "=========================================="
