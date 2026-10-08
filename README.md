# 찬양팀 악보 (salrom)

찬양팀(10명 안팎)이 매주 쓰는 악보 사이트이다.
주소를 누르면 로그인 없이 바로 이번 주 찬양과 악보가 보인다.
리더와 총 관리자는 화면 위쪽 "로그인" 버튼에 비밀번호를 넣어 관리 모드로 들어간다.
휴대폰, 패드, 노트북 어느 화면에서도 쓸 수 있고 휴대폰 홈 화면에 앱처럼 설치할 수 있다.

## 1. 누가 무엇을 하나

| 구분 | 들어가는 방법 | 할 수 있는 일 |
| --- | --- | --- |
| 팀원(방문자) | 주소만 누르면 된다 | 이번 주 찬양, 악보 보기(확대, 이전 곡과 다음 곡), 악보함 검색(초성 검색 포함), 지난 예배, 이 기기에만 저장되는 개인 필기, 공개 알림 받기 |
| 찬양팀 리더 | 위쪽 "로그인"에서 처음 비밀번호 `1234` | 팀원 기능과 함께 예배 만들기, 곡 추가(악보함 재사용 또는 새 파일: 사진, PDF, 음원, 문서), Key, 순서 변경, 공개와 공개 취소, 변경 알림, 모두가 보는 공용 필기 |
| 총 관리자 | 위쪽 "로그인"에서 처음 비밀번호 `1221` | 리더 기능과 함께 접속 기록 확인, 비밀번호 바꾸기, 곡 이름 바꾸기, 곡 지우기(악보함 곡 화면 또는 곡 관리), 공개된 예배 지우기, 오래된 기록 정리 |

- 처음 비밀번호(1234, 1221)는 누구나 짐작할 수 있다. 설치 직후 총 관리자 화면 > "비밀번호와 기록 설정"에서 바꾼다. 바꾸기 전에는 관리자 화면 맨 위에 경고가 보인다.
- 같은 곳에서 비밀번호를 15분 안에 5번 틀리면 15분 동안 들어갈 수 없다. 사이트 전체로 1시간에 30번 틀려도 잠시 막힌다.
- 관리 모드는 설정 화면의 "관리 모드에서 나가기"로 끝낸다. 그 기기만 나가고 다른 기기는 그대로이다.
- 저장과 공개는 나뉘어 있다. 편집 내용은 바로 저장되지만 팀원에게는 "공개"를 누른 뒤에 보인다. 처음 공개할 때 알림이 한 번 간다.
- 공개 뒤 중요한 수정(Key 변경, 곡 추가와 빼기, 악보 교체)은 리더가 "팀원에게 변경 알림 보내기"를 눌러 알린다. 같은 예배 알림은 1분 안에 다시 보낼 수 없다.
- 필기는 원본 PDF를 고치지 않고 PDF 위에 따로 저장한다. 개인 필기(파란색)는 그 기기에만 저장된다. 공용 필기(빨간색, "공용" 표시)는 리더가 쓰고 모두가 본다.
- 악보 파일을 새 파일로 바꿔도 이전 파일과 그 위의 필기는 남는다(악보 버전 관리).
- 예배를 지우면 예배 날짜와 곡 순서만 지워지고 곡과 악보는 악보함에 남는다. 곡까지 지우려면 총 관리자가 악보함에서 곡을 열고 "이 곡 지우기"를 누른다. 예배 순서에 들어 있는 곡이면 한 번 더 확인한 뒤 그 예배 순서에서도 뺀다.

### 올릴 수 있는 파일

| 고른 것 | 저장 방식 | 사이트에서 |
| --- | --- | --- |
| 사진 여러 장(찍기 또는 고르기) | 순서대로 한 쪽에 한 장씩 담은 PDF 악보 하나로 합친다. 긴 변 2400픽셀로 줄여 JPEG로 담는다 | PDF 악보와 같이 확대, 필기, 이전 곡과 다음 곡 |
| PDF 한 개 | 그대로 | 확대, 필기 |
| 음원, 영상 한 개(mp3, m4a, mp4 등) | 그대로 | 사이트 안에서 재생, 내려받기 |
| 그 밖의 파일 한 개(한글, 워드 등) | 그대로 | "파일 열기"를 누르면 기기의 앱으로 연다 |

- 파일 하나는 50MB까지 올릴 수 있다. Supabase 무료 플랜의 파일 한도가 50MB이다.
- 사진은 30장까지 합칠 수 있고 고른 뒤 순서를 바꾸거나 뺄 수 있다. 컴퓨터에서는 끌어다 놓거나 복사한 그림을 붙여 넣을(Ctrl+V) 수 있다.
- 아이폰 사진(HEIC)은 아이폰에서 올리면 그대로 바뀐다. HEIC를 읽지 못하는 기기에서는 안내 문구가 나온다.

## 2. 실시간 반영과 표시등

화면 위쪽 앱 이름 옆에 작은 표시등이 있다. 누르면 설명과 마지막 확인 시각이 나온다.

| 표시 | 뜻 |
| --- | --- |
| 초록 점(깜빡임) "실시간" | 서버와 실시간으로 연결되어 있다. 리더가 곡, Key, 순서, 공개 상태를 바꾸면 화면이 저절로 새로 고쳐진다. |
| "방금 반영됨" | 방금 바뀐 내용을 받아 화면에 반영했다(4초 동안 보인다). |
| 노란 점 "연결 중" 또는 "자동 확인" | 실시간 연결이 안 되는 상태이다. 대신 1분마다 새 내용을 확인한다. |
| 회색 점 "인터넷 끊김" | 인터넷이 끊겼다. 다시 연결되면 자동으로 확인한다. |

홈 화면에 설치한 앱은 따로 만든 앱이 아니라 같은 사이트를 여는 바로 가기이다. 그래서 다음과 같이 반영된다.

- 리더가 고친 내용은 표시등이 초록색이면 바로 반영된다. 앱을 닫았다가 다시 열 때도 새로 고친다.
- 사이트 코드를 고쳐 다시 배포하면 앱을 지우고 다시 설치하지 않아도 다음에 열 때 새 화면이 나온다.
- 실시간 반영은 Supabase Realtime(Postgres Changes)을 쓴다. 데이터베이스 설정에서 `services`, `service_songs`, `annotations` 표를 실시간 대상(`supabase_realtime`)에 넣어 두었다.

## 3. 설치하기(처음 한 번)

준비물은 GitHub 계정(이 저장소), Vercel 계정, Supabase 계정이다. Supabase 계정은 3-2 단계에서 Vercel 화면 안에서 만들 수 있다. 모두 무료 플랜으로 시작할 수 있다(6장의 유의 사항 참고).

### 3-1. Vercel에 저장소 올리기

1. https://vercel.com/new 에 들어가 GitHub로 로그인한다.
2. 저장소 목록에서 `salrom`을 골라 "Import"를 누른다.
3. 설정은 그대로 두고 "Deploy"를 누른다. Next.js로 자동 인식되며 설치 명령은 `npm install`, 빌드 명령은 `npm run build`이다.
4. 배포가 끝나면 `https://프로젝트이름.vercel.app` 형태의 주소가 생긴다. 이 단계에서는 "서버 연결이 필요합니다" 화면이 나오는 것이 정상이다.

Vercel은 `main` 브랜치를 실제 사이트(Production)로 배포하고 `main`이 없으면 `master`를 쓴다. 그 밖의 브랜치는 미리보기 배포가 된다. 이 저장소는 지금 작업 브랜치(`claude/church-worship-sheet-app-3dglu8`)에만 코드가 있으므로 이 브랜치를 `main`으로 합치거나 Vercel 프로젝트의 Settings > Git > Production Branch에서 실제 사이트로 쓸 브랜치를 지정한다. 메뉴 이름은 바뀔 수 있다.

### 3-2. Supabase 연결하기

1. Vercel 프로젝트 화면의 "Storage" 탭(또는 Marketplace)에서 Supabase를 고르고 새 데이터베이스를 만든다.
2. 만들 때 3-1의 프로젝트에 연결한다. 연결하면 Supabase 주소, 키, 데이터베이스 주소가 프로젝트 환경 변수로 자동으로 들어간다.
3. 지역(Region)은 한국과 가까운 곳을 고르면 응답이 빠르다. 이 화면에서 고를 수 있는 지역 목록은 확실하지 않음.

### 3-3. 다시 배포하기

`NEXT_PUBLIC_`으로 시작하는 값은 빌드할 때 들어가므로 Supabase를 연결한 뒤 한 번 다시 배포해야 한다.
Vercel 프로젝트 > Deployments에서 가장 최근 배포의 메뉴(…)를 눌러 "Redeploy"를 고른다. 메뉴 이름은 바뀔 수 있다.

### 3-4. 사이트 준비하기

1. 사이트 주소에 들어가면 "사이트를 처음 준비합니다" 화면이 나온다.
2. "사이트 준비하기"를 한 번 누른다. 표, 권한 정책, 악보 저장소(`sheets`), 실시간 설정, 처음 비밀번호, 알림 키가 만들어진다.
3. 끝나면 홈 화면으로 바뀐다. 이후에는 이 화면이 다시 나오지 않는다.

자동 준비가 실패하면 Supabase 대시보드의 SQL Editor에서 `supabase/migrations` 폴더의 파일을 이름 순서대로 하나씩 붙여 넣고 실행한 뒤 사이트를 새로 고친다. 결과는 같다.

### 업데이트가 자동으로 적용되는 방식

새 버전이 데이터베이스 변경을 담고 있으면(`supabase/migrations`에 새 파일) 배포 뒤 처음 접속할 때 아직 적용하지 않은 파일만 자동으로 실행한다. 적용한 파일 목록은 `app_settings` 표의 `schema` 항목에 기록한다. 여러 사람이 동시에 접속해도 한 번만 실행되도록 데이터베이스 잠금을 건다.

업데이트가 자동으로 적용되지 않을 때는 총 관리자 화면 맨 위에 빨간 안내가 나온다. 이때는 SQL Editor에서 `supabase/migrations`의 처음 설치 파일(`_init.sql`) 다음 파일들을 이름 순서대로 실행한다. 이 파일들은 여러 번 실행해도 결과가 같게 만들어져 있다.

### 3-5. 처음 비밀번호 바꾸기

1. 위쪽 "로그인"을 누르고 `1221`을 넣어 총 관리자 모드로 들어간다.
2. 총 관리자 화면 > "비밀번호와 기록 설정"에서 리더 비밀번호와 총 관리자 비밀번호를 각각 바꾼다. 숫자와 영문 4~20자이고 두 비밀번호는 서로 달라야 한다.
3. 바뀐 리더 비밀번호를 찬양팀 리더에게만 알려 준다.

### 3-6. (권장) Supabase 가입 막기

이 사이트는 회원 가입을 쓰지 않는다. 리더 모드와 총 관리자 모드로 한 번씩 들어가 본 뒤 Supabase 대시보드 > Authentication 설정에서 "Allow new users to sign up"(화면에 따라 "Enable sign ups")을 끈다. 끄면 이미 있는 계정만 로그인할 수 있다. 끄지 않아도 가입한 계정에는 아무 권한이 없도록 데이터베이스 정책이 막고 있다.

### 3-7. 팀원에게 알리기

1. 사이트 주소를 단체방에 올린다. 팀원은 누르기만 하면 된다.
2. 처음 들어오면 이름을 적는 안내가 한 번 나온다(선택). 적으면 총 관리자 접속 기록에 그 이름으로 보인다.
3. 설정 화면의 안내대로 홈 화면에 추가하고 "알림 켜기"를 누른다. iPhone과 iPad는 홈 화면에 추가한 앱에서만 알림을 켤 수 있다.

## 4. 환경 변수

3-2의 연결을 쓰면 직접 넣을 값은 없다. 다른 호스팅을 쓰거나 직접 넣을 때는 `.env.example`을 참고한다.

| 이름 | 값 | 비고 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 주소 | 필수. 빌드할 때 읽는다 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable 키 | 필수. 예전 이름 `NEXT_PUBLIC_SUPABASE_ANON_KEY`도 된다 |
| `SUPABASE_SECRET_KEY` | secret 키 | 필수. 서버 전용. 예전 이름 `SUPABASE_SERVICE_ROLE_KEY`도 된다 |
| `POSTGRES_URL_NON_POOLING` | 데이터베이스 직접 연결 주소 | 3-4 자동 준비에만 쓴다. 없으면 `POSTGRES_URL`, `SUPABASE_DB_URL`, `DATABASE_URL` 순서로 찾는다 |
| `NEXT_PUBLIC_APP_NAME` | 예: `○○교회 찬양팀` | 선택. 화면과 홈 화면 아이콘 이름 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | 알림 키 | 선택. 없으면 3-4에서 자동으로 만들어 데이터베이스에 저장한다 |
| `VAPID_SUBJECT` | `mailto:관리자메일` | 선택. 푸시 서비스에 전달되는 연락처 |
| `SHARED_ACCOUNT_DOMAIN` | 예: `우리교회.kr` | 선택. 관리 모드용 공용 계정 이메일의 도메인(기본 `example.com`) |

- secret 키는 모든 권한을 가진 키이다. `NEXT_PUBLIC_`을 붙이거나 다른 사람에게 보여 주지 않는다.
- 리더 모드와 총 관리자 모드는 각각 공용 계정(`worship-leader@도메인`, `worship-admin@도메인`) 하나로 로그인한다. 이 계정의 실제 비밀번호는 secret 키에서 계산하므로 어디에도 저장하지 않는다. 사람이 넣는 비밀번호(1234 등)는 데이터베이스에 해시로만 저장한다.

## 5. 총 관리자 화면

위쪽 "총 관리자" 버튼으로 들어간다. 30초마다 저절로 새로 고친다.

| 항목 | 내용 |
| --- | --- |
| 숫자 요약 | 지금 접속, 오늘 방문, 최근 7일 방문 기기 수 |
| 지금 접속 중 | 최근 2분 안에 화면을 보고 있던 기기 |
| 최근 접속 기록 | 누가(적은 이름 또는 기기 종류), 언제, 어디서(도시, 지역, 나라), 몇 분, 어떤 모드로 접속했는지 |
| 접속 상세 | 그 접속에서 본 화면과 머문 시간(예: "악보: 주님의 은혜 (10월 11일 주일예배) 3분") |
| 많이 본 악보 | 최근 30일 동안 많이 연 악보 |
| 관리 기록 | 관리 모드 들어옴과 나감, 비밀번호 틀림, 찬양 공개, 변경 알림, 사이트 준비 |
| 비밀번호와 기록 설정 | 비밀번호 바꾸기, 오래된 접속 기록 지우기 |
| 곡 관리 | 곡 이름 바꾸기, 쓰지 않는 곡 지우기(예배 순서에 쓰인 곡은 지울 수 없다) |

- 머문 시간은 화면을 열어 둔 동안 30초마다 보내는 신호로 계산한다. 30분 넘게 쉬었다가 다시 오면 새 접속으로 센다.
- 위치는 Vercel이 IP 주소로 추정해 알려 주는 값(`x-vercel-ip-city` 등)이라 실제 위치와 다를 수 있다. 로컬 개발 환경에서는 "알 수 없음"으로 나온다.
- 기기는 사람 이름이 아니라 브라우저 단위로 구분한다. 같은 사람이 휴대폰과 노트북으로 들어오면 두 명으로 보인다.

## 6. 알아 둘 점

아래 내용은 작성 시점(2026년 10월)에 찾은 자료 기준이다. 각 서비스 정책은 바뀔 수 있으므로 공식 페이지를 다시 확인한다.

- 공개 열람과 저작권: 로그인 없이 볼 수 있게 했으므로 주소를 아는 사람은 누구나 악보 PDF를 볼 수 있다. 상용 악보를 올리고 나누는 일의 이용 권한은 교회가 따로 확인할 라이선스 문제이며 이 사이트는 그 권한을 판단하거나 보장하지 않는다.
- 접속 기록과 개인정보: 접속 시각, 대략의 위치, 기기 종류, 본 화면을 기록한다. 처음 방문 안내에 이 사실을 적어 두었다. 이 기록에 대한 법적 요건(동의, 보관 기간 등)은 확실하지 않음. 필요 없으면 총 관리자 화면에서 오래된 기록을 지운다.
- Supabase 무료 플랜은 7일 동안 사용이 없으면 프로젝트가 일시 중지되고 대시보드에서 다시 켜야 한다고 알려져 있다. 데이터는 유지된다. 명절 등으로 2주 이상 쉬는 경우 미리 확인한다.
- Vercel에서 Supabase를 설치할 때 보이는 무료 플랜 안내는 데이터베이스 500MB, 월 전송량 5GB, 파일 저장 1GB이다(2026년 10월 설치 화면 기준). 악보 PDF 한 개가 보통 수백 KB이므로 10명 규모에서는 여유가 있을 것으로 보인다(추측입니다). 음원과 영상은 파일이 크므로 많이 올리면 1GB에 빨리 닿을 수 있다.
- Vercel Hobby(무료) 플랜은 비상업 개인 용도로 제한된다. 교회 찬양팀 사용이 이 조건에 해당하는지는 확실하지 않음. 필요하면 Vercel에 문의하거나 다른 Next.js 호스팅을 검토한다.
- iPhone과 iPad는 iOS와 iPadOS 16.4 이상에서 홈 화면에 추가한 웹앱만 푸시 알림을 받을 수 있고 사용자가 버튼을 눌러 허용해야 한다.
- Supabase는 예전 키(`anon`, `service_role`)를 2026년 말까지 단계적으로 없애고 새 키(publishable, secret)로 바꾸도록 안내한다. 이 사이트는 두 이름을 모두 읽는다.

## 7. 데이터 구조와 권한

화면에서 버튼을 숨기는 것과 별개로 데이터베이스 정책(RLS)과 서버 코드가 권한을 강제한다.

| 표 | 내용 | 읽기 | 쓰기 |
| --- | --- | --- | --- |
| `services` | 예배 날짜, 이름, 상태(초안/공개) | 공개된 예배는 누구나, 초안은 리더 | 리더(초안 삭제), 총 관리자(공개 예배 삭제) |
| `songs` | 곡명 | 누구나 | 리더(삭제는 총 관리자) |
| `sheets` | 곡에 딸린 악보(예: G키 악보) | 누구나 | 리더 |
| `sheet_versions` | 악보 파일과 버전 번호(서버가 매김) | 누구나 | 리더 |
| `service_songs` | 예배 곡 순서, Key, 사용한 악보 버전 | 예배를 볼 수 있는 사람 | 리더 |
| `annotations` | 공용 필기(악보, 버전, 쪽, 종류, 좌표) | 누구나 | 리더 |
| `profiles` | 공용 계정의 역할 | 본인과 리더 | 서버만 |
| `app_settings` | 비밀번호 해시, 알림 키 | 서버만 | 서버만 |
| `visitors`, `visit_sessions`, `page_views` | 접속 기록(기기, 접속, 본 화면) | 서버만(총 관리자 화면) | 서버만 |
| `access_events` | 관리 기록 | 서버만(총 관리자 화면) | 서버만 |
| `push_subscriptions` | 기기별 알림 구독 | 서버만 | 서버만 |

- 개인 필기는 서버에 보내지 않고 그 기기의 브라우저 저장소(IndexedDB)에만 저장한다. 브라우저 데이터를 지우면 함께 지워진다.
- 예배마다 사용한 악보 버전을 고정해 두므로 악보를 교체해도 지난 예배와 그때의 필기가 그대로 남는다.
- 필기 좌표는 페이지 너비를 1로 하는 비율로 저장하므로 확대 배율이나 기기와 관계없이 같은 자리에 그려진다.

## 8. 기술 구성과 폴더 구조

| 항목 | 사용 기술 |
| --- | --- |
| 화면과 서버 | Next.js 16(App Router), React 19, TypeScript, Tailwind CSS 4 |
| 데이터, 파일, 실시간 | Supabase(Postgres, Storage, Realtime, Auth는 관리 모드 공용 계정에만 사용) |
| PDF 표시 | pdf.js(legacy 빌드, 구형 iPhone 대응) |
| 알림 | Web Push(VAPID), web-push 라이브러리, 서비스 워커 |

```
src/
  app/
    (main)/          위쪽 메뉴와 하단 메뉴가 있는 화면: 홈, 이번 주, 악보함, 지난 예배, 설정, 로그인, 예배 편집, 관리자
    (viewer)/        전체 화면: 악보(/play, /sheet), 기기별 미리보기(/preview)
    actions/         모드 들어가기와 나가기, 공개와 알림, 관리자 기능(Server Action)
    api/             접속 기록(/api/track), 알림 구독(/api/push)
    manifest.ts      홈 화면 설치 정보
  components/        공통 화면 요소, 실시간 표시등, viewer/(PDF 표시와 필기)
  lib/               권한 표, 비밀번호와 설정, 처음 설치, 접속 기록, 초성 검색, 날짜, Supabase 연결, 데이터 조회
  proxy.ts           관리 모드 세션 갱신
public/sw.js         서비스 워커(알림 표시와 알림 눌렀을 때 이동)
supabase/
  migrations/        데이터베이스 구조와 권한 정책
  tests/             권한 정책 검증 SQL
scripts/             pdf.js 보조 파일 복사, 설치용 SQL 묶음 생성
e2e/                 로컬 브라우저 검증(선택)
```

화면 크기별 모습은 사이트의 설정 > "휴대폰, 패드, 노트북 화면 미리보기"(`/preview`)에서 한 번에 확인할 수 있다.

## 9. 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

| 명령 | 내용 |
| --- | --- |
| `npm run check` | lint, 타입 검사, 단위 테스트 |
| `npm run build` | 배포용 빌드 |
| `npm run test:db` | 로컬 Postgres에서 권한 정책(RLS) 검증. `PG_TEST_URL` 필요 |
| `npm run gen:schema` | 마이그레이션 SQL을 처음 설치와 자동 업데이트용 코드(`src/lib/schema.generated.ts`)로 묶는다. dev와 build 전에 자동으로 실행된다 |
| `bash e2e/run.sh` | 로컬 Postgres와 흉내 서버로 앱 전체를 띄워 처음 설치, 업데이트 자동 적용, 방문자, 리더, 총 관리자, 파일 올리기와 곡 지우기, 확대, 알림 시나리오를 브라우저로 검증한다. 자세한 내용은 `e2e/README.md` |

데이터베이스 구조를 바꿀 때는 `supabase/migrations`에 새 파일을 추가하고 `src/lib/database.types.ts`, `supabase/tests/rls.test.sql`, `src/lib/permissions.ts`를 함께 맞춘다. 새 파일은 이미 설치된 사이트에 자동으로 적용되므로 여러 번 실행해도 결과가 같게 쓰고, 스스로 트랜잭션(begin, commit)을 열지 않는다.

## 출처

- 파일 하나의 크기 한도(무료 플랜 50MB): [Supabase Storage 파일 한도](https://supabase.com/docs/guides/storage/uploads/file-limits)
- Supabase 키 종류(publishable, secret)와 예전 키 정리 일정: [Supabase Understanding API keys](https://supabase.com/docs/guides/api/api-keys), [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- Vercel에서 Supabase 연결 시 들어가는 환경 변수: [Supabase Vercel Marketplace 안내](https://supabase.com/docs/guides/integrations/vercel-marketplace), [Vercel Marketplace Supabase](https://vercel.com/marketplace/supabase)
- Vercel Production 브랜치와 미리보기 배포: [Vercel Git 배포 문서](https://vercel.com/docs/deployments/git), [Vercel 사용자 지정 Production 브랜치](https://vercel.com/blog/custom-production-branch)
- 접속 위치 헤더: [Vercel 위치 헤더 안내](https://vercel.com/guides/geo-ip-headers-geolocation-vercel-functions), [Vercel 요청 헤더 문서](https://vercel.com/docs/headers/request-headers)
- 실시간 반영: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- 가입 막기: [Supabase Auth 일반 설정](https://supabase.com/docs/guides/auth/general-configuration)
- Supabase 무료 플랜: [Jetadmin Supabase 요금 정리](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Automation Atlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)(제3자 자료)
- Vercel Hobby 플랜: [Vercel Hobby 플랜 문서](https://vercel.com/docs/plans/hobby), [Vercel 공정 사용 가이드](https://vercel.com/docs/limits/fair-use-guidelines)
- iOS 웹 푸시: [WebKit 블로그 Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
