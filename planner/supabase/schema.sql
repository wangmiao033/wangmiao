-- Supabase SQL bootstrap for Personal Planner
-- 在 Supabase 项目里：SQL Editor -> New query -> 粘贴执行

-- 1) profiles：与 auth.users 一一对应
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  city text
);

-- 2) planner_states：云端镜像（按用户一份）
create table if not exists public.planner_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  version int not null default 1,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint planner_states_user_unique unique (user_id)
);

create index if not exists planner_states_user_id_idx on public.planner_states (user_id);
create index if not exists planner_states_updated_at_idx on public.planner_states (updated_at desc);

-- 3) events：埋点（用于后台统计/活跃/留存）
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_created_at_idx on public.events (created_at desc);
create index if not exists events_name_idx on public.events (name);

-- 4) 新用户注册后自动创建 profile（默认 role=user）
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', null))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5) Row Level Security
alter table public.profiles enable row level security;
alter table public.planner_states enable row level security;
alter table public.events enable row level security;

-- profiles: 自己读写自己；admin 可读所有
drop policy if exists "profiles_read_own_or_admin" on public.profiles;
create policy "profiles_read_own_or_admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- planner_states: 用户只能读写自己；admin 可读所有
drop policy if exists "planner_states_read_own_or_admin" on public.planner_states;
create policy "planner_states_read_own_or_admin"
  on public.planner_states for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "planner_states_write_own" on public.planner_states;
create policy "planner_states_write_own"
  on public.planner_states for insert
  with check (user_id = auth.uid());

drop policy if exists "planner_states_update_own" on public.planner_states;
create policy "planner_states_update_own"
  on public.planner_states for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- events: 用户可写自己的事件；仅 admin 可读全量（普通用户不开放读）
drop policy if exists "events_insert_own" on public.events;
create policy "events_insert_own"
  on public.events for insert
  with check (user_id = auth.uid());

drop policy if exists "events_admin_read" on public.events;
create policy "events_admin_read"
  on public.events for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

