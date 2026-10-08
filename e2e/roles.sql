-- PostgREST가 접속할 역할(Supabase의 authenticator와 같다). 스텁 다음에 적용한다.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authpass' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
