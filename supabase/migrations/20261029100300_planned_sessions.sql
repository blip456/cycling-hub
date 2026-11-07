-- Planned sessions (Sprint 4, v0.5.0; engine-rules.md sections 7, 11, 12, 13): one row per session of a plan.
-- Two sessions on one day are allowed (day_order sorts them). RLS scoped to auth.uid() (A2).

-- A planned session may only point at a ride of the same user: activities get the (id, user_id) key that
-- planned_sessions references, the same pattern as test_weeks. Additive; the primary key stays as it is.
alter table public.activities add constraint activities_id_user_key unique (id, user_id);

create table public.planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id uuid not null,
  -- Week of the plan, 1 first, and its phase label (engine-rules.md section 4).
  week_number smallint not null check (week_number between 1 and 12),
  phase text not null check (phase in ('base', 'build', 'peak', 'recovery', 'taper')),
  session_date date not null,
  -- The session library (section 7.1) plus the event itself (section 4, point 4).
  kind text not null check (kind in (
    'recovery', 'endurance', 'long_ride', 'tempo', 'sweet_spot', 'threshold', 'vo2max', 'sprint',
    'torque', 'openers', 'test', 'event'
  )),
  title text not null check (char_length(title) between 1 and 120),
  duration_min smallint not null check (duration_min between 1 and 720),
  -- Planned load (section 2) and quality minutes (88 % FTP or more), for the weekly caps and the summaries.
  planned_load numeric(6, 1) not null default 0 check (planned_load >= 0),
  quality_min smallint not null default 0 check (quality_min between 0 and 720),
  -- Steps in percent of FTP: [{minutes, percent_ftp, zone, ...}]; watts and bpm are derived from the current baseline.
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  -- Why the session is in the plan, in plain words (the reason line of section 7.1 and the change reasons).
  reason text not null default '' check (char_length(reason) <= 1000),
  status text not null default 'planned' check (status in ('planned', 'done', 'missed', 'skipped', 'dropped')),
  -- Null follows the profile (riding_environment); true or false when the session is fixed to one (section 10).
  indoor boolean,
  -- The matched ride (section 11). A ride matches one session at most (unique index below).
  activity_id uuid,
  -- auto: set by matching, may change at the next evaluation. manual: a fix by the athlete, locked (section 11);
  -- a manual row with a null activity_id is a locked unlink. A linked ride always has a source.
  match_source text check (match_source is null or match_source in ('auto', 'manual')),
  -- The original date when the session was moved (missed session moved, or done early) (section 13).
  moved_from date,
  -- Order of sessions on the same day, 0 first.
  day_order smallint not null default 0 check (day_order between 0 and 9),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planned_sessions_plan_fkey foreign key (plan_id, user_id)
    references public.training_plans (id, user_id) on delete cascade,
  -- Only the ride link is cleared when a ride is removed; user_id stays (needs PostgreSQL 15 or later).
  constraint planned_sessions_activity_fkey foreign key (activity_id, user_id)
    references public.activities (id, user_id) on delete set null (activity_id),
  constraint planned_sessions_link_has_source check (activity_id is null or match_source is not null)
);

comment on table public.planned_sessions is 'One session of a training plan: day, type, steps, reason, status and the matched ride.';
comment on column public.planned_sessions.week_number is 'Week of the plan, 1 to 12.';
comment on column public.planned_sessions.phase is 'base, build, peak, recovery or taper (engine-rules.md section 4).';
comment on column public.planned_sessions.session_date is 'The day of the session (a calendar date, Brussels). Two sessions on one day are allowed.';
comment on column public.planned_sessions.kind is
  'Session library name: recovery, endurance, long_ride, tempo, sweet_spot, threshold, vo2max, sprint, torque (low-cadence torque), openers, test or event.';
comment on column public.planned_sessions.duration_min is 'Planned length in minutes, 1 to 720 (an event may be long; it is not counted in the week).';
comment on column public.planned_sessions.planned_load is 'Planned load: the sum over the steps of minutes / 60 x (percent FTP / 100)^2 x 100.';
comment on column public.planned_sessions.quality_min is 'Minutes of work at 88 % FTP or more.';
comment on column public.planned_sessions.steps is 'JSON array of steps in percent of FTP; watts and heart rate come from the current baseline.';
comment on column public.planned_sessions.status is 'planned, done (matched), missed, skipped (the athlete says so) or dropped (the engine removed it).';
comment on column public.planned_sessions.indoor is 'Null follows the profile; true indoor, false outdoor.';
comment on column public.planned_sessions.activity_id is 'The matched ride; set to null if the ride row is removed. One ride matches one session.';
comment on column public.planned_sessions.match_source is 'auto (matching) or manual (athlete fix, locked). Null while nothing is matched or fixed.';
comment on column public.planned_sessions.moved_from is 'Original date when the session was moved.';
comment on column public.planned_sessions.day_order is 'Order of sessions on the same day.';

create index planned_sessions_user_date_idx on public.planned_sessions (user_id, session_date);
create index planned_sessions_plan_idx on public.planned_sessions (plan_id);
create unique index planned_sessions_activity_key on public.planned_sessions (activity_id) where activity_id is not null;

alter table public.planned_sessions enable row level security;

create policy "planned_sessions_select_own" on public.planned_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "planned_sessions_insert_own" on public.planned_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "planned_sessions_update_own" on public.planned_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "planned_sessions_delete_own" on public.planned_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.planned_sessions from anon, authenticated;
grant select, insert, update, delete on table public.planned_sessions to authenticated;

create trigger planned_sessions_set_updated_at
  before update on public.planned_sessions
  for each row execute function public.set_updated_at();
