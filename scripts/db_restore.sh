#!/usr/bin/env bash

set -euo pipefail

# Restore a .sql or .sql.gz dump into the running MariaDB container
# Usage: ./scripts/db_restore.sh <path-to-sql[.gz]>

if [ $# -lt 1 ]; then
  echo "Usage: $0 <dump.sql|dump.sql.gz>" >&2
  exit 1
fi

DUMP_PATH="$1"
if [ ! -f "$DUMP_PATH" ]; then
  echo "File not found: $DUMP_PATH" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if [[ "$DUMP_PATH" == *.gz ]]; then
  echo "[restore] Decompressing and importing $DUMP_PATH ..."
  zcat "$DUMP_PATH" | docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "${MYSQL_DATABASE}"'
else
  echo "[restore] Importing $DUMP_PATH ..."
  cat "$DUMP_PATH" | docker compose exec -T db sh -lc 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "${MYSQL_DATABASE}"'
fi

echo "[restore] Done."
