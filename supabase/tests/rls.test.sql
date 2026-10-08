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

-- 계정: 서버가 만든 리더와 총 관리자 공용 계정, 그리고 누군가 직접 가입한 계정(권한 없음)
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.kr', '{"name":"총 관리자"}', '{"app_role":"admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'leader@test.kr', '{"name":"리더"}', '{"app_role":"leader"}'),
  ('00000000-0000-0000-0000-00000000000e', 'stranger@test.kr', '{"name":"가입자"}', '{}');

select tests.assert(
  (select role = 'admin' from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'app_metadata.app_role=admin 이면 총 관리자');
select tests.assert(
  (select role = 'leader' from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  'app_metadata.app_role=leader 이면 리더');
select tests.assert(
  (select role = 'pending' from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  '직접 가입한 계정은 권한 없음');

------------------------------------------------------------
-- 리더: 예배, 곡, 악보, 버전
------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.services (id, service_date) values ('10000000-0000-0000-0000-000000000001', '2026-10-11');
insert into public.songs (id, title) values
  ('20000000-0000-0000-0000-000000000001', '주님의 은혜'),
  ('20000000-0000-0000-0000-000000000002', '은혜 아니면');
insert into public.sheets (id, song_id) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002');
insert into public.sheet_versions (sheet_id, file_path) values ('30000000-0000-0000-0000-000000000001', 's1/v1.pdf');
insert into public.sheet_versions (sheet_id, file_path) values ('30000000-0000-0000-0000-000000000001', 's1/v2.pdf');
insert into public.sheet_versions (sheet_id, file_path) values ('30000000-0000-0000-0000-000000000002', 's2/v1.pdf');
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
insert into storage.objects (bucket_id, name) values ('sheets', 's1/v1.pdf');
select tests.assert_denied(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000b'$$,
  '리더는 자기 권한을 올릴 수 없다');

------------------------------------------------------------
-- 로그인하지 않은 방문자(anon)
------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.assert((select count(*) = 0 from public.services), '방문자는 초안 예배를 볼 수 없다');
select tests.assert((select count(*) = 0 from public.service_songs), '방문자는 초안 곡 목록을 볼 수 없다');
select tests.assert((select count(*) = 2 from public.songs), '방문자는 악보함 곡을 본다');
select tests.assert((select count(*) = 3 from public.sheet_versions), '방문자는 악보 파일 목록을 본다');
select tests.assert((select count(*) = 1 from storage.objects), '방문자는 악보 파일을 내려받을 수 있다');
select tests.assert_denied($$insert into public.services (service_date) values ('2026-10-11')$$, '방문자는 예배를 만들 수 없다');
select tests.assert_denied($$insert into public.songs (title) values ('x')$$, '방문자는 곡을 만들 수 없다');
select tests.assert_denied($$update public.services set status = 'published'$$, '방문자는 예배를 공개할 수 없다');
select tests.assert_denied($$delete from public.songs$$, '방문자는 곡을 지울 수 없다');
select tests.assert_denied($$insert into storage.objects (bucket_id, name) values ('sheets', 'x.pdf')$$, '방문자는 악보 파일을 올릴 수 없다');
select tests.assert_denied($$select * from public.profiles$$, '방문자는 계정 정보를 볼 수 없다');
select tests.assert_denied($$select * from public.app_settings$$, '방문자는 앱 설정(비밀번호 해시)을 볼 수 없다');
select tests.assert_denied($$select * from public.visit_sessions$$, '방문자는 접속 기록을 볼 수 없다');
select tests.assert_denied($$select * from public.page_views$$, '방문자는 화면 기록을 볼 수 없다');
select tests.assert_denied($$select * from public.push_subscriptions$$, '방문자는 알림 구독을 볼 수 없다');
select tests.assert_denied($$insert into public.visitors (id) values (gen_random_uuid())$$, '방문자는 기록을 직접 쓸 수 없다');
select tests.assert_denied(
  $$select public.reorder_service_songs('10000000-0000-0000-0000-000000000001', array[]::uuid[])$$,
  '방문자는 순서 변경 함수를 부를 수 없다');

------------------------------------------------------------
-- 권한 없는 가입 계정은 방문자와 같다
------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.assert((select count(*) = 0 from public.services), '권한 없는 계정은 초안을 볼 수 없다');
select tests.assert_denied($$insert into public.services (service_date) values ('2026-10-11')$$, '권한 없는 계정은 예배를 만들 수 없다');
select tests.assert_denied(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000000e'$$,
  '권한 없는 계정은 스스로 권한을 올릴 수 없다');
-- 권한 없는 계정이 순서 변경을 불러도 반영되지 않아야 한다(아래 리더 단계에서 확인).
select public.reorder_service_songs('10000000-0000-0000-0000-000000000001',
  array['40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001']::uuid[]);
select tests.assert_denied(
  $$insert into public.annotations (sheet_id, sheet_version, page, type, data, scope)
    values ('30000000-0000-0000-0000-000000000001', 1, 1, 'text', '{"text":"x"}', 'global')$$,
  '권한 없는 계정은 공용 필기를 쓸 수 없다');
select tests.assert_denied($$select * from public.app_settings$$, '권한 없는 계정은 앱 설정을 볼 수 없다');

------------------------------------------------------------
-- 리더: 순서 변경, 공개, 공용 필기
------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.assert(
  (select array_agg(id order by position) = array['40000000-0000-0000-0000-000000000001',
     '40000000-0000-0000-0000-000000000002']::uuid[]
   from public.service_songs where service_id = '10000000-0000-0000-0000-000000000001'),
  '권한 없는 계정의 순서 변경은 반영되지 않는다');
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
insert into public.annotations (id, sheet_id, sheet_version, page, type, data, scope) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 1, 'text',
   '{"x":0.1,"y":0.1,"text":"후렴 2번"}', 'global');
select tests.assert_denied(
  $$insert into public.annotations (sheet_id, sheet_version, page, type, data, scope)
    values ('30000000-0000-0000-0000-000000000001', 1, 1, 'pen', '{}', 'personal')$$,
  '개인 필기는 서버에 저장하지 않는다(기기에 저장)');
select tests.assert_denied(
  $$insert into public.annotations (sheet_id, sheet_version, user_id, page, type, data, scope)
    values ('30000000-0000-0000-0000-000000000001', 1, '00000000-0000-0000-0000-00000000000a', 1, 'pen', '{}', 'global')$$,
  '다른 계정 이름으로 필기를 쓸 수 없다');
select tests.assert_denied($$select * from public.visit_sessions$$, '리더도 접속 기록 표를 직접 읽을 수 없다(서버가 총 관리자에게만 보여 준다)');

------------------------------------------------------------
-- 방문자: 공개된 예배와 공용 필기
------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '', false);
select tests.assert((select count(*) = 1 from public.services), '방문자는 공개된 예배를 본다');
select tests.assert((select count(*) = 2 from public.service_songs), '방문자는 공개된 곡 목록을 본다');
select tests.assert((select count(*) = 1 from public.annotations), '방문자는 공용 필기를 본다');
select tests.assert_denied(
  $$delete from public.annotations where id = '50000000-0000-0000-0000-000000000001'$$,
  '방문자는 공용 필기를 지울 수 없다');

------------------------------------------------------------
-- 총 관리자
------------------------------------------------------------
set role authenticated;
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.assert(
  tests.affected($$update public.annotations set data = '{"x":0.1,"y":0.1,"text":"후렴 3번"}' where id = '50000000-0000-0000-0000-000000000001'$$) = 1,
  '총 관리자는 공용 필기를 고칠 수 있다');
select tests.assert(
  (select user_id = '00000000-0000-0000-0000-00000000000b' from public.annotations
   where id = '50000000-0000-0000-0000-000000000001'),
  '수정해도 작성자는 바뀌지 않는다');
select tests.assert(
  tests.affected($$delete from public.services where id = '10000000-0000-0000-0000-000000000001'$$) = 1,
  '총 관리자는 공개된 예배도 삭제할 수 있다');
reset role;

\echo 'RLS 테스트 통과'
