#!/usr/bin/env bash
# 마이그레이션과 권한 정책(RLS)을 로컬 Postgres에서 검증한다.
# 사용법: PG_TEST_URL=postgres://postgres@localhost:5432/postgres npm run test:db
# 지정한 서버에 임시 데이터베이스를 만들고 끝나면 지운다.
set -euo pipefail

BASE_URL="${PG_TEST_URL:-postgres://postgres@localhost:5432/postgres}"
DB_NAME="salrom_rls_test_$$"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_URL="${BASE_URL%/*}/${DB_NAME}"

cleanup() {
  psql "$BASE_URL" -q -c "drop database if exists ${DB_NAME}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql "$BASE_URL" -q -c "create database ${DB_NAME}"

PSQL=(psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -X)
"${PSQL[@]}" -f "$DIR/supabase_stub.sql"
for f in "$DIR"/../migrations/*.sql; do
  "${PSQL[@]}" -f "$f"
done
"${PSQL[@]}" -o /dev/null -f "$DIR/rls.test.sql"
