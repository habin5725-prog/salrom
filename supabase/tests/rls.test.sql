-- 권한 정책(RLS) 검증. run.sh가 임시 데이터베이스에 스텁, 마이그레이션, 이 파일 순서로 적용한다.
-- 실패하면 ASSERT FAILED 오류로 중단된다.
\set ON_ERROR_STOP 1
\set QUIET 1

create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
$$;

create function tests.assert(cond boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then
    raise exception 'ASSERT FAILED: %', msg;
  end if;
end;
$$;

-- 문장이 권한 오류(42501)로 거부되어야 한다.
create function tests.assert_denied(stmt text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'ASSERT FAILED (거부되어야 함): %', msg;
end;
$$;

-- 문장이 지정한 SQLSTATE로 실패해야 한다.
create function tests.assert_error(stmt text, code text, msg text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = code then
      return;
    end if;
    raise exception 'ASSERT FAILED (오류 코드 % 기대, % 발생): %', code, sqlstate, msg;
  end;
  raise exception 'ASSERT FAILED (실패해야 함): %', msg;
end;
$$;

-- 영향받은 행 수를 돌려준다.
create function tests.affected(stmt text) returns integer language plpgsql as $$
declare
  n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on all functions in schema tests to authenticated, anon;

-- 사용자: 관리자(첫 가입), 리더, 팀원 2명, 승인 대기 1명
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.kr', '{"name":"관리자"}'),
  ('00000000-0000-0000-0000-00000000000b', 'leader@test.kr', '{"name":"리더"}'),
  ('00000000-0000-0000-0000-00000000000c', 'm1@test.kr', '{"name":"건반"}'),
  ('00000000-0000-0000-0000-00000000000d', 'm2@test.kr', '{"name":"드럼"}'),
  ('00000000-0000-0000-0000-00000000000e', 'pending@test.kr', '{}');

select tests.assert(
  (select role = 'admin' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  '첫 가입자는 총 관리자');
select tests.assert(
  (select count(*) = 4 from public.profiles where role = 'pending'),
  '이후 가입자는 승인 대기');
select tests.assert(
  (select name = 'pending' from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  '이름이 없으면 이메일 앞부분을 사용');

------------------------------------------------------------
-- 승인 대기 사용자
------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.assert((select count(*) = 1 from public.profiles), '승인 대기자는 자기 프로필만 본다');
select tests.assert_denied(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000e'$$,
  '승인 대기자는 스스로 권한을 올릴 수 없다');
select tests.assert(
  tests.affected($$update public.profiles set name = '새이름' where id = '00000000-0000-0000-0000-00000000000e'$$) = 1,
  '자기 이름은 바꿀 수 있다');
select tests.assert(
  tests.affected($$update public.profiles set name = '해킹' where id = '00000000-0000-0000-0000-00000000000a'$$) = 0,
  '다른 사람 프로필은 바꿀 수 없다');
select tests.assert_denied(
  $$insert into public.profiles (id, name, role) values ('00000000-0000-0000-0000-0000000000ff', 'x', 'admin')$$,
  '프로필 직접 추가 불가');
select tests.assert_error(
  $$select public.save_push_subscription('https://push.test/p', '{}'::jsonb, 'phone')$$,
  '42501', '승인 대기자는 알림 구독 불가');

------------------------------------------------------------
-- 총 관리자: 권한 부여
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.assert((select count(*) = 5 from public.profiles), '관리자는 전체 프로필을 본다');
update public.profiles set role = 'leader' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set role = 'member'
  where id in ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d');
select tests.assert_denied(
  $$update public.profiles set role = 'member' where id = '00000000-0000-0000-0000-00000000000a'$$,
  '마지막 총 관리자는 강등 불가');

------------------------------------------------------------
-- 팀원: 권한 변경 불가
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.assert((select count(*) = 5 from public.profiles), '팀원은 팀 프로필 목록을 본다');
select tests.assert_denied(
  $$update public.profiles set role = 'leader' where id = '00000000-0000-0000-0000-00000000000c'$$,
  '팀원은 자기 권한을 올릴 수 없다');
select tests.assert_denied(
  $$insert into public.services (service_date) values ('2026-10-11')$$,
  '팀원은 예배를 만들 수 없다');
select tests.assert_denied(
  $$insert into public.songs (title) values ('곡')$$,
  '팀원은 곡을 만들 수 없다');

------------------------------------------------------------
-- 리더: 예배, 곡, 악보, 버전
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.services (id, service_date) values ('10000000-0000-0000-0000-000000000001', '2026-10-11');
insert into public.songs (id, title) values
  ('20000000-0000-0000-0000-000000000001', '주님의 은혜'),
  ('20000000-0000-0000-0000-000000000002', '은혜 아니면');
insert into public.sheets (id, song_id) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');
insert into public.sheet_versions (sheet_id, file_path) values
  ('30000000-0000-0000-0000-000000000001', 's1/v1.pdf');
insert into public.sheet_versions (sheet_id, file_path) values
  ('30000000-0000-0000-0000-000000000001', 's1/v2.pdf');
insert into public.sheet_versions (sheet_id, file_path) values
  ('30000000-0000-0000-0000-000000000002', 's2/v1.pdf');
select tests.assert(
  (select array_agg(version order by version) = array[1, 2] from public.sheet_versions
   where sheet_id = '30000000-0000-0000-0000-000000000001'),
  '버전 번호는 서버가 1부터 매긴다');
select tests.assert(
  (select current_version = 2 from public.sheets where id = '30000000-0000-0000-0000-000000000001'),
  '현재 버전이 갱신된다');

insert into public.service_songs (id, service_id, song_id, sheet_id, sheet_version, position, song_key) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 1, 'G'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
   '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 2, 'A');
select tests.assert_error(
  $$insert into public.service_songs (service_id, song_id, sheet_id, sheet_version, position)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
            '30000000-0000-0000-0000-000000000001', 1, 3)$$,
  '23514', '다른 곡의 악보는 연결할 수 없다');
select tests.assert_error(
  $$insert into public.service_songs (service_id, song_id, sheet_id, sheet_version, position)
    values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000001', 9, 3)$$,
  '23503', '없는 버전은 연결할 수 없다');

-- 리더는 Storage에 PDF를 올릴 수 있다.
insert into storage.objects (bucket_id, name) values ('sheets', 's1/v1.pdf');

------------------------------------------------------------
-- 팀원: 초안은 보이지 않는다
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.assert((select count(*) = 0 from public.services), '팀원은 초안 예배를 볼 수 없다');
select tests.assert((select count(*) = 0 from public.service_songs), '팀원은 초안 곡 목록을 볼 수 없다');
select tests.assert((select count(*) = 2 from public.songs), '팀원은 악보함 곡을 본다');
select tests.assert(
  tests.affected($$update public.services set status = 'published'$$) = 0,
  '팀원은 예배를 공개할 수 없다');
-- 팀원이 순서 변경을 호출해도 반영되지 않아야 한다(아래 리더 단계에서 확인).
select public.reorder_service_songs('10000000-0000-0000-0000-000000000001',
  array['40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001']::uuid[]);
select tests.assert((select count(*) = 1 from storage.objects), '팀원은 악보 파일을 읽을 수 있다');
select tests.assert_denied(
  $$insert into storage.objects (bucket_id, name) values ('sheets', 'x.pdf')$$,
  '팀원은 악보 파일을 올릴 수 없다');

-- 승인 대기자는 악보 파일을 볼 수 없다.
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.assert((select count(*) = 0 from storage.objects), '승인 대기자는 악보 파일을 볼 수 없다');
select tests.assert((select count(*) = 0 from public.songs), '승인 대기자는 곡을 볼 수 없다');

------------------------------------------------------------
-- 리더: 순서 변경과 공개
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.assert(
  (select array_agg(id order by position) = array['40000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000002']::uuid[]
   from public.service_songs where service_id = '10000000-0000-0000-0000-000000000001'),
  '팀원의 순서 변경은 반영되지 않는다');
select public.reorder_service_songs('10000000-0000-0000-0000-000000000001',
  array['40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001']::uuid[]);
select tests.assert(
  (select array_agg(id order by position) = array['40000000-0000-0000-0000-000000000002',
     '40000000-0000-0000-0000-000000000001']::uuid[]
   from public.service_songs where service_id = '10000000-0000-0000-0000-000000000001'),
  '리더는 순서를 바꿀 수 있다');
update public.services set status = 'published', published_at = now()
  where id = '10000000-0000-0000-0000-000000000001';
select tests.assert(
  tests.affected($$delete from public.services where id = '10000000-0000-0000-0000-000000000001'$$) = 0,
  '리더는 공개된 예배를 삭제할 수 없다');

------------------------------------------------------------
-- 필기: 개인 필기와 공용 필기
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.assert((select count(*) = 1 from public.services), '팀원은 공개된 예배를 본다');
select tests.assert((select count(*) = 2 from public.service_songs), '팀원은 공개된 곡 목록을 본다');
insert into public.annotations (id, sheet_id, sheet_version, page, type, data, scope) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 1, 'pen',
   '{"points":[[0.1,0.1],[0.2,0.2]]}', 'personal');
select tests.assert_denied(
  $$insert into public.annotations (sheet_id, sheet_version, page, type, data, scope)
    values ('30000000-0000-0000-0000-000000000001', 1, 1, 'text', '{"text":"x"}', 'global')$$,
  '팀원은 공용 필기를 쓸 수 없다');
select tests.assert_denied(
  $$insert into public.annotations (sheet_id, sheet_version, user_id, page, type, data, scope)
    values ('30000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000d', 1, 'pen', '{}', 'personal')$$,
  '다른 사람 이름으로 필기를 쓸 수 없다');
select tests.assert_denied(
  $$update public.annotations set scope = 'global' where id = '50000000-0000-0000-0000-000000000001'$$,
  '팀원은 개인 필기를 공용으로 바꿀 수 없다');

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.assert((select count(*) = 0 from public.annotations), '리더도 다른 사람의 개인 필기는 볼 수 없다');
insert into public.annotations (id, sheet_id, sheet_version, page, type, data, scope) values
  ('50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 1, 1, 'text',
   '{"text":"후렴 2번"}', 'global');

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.assert(
  (select array_agg(scope::text) = array['global'] from public.annotations),
  '다른 팀원은 공용 필기만 본다');
select tests.assert(
  tests.affected($$delete from public.annotations where id = '50000000-0000-0000-0000-000000000001'$$) = 0,
  '다른 사람의 개인 필기는 지울 수 없다');
select tests.assert(
  tests.affected($$delete from public.annotations where id = '50000000-0000-0000-0000-000000000002'$$) = 0,
  '팀원은 공용 필기를 지울 수 없다');
select tests.assert(
  tests.affected($$update public.annotations set data = '{"text":"x"}' where id = '50000000-0000-0000-0000-000000000002'$$) = 0,
  '팀원은 공용 필기를 고칠 수 없다');

select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.assert(
  tests.affected($$update public.annotations set data = '{"text":"후렴 3번"}' where id = '50000000-0000-0000-0000-000000000002'$$) = 1,
  '총 관리자는 공용 필기를 고칠 수 있다');
select tests.assert(
  (select user_id = '00000000-0000-0000-0000-00000000000b' from public.annotations
   where id = '50000000-0000-0000-0000-000000000002'),
  '수정해도 작성자는 바뀌지 않는다');

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.assert(
  tests.affected($$delete from public.annotations where id = '50000000-0000-0000-0000-000000000001'$$) = 1,
  '자기 개인 필기는 지울 수 있다');

------------------------------------------------------------
-- 알림 구독
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select public.save_push_subscription('https://push.test/a', '{"endpoint":"https://push.test/a"}', 'iPhone');
select tests.assert((select count(*) = 1 from public.push_subscriptions), '자기 구독을 저장한다');
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.assert((select count(*) = 0 from public.push_subscriptions), '다른 사람 구독은 볼 수 없다');
select public.save_push_subscription('https://push.test/a', '{"endpoint":"https://push.test/a"}', 'iPhone');
reset role;
select tests.assert(
  (select user_id = '00000000-0000-0000-0000-00000000000d' from public.push_subscriptions
   where endpoint = 'https://push.test/a'),
  '같은 기기에서 다른 사람이 로그인하면 구독이 넘어간다');

------------------------------------------------------------
-- 로그인하지 않은 사용자
------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.assert_denied($$select * from public.services$$, '익명 사용자는 예배를 볼 수 없다');
select tests.assert_denied($$select * from public.annotations$$, '익명 사용자는 필기를 볼 수 없다');
select tests.assert((select count(*) = 0 from storage.objects), '익명 사용자는 악보 파일을 볼 수 없다');

------------------------------------------------------------
-- 총 관리자: 공개된 예배 삭제
------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.assert(
  tests.affected($$delete from public.services where id = '10000000-0000-0000-0000-000000000001'$$) = 1,
  '총 관리자는 공개된 예배도 삭제할 수 있다');
reset role;

\echo 'RLS 테스트 통과'
