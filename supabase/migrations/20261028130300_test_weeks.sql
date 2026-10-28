-- Guided FTP test week (P39, P43, backlog v0.4.0 item 7): a week with a protocol and ordered sessions.
-- The user picks each session's date (P43), so scheduled_on stays null until chosen. RLS scoped to auth.uid() (A2).
-- The result of a finished week becomes a baseline_entries row, written by the app after the user confirms.

create table public.test_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  protocol text not null check (protocol in ('20min', 'ramp')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets test_sessions point at (id, user_id) so a session can never belong to another user's week.
  constraint test_weeks_id_user_key unique (id, user_id)
);

comment on table public.test_weeks is 'A guided FTP test week (P39): the protocol chosen and how far it is.';
comment on column public.test_weeks.protocol is '20min (20-minute test) or ramp (ramp test).';
comment on column public.test_weeks.status is 'planned, in_progress, completed or cancelled.';

create index test_weeks_user_created_idx on public.test_weeks (user_id, created_at desc);

create table public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_id uuid not null,
  position smallint not null check (position between 1 and 10),
  kind text not null check (kind in ('opener', 'test', 'recovery')),
  scheduled_on date,
  completed_at timestamptz,
  result_avg_power_w smallint check (result_avg_power_w between 1 and 2500),
  result_ftp_w smallint check (result_ftp_w between 30 and 700),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_sessions_week_fkey foreign key (week_id, user_id)
    references public.test_weeks (id, user_id) on delete cascade,
  constraint test_sessions_week_position_key unique (week_id, position)
);

comment on table public.test_sessions is 'One session of a test week, in order (position 1 first).';
comment on column public.test_sessions.position is 'Step order within the week, 1 first.';
comment on column public.test_sessions.kind is 'opener, test or recovery.';
comment on column public.test_sessions.scheduled_on is 'Date the user picked (P43); null until picked. The app never proposes one.';
comment on column public.test_sessions.completed_at is 'When the user ticked the session off; null while open.';
comment on column public.test_sessions.result_avg_power_w is 'Average power of the test effort in watts (the 20-minute average, or the best minute of the ramp).';
comment on column public.test_sessions.result_ftp_w is 'FTP in watts derived from the result; the user confirms before it becomes a baseline entry.';

create index test_sessions_week_idx on public.test_sessions (week_id, position);

alter table public.test_weeks enable row level security;
alter table public.test_sessions enable row level security;

create policy "test_weeks_select_own" on public.test_weeks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "test_weeks_insert_own" on public.test_weeks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "test_weeks_update_own" on public.test_weeks
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "test_weeks_delete_own" on public.test_weeks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "test_sessions_select_own" on public.test_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "test_sessions_insert_own" on public.test_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "test_sessions_update_own" on public.test_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "test_sessions_delete_own" on public.test_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.test_weeks from anon, authenticated;
revoke all on table public.test_sessions from anon, authenticated;
grant select, insert, update, delete on table public.test_weeks to authenticated;
grant select, insert, update, delete on table public.test_sessions to authenticated;

create trigger test_weeks_set_updated_at
  before update on public.test_weeks
  for each row execute function public.set_updated_at();

create trigger test_sessions_set_updated_at
  before update on public.test_sessions
  for each row execute function public.set_updated_at();
