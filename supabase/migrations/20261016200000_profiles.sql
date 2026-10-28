-- One profile row per user (backlog v0.1.0 item 10). `last_seen_version` drives "What's new" in Sprint 1.
-- RLS scoped to auth.uid() (A2).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  last_seen_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'One row per user; created by a trigger on auth.users.';
comment on column public.profiles.last_seen_version is 'App version whose "What''s new" the user has seen.';

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: the row goes when the auth user is deleted (on delete cascade).

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update on table public.profiles to authenticated;

-- Keep updated_at current.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile row when a user is created in Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
