#!/usr/bin/env bash
# 로컬 브라우저 검증.
# 실제 Supabase 대신 로컬 Postgres + PostgREST + 흉내 서버(인증, 파일 저장, 푸시)로 앱 전체를 띄우고
# 처음 설치, 방문자, 리더, 총 관리자, 확대, 알림 시나리오를 실제 브라우저(Playwright)로 실행한다.
#
# 필요: psql(Postgres 16 이상), node, python3 + reportlab, openssl, curl, playwright
# 사용법: PG_TEST_URL=postgres://postgres:postgres@localhost:5432/postgres bash e2e/run.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
E2E="$ROOT/e2e"
WORK="$E2E/.work"
BIN="$E2E/.bin"
BASE_URL="${PG_TEST_URL:-postgres://postgres:postgres@localhost:5432/postgres}"
DB_URL="${BASE_URL%/*}/salrom_e2e"
PGRST_VERSION="12.2.3"
APP_PORT=3100
PGRST_PORT=3901
SECRET="local-test-secret-that-is-at-least-32-chars"

export E2E_WORK="$WORK" E2E_DB_URL="$DB_URL" E2E_APP_URL="http://localhost:$APP_PORT" E2E_PGRST_URL="http://localhost:$PGRST_PORT"

# playwright: 프로젝트에 없으면 전역 설치본을 쓴다.
if [ -z "${PLAYWRIGHT_MODULE:-}" ] && ! (cd "$E2E" && node -e "import('playwright')" >/dev/null 2>&1); then
  PLAYWRIGHT_MODULE="$(npm root -g)/playwright/index.mjs"
fi
export PLAYWRIGHT_MODULE="${PLAYWRIGHT_MODULE:-}"

rm -rf "$WORK" && mkdir -p "$WORK/shots" "$BIN"

# PostgREST 내려받기(처음 한 번)
if [ ! -x "$BIN/postgrest" ]; then
  echo "PostgREST $PGRST_VERSION 내려받는 중..."
  curl -sSL "https://github.com/PostgREST/postgrest/releases/download/v$PGRST_VERSION/postgrest-v$PGRST_VERSION-linux-static-x64.tar.xz" \
    | tar -xJ -C "$BIN"
fi

PIDS=()
cleanup() {
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT

apply() {
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$1" 2>&1 | grep -v -e wal_level -e HINT -e NOTICE || true
}

# 빈 데이터베이스(Supabase 기본 구성만, 앱 표 없음)
reset_empty() {
  psql "$BASE_URL" -q -c "drop database if exists salrom_e2e with (force)" -c "create database salrom_e2e"
  apply "$ROOT/supabase/tests/supabase_stub.sql"
  apply "$E2E/roles.sql"
  rm -rf "$WORK/storage/sheets/"*-*-*-*-*
}

wait_for_table() {
  for _ in $(seq 1 60); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PGRST_PORT/songs" -H "Authorization: Bearer $SERVICE")" = "200" ]; then return; fi
    sleep 0.25
  done
}

# 앱 표 + 예시 데이터
reset_full() {
  reset_empty
  for f in "$ROOT"/supabase/migrations/*.sql "$E2E/seed.sql"; do apply "$f"; done
  wait_for_table
}

# 테스트용 키, 인증서, 악보 PDF
eval "$(node -e '
const c=require("crypto");const s=process.argv[1];
const b=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
const sign=p=>{const h=b({alg:"HS256",typ:"JWT"});const d=b(p);return h+"."+d+"."+c.createHmac("sha256",s).update(h+"."+d).digest("base64url")};
console.log("ANON="+sign({role:"anon",iat:1700000000,exp:2000000000}));
console.log("SERVICE="+sign({role:"service_role",iat:1700000000,exp:2000000000}));' "$SECRET")"
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$WORK/push-key.pem" -out "$WORK/push-cert.pem" -days 2 \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
python3 "$E2E/make-pdfs.py" "$WORK"

# 서버 띄우기(이전 실행이 남긴 서버가 있으면 실패하므로 포트부터 확인)
for port in $APP_PORT $PGRST_PORT 54321 54400; do
  if curl -s -o /dev/null "http://localhost:$port" 2>/dev/null; then
    echo "포트 $port 를 이미 쓰고 있습니다. 이전 테스트 서버를 먼저 종료해 주세요." >&2
    exit 1
  fi
done
HOSTPORT="$(node -p 'const u=new URL(process.argv[1]); u.hostname+":"+(u.port||5432)' "$BASE_URL")"
reset_empty
cat > "$WORK/postgrest.conf" <<EOF
db-uri = "postgres://authenticator:authpass@$HOSTPORT/salrom_e2e"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$SECRET"
server-port = $PGRST_PORT
EOF
"$BIN/postgrest" "$WORK/postgrest.conf" > "$WORK/postgrest.log" 2>&1 & PIDS+=($!)
node "$E2E/fake-supabase.mjs" "$WORK/storage" > "$WORK/fake-supabase.log" 2>&1 & PIDS+=($!)
node "$E2E/mock-push.mjs" "$WORK" > "$WORK/mock-push.log" 2>&1 & PIDS+=($!)

# Vercel에서 Supabase를 연결했을 때와 같은 이름의 환경 변수(새 키 이름)를 쓴다.
# 알림 키는 넣지 않는다(처음 설치 때 자동으로 만드는지 확인).
# NEXT_PUBLIC_ 값은 빌드할 때, 나머지 서버 전용 값은 실행할 때 읽으므로 둘 다에 넘긴다.
export NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321" NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$ANON" \
  SUPABASE_SECRET_KEY="$SERVICE" POSTGRES_URL_NON_POOLING="$DB_URL" VAPID_SUBJECT="mailto:test@example.com"
unset NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY || true
echo "테스트 환경으로 앱 빌드 중..."
(cd "$ROOT" && npm run build > "$WORK/build.log" 2>&1)
# 흉내 푸시 서버의 자체 서명 인증서를 믿도록 한다(테스트 전용).
(cd "$ROOT" && NODE_EXTRA_CA_CERTS="$WORK/push-cert.pem" exec node node_modules/next/dist/bin/next start -p "$APP_PORT" > "$WORK/next.log" 2>&1) & PIDS+=($!)
for _ in $(seq 1 60); do curl -s -o /dev/null "http://localhost:$APP_PORT/login" && break; sleep 0.5; done

status=0
run() { (cd "$E2E" && node "$@") || status=1; }

echo; echo "== 처음 설치 =="; run setup.mjs
reset_full
echo; echo "== API 조회와 권한 =="; run api-check.mjs
reset_full
echo; echo "== 방문자(로그인 없음) =="; run visitor.mjs
echo; echo "== 리더 모드 =="; run leader.mjs
echo; echo "== 총 관리자 모드 =="; run admin.mjs
reset_full
echo; echo "== 확대, 태블릿, 노트북 =="; run pinch.mjs
reset_full
echo; echo "== 알림 =="; run push.mjs

echo
echo "화면 캡처: $WORK/shots"
exit $status
