#!/usr/bin/env bash
# MariaDB 복원: 백업 파일(.sql.gz)을 대상 DB에 적용한다.
# 주의: 대상 DB의 기존 데이터가 덮어써진다.
#
# 사용법: scripts/restore.sh <file.sql.gz>
#
# 환경 변수는 backup.sh와 동일 (DB_PASSWORD 필수).
set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "사용법: $0 <file.sql.gz>" >&2
    exit 1
fi

FILE="$1"
[[ -f "$FILE" ]] || { echo "파일을 찾을 수 없습니다: $FILE" >&2; exit 1; }

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-taskflow}"
DB_NAME="${DB_NAME:-taskflow}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD 환경 변수가 필요합니다}"

export MYSQL_PWD="$DB_PASSWORD"

CLIENT_BIN="$(command -v mariadb || command -v mysql || true)"
[[ -n "$CLIENT_BIN" ]] || { echo "mariadb 클라이언트를 찾을 수 없습니다. MariaDB 클라이언트를 설치하세요." >&2; exit 1; }

# 손상된 백업을 적용하기 전에 gzip 무결성 확인
gzip -t "$FILE"

echo "대상 DB: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "백업 파일: $FILE"
echo "기존 데이터가 덮어써집니다. 계속하려면 'yes'를 입력하세요."
read -r answer
if [[ "$answer" != "yes" ]]; then
    echo "복원을 취소했습니다."
    exit 1
fi

gunzip -c "$FILE" | "$CLIENT_BIN" \
    -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"

echo "복원 완료: $DB_NAME"
