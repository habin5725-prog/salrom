do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authpass' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@test.kr', '{"name":"관리자"}'),
  ('00000000-0000-0000-0000-00000000000b', 'leader@test.kr', '{"name":"리더"}'),
  ('00000000-0000-0000-0000-00000000000c', 'm1@test.kr', '{"name":"건반"}');
update public.profiles set role = 'leader' where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set role = 'member' where id = '00000000-0000-0000-0000-00000000000c';

insert into public.services (id, service_date, title, status) values
  ('10000000-0000-0000-0000-000000000001', current_date + 3, '주일예배', 'published'),
  ('10000000-0000-0000-0000-000000000002', current_date - 4, '주일예배', 'published'),
  ('10000000-0000-0000-0000-000000000003', current_date + 10, '주일예배', 'draft');
insert into public.songs (id, title) values
  ('20000000-0000-0000-0000-000000000001', '주님의 은혜'),
  ('20000000-0000-0000-0000-000000000002', '은혜 아니면');
insert into public.sheets (id, song_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '악보'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '악보');
insert into public.sheet_versions (sheet_id, file_path) values ('30000000-0000-0000-0000-000000000001', 'a/1.pdf');
insert into public.sheet_versions (sheet_id, file_path) values ('30000000-0000-0000-0000-000000000001', 'a/2.pdf');
insert into public.sheet_versions (sheet_id, file_path) values ('30000000-0000-0000-0000-000000000002', 'b/1.pdf');
insert into public.service_songs (id, service_id, song_id, sheet_id, sheet_version, position, song_key) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 1, 'G'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 2, 'A'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 1, 'F'),
  ('40000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', null, null, 1, 'D');
insert into public.push_subscriptions (user_id, endpoint, subscription) values
  ('00000000-0000-0000-0000-00000000000c', 'https://push.test/m1', '{"endpoint":"https://push.test/m1","keys":{"p256dh":"x","auth":"y"}}');
