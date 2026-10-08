# 로컬 브라우저 검증(e2e)

실제 Supabase 없이 앱 전체를 띄워 주요 흐름을 브라우저로 확인한다.

| 구성 | 역할 |
| --- | --- |
| 로컬 Postgres | `supabase/tests/supabase_stub.sql` + 마이그레이션 + `seed.sql` |
| PostgREST 12 | Supabase REST API와 같은 서버(처음 실행 때 `.bin/`에 내려받음) |
| `fake-supabase.mjs` | 로그인(테스트 계정), REST 전달, 파일 저장 흉내. 실시간 기능은 없음 |
| `mock-push.mjs` | 브라우저 푸시 서버 흉내(자체 서명 인증서) |
| Playwright | Pixel 7, iPad Pro 11 화면으로 시나리오 실행 |

## 실행

```bash
PG_TEST_URL=postgres://postgres:postgres@localhost:5432/postgres bash e2e/run.sh
```

필요한 것: Postgres 16 이상과 `psql`, Node.js, Python 3 + `reportlab`, `openssl`, `curl`, Playwright(프로젝트에 없으면 전역 설치본이나 `PLAYWRIGHT_MODULE` 경로를 쓴다).
실행하면 테스트용 환경 변수로 `npm run build`를 다시 하므로 끝난 뒤 배포용 빌드가 필요하면 다시 빌드한다.

## 시나리오

| 파일 | 확인 내용 |
| --- | --- |
| `api-check.mjs` | 화면에서 쓰는 조회 문장의 결과 모양과 권한(초안 숨김, 공개 중복 방지, 버전 번호, 필기 권한 등) |
| `member.mjs` | 로그인, 홈, 악보 보기, 펜/글자/되돌리기/지우개, 새로고침 후 필기 유지, 확대, 다음 곡, 초성 검색, 지난 예배, 팀원 편집 접근 차단 |
| `leader.mjs` | 순서 변경, Key, 기존 곡 추가, 새 곡과 PDF 등록, 최신 파일로 교체, 변경 알림, 새 예배 공개, 공용 필기와 팀원 화면 표시 |
| `pinch.mjs` | 두 손가락 확대, 태블릿 화면 |
| `push.mjs` | 공개 알림 발송(VAPID, 암호화), 보낸 사람 제외, 만료 구독 정리, 연속 알림 방지, 서비스 워커 알림 표시 |

테스트 계정 비밀번호는 모두 `password`이다: `admin@test.kr`(총 관리자), `leader@test.kr`(리더), `m1@test.kr`(팀원).
화면 캡처는 `e2e/.work/shots`에 남는다.
