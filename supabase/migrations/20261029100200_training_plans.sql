-- Training plan (Sprint 4, v0.5.0; P58, P59, docs/plan/engine-rules.md sections 4 and 12): one row per generated plan.
-- The sessions are in planned_sessions, the change log in plan_changes. At most one active plan per user.
-- To replace the plan: set the old one to 'replaced' first, then insert the new one (the unique index is not deferrable).
-- RLS scoped to auth.uid() (A2).

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Week 1 starts here (default: the next Monday; the app decides, the database does not insist on a Monday).
  start_date date not null,
  -- 12 weeks by default; shorter (4 to 12) when an event is less than 12 weeks away (engine-rules.md section 4).
  weeks smallint not null default 12 check (weeks between 4 and 12),
  status text not null default 'active' check (status in ('active', 'replaced', 'completed', 'cancelled')),
  -- The answers the plan was built from (level, hours, purposes, days, event, expected event duration, target ...).
  intake jsonb not null check (jsonb_typeof(intake) = 'object'),
  -- Snapshots at build time, so a later baseline or weight change does not rewrite history.
  ftp_w smallint not null check (ftp_w between 30 and 700),
  weight_kg numeric(5, 2) check (weight_kg is null or weight_kg between 30 and 250),
  -- Version of the engine rules that built the plan (for example the date or a semver string).
  engine_version text not null check (char_length(engine_version) between 1 and 40),
  -- Hash of the inputs that matter (section 12 step 2); equal fingerprint means nothing is recalculated.
  input_fingerprint text not null check (char_length(input_fingerprint) between 1 and 200),
  -- The fingerprint the athlete undid (section 12, Undo): the same inputs are not recalculated again. Cleared on any input change.
  undone_fingerprint text check (undone_fingerprint is null or char_length(undone_fingerprint) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets planned_sessions and plan_changes point at (id, user_id) so they can never belong to another user's plan.
  constraint training_plans_id_user_key unique (id, user_id)
);

comment on table public.training_plans is 'A generated training plan (P58): start, length, the intake it was built from and the inputs it is a snapshot of.';
comment on column public.training_plans.weeks is 'Plan length in weeks, 4 to 12; 12 unless an event is closer (engine-rules.md section 4).';
comment on column public.training_plans.status is 'active, replaced (a newer plan took over), completed or cancelled. At most one active plan per user.';
comment on column public.training_plans.intake is 'The intake answers the plan was built from, as a JSON object (shape validated by the app).';
comment on column public.training_plans.ftp_w is 'FTP in watts when the plan was built (30 to 700, like baseline_entries).';
comment on column public.training_plans.weight_kg is 'Weight in kilograms when the plan was built; null without a weight log.';
comment on column public.training_plans.engine_version is 'Version of the engine rules that built the plan.';
comment on column public.training_plans.input_fingerprint is 'Hash of the inputs of the last evaluation (section 12). Same hash, no change.';
comment on column public.training_plans.undone_fingerprint is 'Fingerprint the athlete undid; not recalculated until an input changes.';

create unique index training_plans_one_active_idx on public.training_plans (user_id) where status = 'active';
create index training_plans_user_created_idx on public.training_plans (user_id, created_at desc);

alter table public.training_plans enable row level security;

create policy "training_plans_select_own" on public.training_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "training_plans_insert_own" on public.training_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "training_plans_update_own" on public.training_plans
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "training_plans_delete_own" on public.training_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.training_plans from anon, authenticated;
grant select, insert, update, delete on table public.training_plans to authenticated;

create trigger training_plans_set_updated_at
  before update on public.training_plans
  for each row execute function public.set_updated_at();
