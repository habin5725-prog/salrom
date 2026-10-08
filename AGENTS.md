<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 프로젝트 규칙(찬양팀 악보 앱)

- 사용자는 40대 중심 찬양팀(최대 10명)이다. 화면은 단순하게, 글씨와 버튼은 크게, 아이콘에는 글자를 함께 둔다. 사용자 화면에 개발 용어를 쓰지 않는다.
- 권한은 `supabase/migrations`의 RLS 정책이 강제한다. 권한을 바꾸면 `src/lib/permissions.ts`, `src/lib/permissions.test.ts`, `supabase/tests/rls.test.sql`을 함께 바꾼다.
- 스키마를 바꾸면 `src/lib/database.types.ts`도 맞춘다(Supabase 생성 타입과 같은 모양).
- 이미 설치된 사이트에는 `supabase/migrations`의 새 파일이 첫 접속 때 자동 적용된다(`src/lib/setup.ts`). 새 파일은 여러 번 실행해도 같은 결과가 나오게 쓰고 begin/commit을 넣지 않는다. 고친 뒤 `npm run gen:schema`.
- Cache Components가 켜져 있다. 로그인 정보(cookies)를 읽는 서버 컴포넌트는 `<Suspense>` 안에 둔다. 레이아웃과 페이지는 따로 렌더링되므로 페이지마다 `getMember()`/`getLeader()`/`getAdmin()`으로 다시 확인한다.
- 저장과 공개는 분리한다. 알림은 공개할 때 한 번, 그 뒤에는 리더가 직접 보낼 때만 나간다.
- 확인 명령: `npm run check`, `npm run build`, `npm run test:db`(로컬 Postgres), `bash e2e/run.sh`(브라우저 검증).
