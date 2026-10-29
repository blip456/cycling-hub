-- Weight-loss goal (Sprint 4, wireframe R2 option A: target weight and date; P65, engine-rules.md section 9).
-- A separate table rather than columns on profiles: a goal has its own life (active, reached, cancelled), the
-- history of earlier goals stays, and the start weight is a snapshot. One active goal per user (partial unique
-- index). Change an active goal by updating it; to replace it, set the old one to cancelled first.
-- App rules (they depend on today's date or on the weight log, so they are not in the database):
--   * target_date must be in the future when the goal is written.
--   * the loss rate (start - target) / weeks to the date must not exceed the cap of 0.5 % of body weight per week
--     (R2c, section 9); the app offers the earliest date at the cap instead.
--   * a target at or above the start weight is not a weight-loss goal (also checked here).
-- RLS scoped to auth.uid() (A2). Metric units only (P6).

create table public.weight_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_weight_kg numeric(5, 2) not null check (target_weight_kg between 30 and 250),
  target_date date not null,
  -- The 7-day average on the day the goal was set; the planned weight line starts here (section 9).
  start_weight_kg numeric(5, 2) not null check (start_weight_kg between 30 and 250),
  start_date date not null default (now() at time zone 'Europe/Brussels')::date,
  status text not null default 'active' check (status in ('active', 'reached', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint weight_goals_target_below_start check (target_weight_kg < start_weight_kg),
  constraint weight_goals_date_after_start check (target_date > start_date)
);

comment on table public.weight_goals is 'Weight-loss goal: target weight and date (R2 option A). One active goal per user.';
comment on column public.weight_goals.target_weight_kg is 'Target weight in kilograms, 30 to 250 (like weight_entries), below start_weight_kg.';
comment on column public.weight_goals.target_date is 'Date the athlete wants to reach the target; after start_date. In the future when written (app rule).';
comment on column public.weight_goals.start_weight_kg is 'Weight trend value on start_date, the start of the planned line.';
comment on column public.weight_goals.start_date is 'The day the goal was set (Brussels date).';
comment on column public.weight_goals.status is 'active, reached or cancelled. At most one active goal per user.';

create unique index weight_goals_one_active_idx on public.weight_goals (user_id) where status = 'active';
create index weight_goals_user_created_idx on public.weight_goals (user_id, created_at desc);

alter table public.weight_goals enable row level security;

create policy "weight_goals_select_own" on public.weight_goals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "weight_goals_insert_own" on public.weight_goals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "weight_goals_update_own" on public.weight_goals
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weight_goals_delete_own" on public.weight_goals
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.weight_goals from anon, authenticated;
grant select, insert, update, delete on table public.weight_goals to authenticated;

create trigger weight_goals_set_updated_at
  before update on public.weight_goals
  for each row execute function public.set_updated_at();
