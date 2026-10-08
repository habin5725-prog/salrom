-- 찬양팀 악보 앱 초기 스키마
-- 권한은 화면에서 버튼을 숨기는 것과 별개로 여기 RLS 정책에서 강제한다.

------------------------------------------------------------
-- 열거형
------------------------------------------------------------
-- pending: 가입 후 관리자 승인 전. 어떤 데이터도 볼 수 없다.
create type public.user_role as enum ('pending', 'member', 'leader', 'admin');
create type public.service_status as enum ('draft', 'published');
create type public.annotation_scope as enum ('personal', 'global');
create type public.annotation_type as enum ('pen', 'highlighter', 'text');

------------------------------------------------------------
-- profiles
------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '' check (char_length(name) <= 40),
  role public.user_role not null default 'pending',
  instrument text check (char_length(instrument) <= 40),
  created_at timestamptz not null default now()
);

-- 역할 확인 함수. profiles 정책 안에서 profiles를 다시 읽을 때 재귀가 생기지 않도록 security definer로 둔다.
create function public.app_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() in ('member', 'leader', 'admin'), false)
$$;

create function public.is_leader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() in ('leader', 'admin'), false)
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

-- 회원가입 시 profiles 행을 만든다. 가장 처음 가입한 사람은 총 관리자가 된다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, name, role)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 40),
    case when is_first then 'admin'::public.user_role else 'pending'::public.user_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 역할 변경은 총 관리자만 가능하다. 마지막 총 관리자는 강등할 수 없다.
-- security invoker로 두어 current_user가 실제 요청 역할(authenticated)이 되게 한다.
-- SQL 편집기(postgres)나 service_role에서 실행한 변경은 막지 않는다.
create function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception '사용자 ID는 변경할 수 없습니다.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role then
    if current_user in ('authenticated', 'anon') and not public.is_admin() then
      raise exception '권한을 변경할 수 없습니다.' using errcode = '42501';
    end if;

    if old.role = 'admin' and new.role <> 'admin'
       and (select count(*) from public.profiles p where p.role = 'admin') <= 1 then
      raise exception '마지막 총 관리자는 변경할 수 없습니다.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
before update on public.profiles
for each row execute function public.guard_profile_update();

alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_member());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- 행 추가는 가입 트리거만 한다. 수정 가능한 열도 제한한다.
revoke insert, update, delete on public.profiles from authenticated;
grant update (name, instrument, role) on public.profiles to authenticated;

------------------------------------------------------------
-- 공통: updated_at 갱신
------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

------------------------------------------------------------
-- services (예배)
------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  title text not null default '주일예배' check (char_length(title) between 1 and 60),
  status public.service_status not null default 'draft',
  published_at timestamptz,
  -- 마지막으로 팀원에게 알림을 보낸 시각. 같은 알림이 연달아 나가지 않게 막는 데 쓴다.
  notified_at timestamptz,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_date_idx on public.services (service_date desc);

create trigger services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

alter table public.services enable row level security;

-- 팀원은 공개된 예배만, 리더와 관리자는 초안까지 본다.
create policy services_select on public.services
  for select to authenticated
  using ((status = 'published' and public.is_member()) or public.is_leader());

create policy services_insert on public.services
  for insert to authenticated
  with check (public.is_leader());

create policy services_update on public.services
  for update to authenticated
  using (public.is_leader())
  with check (public.is_leader());

create policy services_delete on public.services
  for delete to authenticated
  using (public.is_admin() or (public.is_leader() and status = 'draft'));

------------------------------------------------------------
-- songs (곡)
------------------------------------------------------------
create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 100),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index songs_title_idx on public.songs (title);

alter table public.songs enable row level security;

create policy songs_select on public.songs
  for select to authenticated using (public.is_member());
create policy songs_insert on public.songs
  for insert to authenticated with check (public.is_leader());
create policy songs_update on public.songs
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy songs_delete on public.songs
  for delete to authenticated using (public.is_admin());

------------------------------------------------------------
-- sheets (곡에 딸린 악보) / sheet_versions (악보 파일 버전)
-- 필기는 특정 악보의 특정 버전에 연결된다.
-- 새 PDF로 교체하면 새 버전이 생기고 이전 버전 파일과 필기는 그대로 남는다.
------------------------------------------------------------
create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references public.songs (id) on delete cascade,
  name text not null default '악보' check (char_length(name) between 1 and 60),
  current_version integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sheets_song_idx on public.sheets (song_id);

create trigger sheets_updated_at
before update on public.sheets
for each row execute function public.set_updated_at();

create table public.sheet_versions (
  sheet_id uuid not null references public.sheets (id) on delete cascade,
  version integer not null check (version >= 1),
  file_path text not null unique,
  file_size integer,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (sheet_id, version)
);

-- 버전 번호는 서버에서 매긴다. 동시에 올려도 번호가 겹치지 않도록 악보별로 잠근다.
create function public.assign_sheet_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.sheet_id::text));
  select coalesce(max(v.version), 0) + 1 into new.version
  from public.sheet_versions v
  where v.sheet_id = new.sheet_id;
  return new;
end;
$$;

create trigger sheet_versions_assign
before insert on public.sheet_versions
for each row execute function public.assign_sheet_version();

create function public.bump_sheet_current_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.sheets s
  set current_version = greatest(s.current_version, new.version)
  where s.id = new.sheet_id;
  return new;
end;
$$;

create trigger sheet_versions_bump
after insert on public.sheet_versions
for each row execute function public.bump_sheet_current_version();

alter table public.sheets enable row level security;
alter table public.sheet_versions enable row level security;

create policy sheets_select on public.sheets
  for select to authenticated using (public.is_member());
create policy sheets_insert on public.sheets
  for insert to authenticated with check (public.is_leader());
create policy sheets_update on public.sheets
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy sheets_delete on public.sheets
  for delete to authenticated using (public.is_admin());

create policy sheet_versions_select on public.sheet_versions
  for select to authenticated using (public.is_member());
create policy sheet_versions_insert on public.sheet_versions
  for insert to authenticated with check (public.is_leader());
create policy sheet_versions_delete on public.sheet_versions
  for delete to authenticated using (public.is_admin());
-- 버전 행은 수정하지 않는다(update 정책 없음).

------------------------------------------------------------
-- service_songs (예배 곡 순서)
-- 예배마다 사용한 악보 버전을 고정해 두므로 악보를 교체해도 지난 예배 기록과 필기가 유지된다.
------------------------------------------------------------
create table public.service_songs (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete restrict,
  sheet_id uuid,
  sheet_version integer,
  position integer not null default 0,
  song_key text check (char_length(song_key) <= 12),
  created_at timestamptz not null default now(),
  foreign key (sheet_id, sheet_version) references public.sheet_versions (sheet_id, version) on delete set null,
  check ((sheet_id is null) = (sheet_version is null))
);

create index service_songs_service_idx on public.service_songs (service_id, position);
create index service_songs_song_idx on public.service_songs (song_id);

-- 선택한 악보는 반드시 같은 곡의 악보여야 한다.
create function public.check_service_song_sheet()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sheet_id is not null and not exists (
    select 1 from public.sheets s where s.id = new.sheet_id and s.song_id = new.song_id
  ) then
    raise exception '선택한 악보가 이 곡의 악보가 아닙니다.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger service_songs_check_sheet
before insert or update of song_id, sheet_id on public.service_songs
for each row execute function public.check_service_song_sheet();

alter table public.service_songs enable row level security;

create policy service_songs_select on public.service_songs
  for select to authenticated
  using (
    exists (
      select 1 from public.services s
      where s.id = service_id
        and ((s.status = 'published' and public.is_member()) or public.is_leader())
    )
  );
create policy service_songs_insert on public.service_songs
  for insert to authenticated with check (public.is_leader());
create policy service_songs_update on public.service_songs
  for update to authenticated using (public.is_leader()) with check (public.is_leader());
create policy service_songs_delete on public.service_songs
  for delete to authenticated using (public.is_leader());

-- 순서 변경을 한 번에 저장한다. 호출자 권한(RLS)이 그대로 적용된다.
create function public.reorder_service_songs(p_service_id uuid, p_ids uuid[])
returns void
language sql
set search_path = ''
as $$
  update public.service_songs ss
  set position = t.ord
  from unnest(p_ids) with ordinality as t (id, ord)
  where ss.id = t.id and ss.service_id = p_service_id;
$$;

------------------------------------------------------------
-- annotations (필기)
-- personal: 작성자 본인만 본다. global: 팀 전체가 보고 리더와 관리자만 쓴다.
------------------------------------------------------------
create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null,
  sheet_version integer not null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  page integer not null check (page >= 1),
  type public.annotation_type not null,
  data jsonb not null check (octet_length(data::text) <= 100000),
  scope public.annotation_scope not null default 'personal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sheet_id, sheet_version) references public.sheet_versions (sheet_id, version) on delete cascade
);

create index annotations_sheet_idx on public.annotations (sheet_id, sheet_version, page);

-- 작성자와 연결 악보는 수정 중에 바뀌지 않는다.
create function public.guard_annotation_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id = old.user_id;
  new.sheet_id = old.sheet_id;
  new.sheet_version = old.sheet_version;
  new.created_at = old.created_at;
  new.updated_at = now();
  return new;
end;
$$;

create trigger annotations_guard_update
before update on public.annotations
for each row execute function public.guard_annotation_update();

alter table public.annotations enable row level security;

create policy annotations_select on public.annotations
  for select to authenticated
  using (
    public.is_member()
    and ((scope = 'personal' and user_id = auth.uid()) or scope = 'global')
  );

create policy annotations_insert on public.annotations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_member()
    and (scope = 'personal' or public.is_leader())
  );

create policy annotations_update on public.annotations
  for update to authenticated
  using (
    (scope = 'personal' and user_id = auth.uid() and public.is_member())
    or (scope = 'global' and public.is_leader())
  )
  with check (
    (scope = 'personal' and user_id = auth.uid() and public.is_member())
    or (scope = 'global' and public.is_leader())
  );

create policy annotations_delete on public.annotations
  for delete to authenticated
  using (
    (scope = 'personal' and user_id = auth.uid() and public.is_member())
    or (scope = 'global' and public.is_leader())
  );

------------------------------------------------------------
-- push_subscriptions (기기별 알림 구독)
------------------------------------------------------------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  device text check (char_length(device) <= 120),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid() and public.is_member());
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- 같은 기기에서 다른 사람으로 로그인해도 구독을 넘겨받을 수 있게 저장한다.
create function public.save_push_subscription(p_endpoint text, p_subscription jsonb, p_device text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception '승인된 팀원만 알림을 받을 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, subscription, device)
  values (auth.uid(), p_endpoint, p_subscription, left(p_device, 120));
end;
$$;

------------------------------------------------------------
-- 익명(로그인 전) 사용자는 어떤 테이블에도 접근하지 않는다.
------------------------------------------------------------
revoke all on public.profiles, public.services, public.songs, public.sheets,
  public.sheet_versions, public.service_songs, public.annotations, public.push_subscriptions
  from anon;
revoke execute on function public.reorder_service_songs(uuid, uuid[]) from anon, public;
revoke execute on function public.save_push_subscription(text, jsonb, text) from anon, public;
grant execute on function public.reorder_service_songs(uuid, uuid[]) to authenticated;
grant execute on function public.save_push_subscription(text, jsonb, text) to authenticated;

------------------------------------------------------------
-- 실시간 반영: 공용 필기 변경을 다른 사람 화면에 전달한다.
------------------------------------------------------------
alter publication supabase_realtime add table public.annotations;

------------------------------------------------------------
-- Storage: 악보 PDF는 비공개 버킷에 저장하고 승인된 팀원만 읽는다.
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sheets', 'sheets', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy sheets_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'sheets' and public.is_member());

create policy sheets_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sheets' and public.is_leader());

create policy sheets_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'sheets' and public.is_admin());
