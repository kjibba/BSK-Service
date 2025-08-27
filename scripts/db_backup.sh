#!/usr/bin/env bash

set -euo pipefail

# Simple MariaDB backup via docker compose
# Output: ./db_backups/backup_YYYYmmdd_HHMMSS.sql.gz

cd "$(dirname "$0")/.."

BACKUP_DIR=${BACKUP_DIR:-"$(pwd)/db_backups"}
mkdir -p "$BACKUP_DIR"

STAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/backup_${STAMP}.sql"

echo "[backup] Dumping database to $OUT_FILE ..."
# Use -T to disable pseudo-TTY for clean redirection
docker compose exec -T db sh -lc 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "${MYSQL_DATABASE}"' > "$OUT_FILE"

echo "[backup] Compressing ..."
gzip -f "$OUT_FILE"
echo "[backup] Done: ${OUT_FILE}.gz"
