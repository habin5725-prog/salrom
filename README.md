# 찬양팀 악보 (salrom)

찬양팀(최대 10명 정도)이 매주 쓰는 악보 웹앱이다.
리더가 이번 주 곡과 악보를 올리고 공개하면 팀원은 휴대폰이나 태블릿으로 바로 확인하고 필기하며 연습한다.
지난 악보는 악보함에 계속 쌓인다.

## 1. 주요 기능

| 구분 | 기능 |
| --- | --- |
| 팀원 | 이번 주 찬양 확인, 악보 보기(확대, 이전 곡/다음 곡), 악보함 검색(초성 검색 포함), 지난 예배 확인, 나만 보는 개인 필기 |
| 리더 | 팀원 기능 + 예배 만들기, 곡 추가(악보함 재사용 또는 새 PDF), Key 입력, 순서 변경, 공개, 변경 알림, 모두가 보는 공용 필기 |
| 총 관리자 | 리더 기능 + 가입 승인, 권한 변경, 공개된 예배 삭제 |

- 하단 메뉴는 홈, 이번 주, 악보함, 설정 4개이다.
- 저장과 공개는 분리되어 있다. 편집 내용은 자동 저장되고 공개 버튼을 누를 때 팀원에게 알림이 한 번 간다.
- 공개 뒤 중요한 수정(Key 변경, 곡 추가와 빼기, 악보 교체)은 리더가 "팀원에게 변경 알림 보내기"를 직접 눌러 알린다. 같은 예배 알림은 1분 안에 다시 보낼 수 없다.
- 필기는 원본 PDF를 고치지 않고 PDF 위에 따로 저장한다. 개인 필기는 파란색이고 본인만 본다. 공용 필기는 빨간색에 "공용" 표시가 붙고 모두가 본다.
- 악보 PDF를 새 파일로 교체해도 이전 파일과 그 위의 필기는 지워지지 않는다(악보 버전 관리).
- 휴대폰 홈 화면에 앱처럼 설치할 수 있고(PWA), 공개 알림을 받을 수 있다.
- 악보를 보는 동안 화면이 꺼지지 않게 하고(지원 기기), 한 번 본 악보는 기기에 저장되어 다시 열 때 빠르다. 로그아웃하면 기기에 저장한 악보를 지운다.

## 2. 기술 구성

| 항목 | 사용 기술 |
| --- | --- |
| 화면과 서버 | Next.js 16(App Router), React 19, TypeScript, Tailwind CSS 4 |
| 로그인, 데이터, 파일 | Supabase(Auth, Postgres, Storage, Realtime) |
| 권한 | Postgres RLS 정책(화면에서 버튼을 숨기는 것과 별개로 데이터베이스가 강제) |
| PDF 표시 | pdf.js(legacy 빌드, 구형 iPhone 대응) |
| 알림 | Web Push(VAPID) + web-push 라이브러리, 서비스 워커 |

## 3. 처음 설치하기

### 3-1. Supabase 프로젝트 만들기

1. Supabase에서 새 프로젝트를 만든다.
2. 대시보드의 SQL Editor에서 `supabase/migrations/20261008000000_init.sql` 내용을 그대로 실행한다.
   테이블, 권한 정책, 비공개 악보 저장소(`sheets` 버킷), 실시간 설정이 한 번에 만들어진다.
3. Authentication 설정
   - URL Configuration의 Site URL에 배포 주소를 넣는다(예: `https://우리팀.vercel.app`).
   - Redirect URLs에 `https://우리팀.vercel.app/auth/callback` 을 추가한다.
   - 가입 확인 메일 없이 쓰려면 Email 공급자 설정에서 "Confirm email"을 끈다. 이 앱은 관리자 승인 전에는 아무것도 볼 수 없으므로 끄는 쪽이 사용하기 쉽다.

### 3-2. 알림 키 만들기

```bash
npx web-push generate-vapid-keys
```

나온 Public Key와 Private Key를 다음 단계 환경 변수에 넣는다.

### 3-3. 환경 변수

`.env.example`을 참고한다. 로컬에서는 `.env.local` 파일로, 배포 서비스에서는 프로젝트 환경 변수로 넣는다.

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 빌드할 때 읽음 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon(또는 publishable) 키 | 빌드할 때 읽음 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 | 서버 전용. 알림 대상 조회에만 사용 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 3-2의 Public Key | 빌드할 때 읽음 |
| `VAPID_PRIVATE_KEY` | 3-2의 Private Key | 서버 전용 |
| `VAPID_SUBJECT` | `mailto:관리자메일` | 푸시 서비스에 전달되는 연락처 |
| `NEXT_PUBLIC_APP_NAME` | 예: `○○교회 찬양팀` | 선택. 화면과 홈 화면 아이콘 이름 |

`NEXT_PUBLIC_`으로 시작하는 값은 빌드할 때 들어가므로 값을 바꾸면 다시 배포해야 한다.
서버 전용 값(`SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PRIVATE_KEY`)은 실행할 때 읽는다.

### 3-4. 배포

GitHub 저장소를 Vercel 같은 Next.js 호스팅에 연결하고 3-3의 환경 변수를 넣은 뒤 배포한다.
설치 명령은 `npm install`, 빌드 명령은 `npm run build` 이다(pdf.js 보조 파일은 자동으로 복사된다).

### 3-5. 첫 사용

1. 배포 주소에 들어가 "처음 가입"으로 가입한다. 가장 먼저 가입한 사람이 총 관리자가 된다.
2. 팀원에게 주소를 알려 주고 가입하게 한다. 가입한 사람은 "승인 대기" 상태가 된다.
3. 총 관리자가 설정 > 사용자 관리에서 승인하고 리더를 지정한다.
4. 각자 설정 화면의 안내대로 홈 화면에 추가하고 "알림 켜기"를 누른다.

총 관리자 계정이 없어졌을 때는 SQL Editor에서 다음처럼 지정할 수 있다.

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = '관리자메일');
```

## 4. 무료로 운영할 때 알아둘 점

아래 내용은 작성 시점(2026년 10월)에 확인한 자료 기준이며 각 서비스 정책은 바뀔 수 있다. 실제 적용 전 공식 페이지를 다시 확인해야 한다.

- Supabase 무료 플랜은 7일 동안 사용이 없으면 프로젝트가 일시 중지되고 대시보드에서 직접 다시 켜야 한다고 알려져 있다. 데이터는 유지된다. 명절 등으로 2주 이상 쉬는 경우 미리 확인이 필요하다. (출처: [Jetadmin Supabase 요금 정리](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Automation Atlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/))
- 같은 자료 기준 무료 플랜은 데이터베이스 500MB, 파일 저장 1GB, 월 전송량 5GB 정도이다. 파일 저장 용량은 자료마다 500MB와 1GB로 다르게 적혀 있어 확실하지 않음. 악보 PDF 한 개가 보통 수백 KB이므로 10명 규모에서는 여유가 있을 것으로 보인다(추측입니다).
- Vercel Hobby(무료) 플랜은 비상업 개인 용도로 제한된다. 교회 찬양팀 사용이 이 조건에 해당하는지는 확실하지 않음. 필요하면 Vercel에 문의하거나 다른 Next.js 호스팅을 검토한다. (출처: [Vercel Hobby 플랜 문서](https://vercel.com/docs/plans/hobby), [Vercel 공정 사용 가이드](https://vercel.com/docs/limits/fair-use-guidelines))
- iPhone과 iPad는 iOS/iPadOS 16.4 이상에서 홈 화면에 추가한 웹앱만 푸시 알림을 받을 수 있고, 사용자가 버튼을 눌러 허용해야 한다. 그래서 설정 화면의 "알림 켜기" 버튼으로 요청한다. (출처: [WebKit 블로그 Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), Next.js PWA 가이드)

## 5. 저작권과 보안

- 악보 PDF는 비공개 Storage 버킷에 저장되고 로그인해서 승인된 팀원만 내려받을 수 있다(RLS 정책). 공개 주소를 만들지 않는다.
- 상용 악보를 올리고 팀원과 나누는 일의 이용 권한은 교회가 별도로 확인할 라이선스 문제이다. 이 앱은 그 권한을 판단하거나 보장하지 않는다.
- `SUPABASE_SERVICE_ROLE_KEY`는 모든 권한을 가진 키이므로 절대 `NEXT_PUBLIC_`을 붙이거나 외부에 공유하지 않는다.

## 6. 데이터 구조와 권한

| 테이블 | 내용 | 읽기 | 쓰기 |
| --- | --- | --- | --- |
| `profiles` | 이름, 권한(pending/member/leader/admin), 악기 | 본인 + 승인된 팀원 | 본인 이름과 악기, 권한은 총 관리자만 |
| `services` | 예배 날짜, 이름, 상태(초안/공개) | 공개된 예배는 팀원, 초안은 리더 | 리더(초안 삭제), 총 관리자(공개 예배 삭제) |
| `songs` | 곡명 | 팀원 | 리더(삭제는 총 관리자) |
| `sheets` | 곡에 딸린 악보(예: G키 악보) | 팀원 | 리더 |
| `sheet_versions` | 악보 파일과 버전 번호(서버가 매김) | 팀원 | 리더 |
| `service_songs` | 예배 곡 순서, Key, 사용한 악보 버전 | 예배를 볼 수 있는 사람 | 리더 |
| `annotations` | 필기(악보, 버전, 쪽, 종류, 좌표, personal/global) | 개인 필기는 본인만, 공용 필기는 팀원 | 개인은 본인, 공용은 리더 |
| `push_subscriptions` | 기기별 알림 구독 | 본인 | 본인 |

- 승인 대기(pending) 사용자는 자기 프로필 외에는 아무것도 볼 수 없다.
- 예배마다 사용한 악보 버전을 고정해 두므로 악보를 교체해도 지난 예배와 그때의 필기가 그대로 남는다.
- 필기 좌표는 페이지 너비를 1로 하는 비율로 저장하므로 확대 배율이나 기기와 무관하게 같은 자리에 그려진다.

## 7. 폴더 구조

```
src/
  app/
    (main)/          하단 메뉴가 있는 화면: 홈, 이번 주, 악보함, 지난 예배, 설정, 예배 편집
    (viewer)/        악보 화면(전체 화면): /play/[예배곡], /sheet/[악보]
    actions/push.ts  공개, 변경 알림, 시험 알림(Server Action)
    login/           로그인과 가입
    manifest.ts      홈 화면 설치 정보
  components/        공통 화면 요소, viewer/(PDF 표시와 필기)
  lib/               권한 표, 초성 검색, 날짜, 필기 좌표, Supabase 연결, 데이터 조회
  proxy.ts           로그인 세션 갱신과 로그인 화면 이동
public/sw.js         서비스 워커(알림 표시와 알림 눌렀을 때 이동)
supabase/
  migrations/        데이터베이스 스키마와 권한 정책
  tests/             권한 정책 검증 SQL
e2e/                 로컬 브라우저 검증(선택)
```

## 8. 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

| 명령 | 내용 |
| --- | --- |
| `npm run check` | lint + 타입 검사 + 단위 테스트 |
| `npm run build` | 배포용 빌드 |
| `npm run test:db` | 로컬 Postgres에서 권한 정책(RLS) 검증. `PG_TEST_URL` 필요 |
| `bash e2e/run.sh` | 로컬 Postgres + PostgREST + 흉내 서버로 앱 전체를 띄워 팀원, 리더, 확대, 알림 시나리오를 브라우저로 검증. 자세한 내용은 `e2e/README.md` |

데이터베이스 구조를 바꿀 때는 `supabase/migrations`에 새 파일을 추가하고 `src/lib/database.types.ts`, `supabase/tests/rls.test.sql`, `src/lib/permissions.ts`를 함께 맞춘다.
