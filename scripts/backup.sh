#!/usr/bin/env bash
# MariaDB 백업: mariadb-dump -> gzip -> backups/taskflow-YYYYmmdd-HHMMSS.sql.gz
# 보관 기간(기본 14일)이 지난 백업 파일은 삭제한다.
#
# 환경 변수:
#   DB_PASSWORD          (필수) DB 비밀번호
#   DB_HOST              기본 127.0.0.1
#   DB_PORT              기본 3306
#   DB_USER              기본 taskflow
#   DB_NAME              기본 taskflow
#   BACKUP_DIR           기본 <프로젝트>/backups
#   RETENTION_DAYS       기본 14
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-taskflow}"
DB_NAME="${DB_NAME:-taskflow}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD 환경 변수가 필요합니다}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

export MYSQL_PWD="$DB_PASSWORD"

DUMP_BIN="$(command -v mariadb-dump || command -v mysqldump || true)"
[[ -n "$DUMP_BIN" ]] || { echo "mariadb-dump을 찾을 수 없습니다. MariaDB 클라이언트를 설치하세요." >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
out="$BACKUP_DIR/taskflow-$ts.sql.gz"
tmp="$out.tmp"
trap 'rm -f "$tmp"' EXIT

"$DUMP_BIN" \
    -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
    --single-transaction --routines --triggers \
    "$DB_NAME" \
    | gzip -9 > "$tmp"

gzip -t "$tmp"
mv "$tmp" "$out"
trap - EXIT
echo "백업 완료: $out"

find "$BACKUP_DIR" -maxdepth 1 -name 'taskflow-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete
