-- Baseline history (P41, P42, backlog v0.4.0 items 5 and 10): FTP, max HR, resting HR and LTHR with date and source.
-- Append-only: there is no update policy and no update grant, so a correction is a new row. Rows are never overwritten.
-- RLS scoped to auth.uid() (A2).

create table public.baseline_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  effective_date date not null,
  ftp_w smallint check (ftp_w between 30 and 700),
  max_hr smallint check (max_hr between 100 and 260),
  resting_hr smallint check (resting_hr between 25 and 120),
  lthr smallint check (lthr between 80 and 240),
  source text not null check (source in ('manual', 'test_20min', 'test_ramp', 'stream_estimate', 'hr_data')),
  -- The ride an automatic estimate came from (P41). Activities are soft-deleted, but if the row ever goes, keep the history.
  source_activity_id uuid references public.activities (id) on delete set null,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint baseline_entries_has_value check (
    ftp_w is not null or max_hr is not null or resting_hr is not null or lthr is not null
  )
);

comment on table public.baseline_entries is
  'Append-only baseline history (P41, P42). The current baseline per metric is the newest row that has that metric; see the current_baseline view.';
comment on column public.baseline_entries.effective_date is 'The day the values apply from (a calendar date).';
comment on column public.baseline_entries.ftp_w is 'Functional threshold power in watts, 30 to 700. Null when this row does not set FTP.';
comment on column public.baseline_entries.max_hr is 'Maximum heart rate in bpm, 100 to 260. Null when this row does not set it.';
comment on column public.baseline_entries.resting_hr is 'Resting heart rate in bpm, 25 to 120. Optional.';
comment on column public.baseline_entries.lthr is 'Lactate threshold heart rate in bpm, 80 to 240. Null when this row does not set it.';
comment on column public.baseline_entries.source is
  'manual, test_20min, test_ramp, stream_estimate (best 20 minutes from a ride) or hr_data (highest heart rate in the rides).';
comment on column public.baseline_entries.source_activity_id is 'The ride an estimate came from, when there is one.';

create index baseline_entries_user_effective_idx
  on public.baseline_entries (user_id, effective_date desc, created_at desc);

alter table public.baseline_entries enable row level security;

create policy "baseline_entries_select_own" on public.baseline_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "baseline_entries_insert_own" on public.baseline_entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "baseline_entries_delete_own" on public.baseline_entries
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- No update policy and no update grant: history is append-only (P41). A correction is a new row.
revoke all on table public.baseline_entries from anon, authenticated;
grant select, insert, delete on table public.baseline_entries to authenticated;

-- Current baseline: one row per user with the newest value of each metric. A row only counts for a metric when
-- that metric is not null; ties on effective_date are broken by created_at. security_invoker keeps RLS in force.
create view public.current_baseline
with (security_invoker = true) as
select
  u.user_id,
  (select b.ftp_w from public.baseline_entries b
    where b.user_id = u.user_id and b.ftp_w is not null
    order by b.effective_date desc, b.created_at desc limit 1) as ftp_w,
  (select b.effective_date from public.baseline_entries b
    where b.user_id = u.user_id and b.ftp_w is not null
    order by b.effective_date desc, b.created_at desc limit 1) as ftp_effective_date,
  (select b.max_hr from public.baseline_entries b
    where b.user_id = u.user_id and b.max_hr is not null
    order by b.effective_date desc, b.created_at desc limit 1) as max_hr,
  (select b.effective_date from public.baseline_entries b
    where b.user_id = u.user_id and b.max_hr is not null
    order by b.effective_date desc, b.created_at desc limit 1) as max_hr_effective_date,
  (select b.resting_hr from public.baseline_entries b
    where b.user_id = u.user_id and b.resting_hr is not null
    order by b.effective_date desc, b.created_at desc limit 1) as resting_hr,
  (select b.effective_date from public.baseline_entries b
    where b.user_id = u.user_id and b.resting_hr is not null
    order by b.effective_date desc, b.created_at desc limit 1) as resting_hr_effective_date,
  (select b.lthr from public.baseline_entries b
    where b.user_id = u.user_id and b.lthr is not null
    order by b.effective_date desc, b.created_at desc limit 1) as lthr,
  (select b.effective_date from public.baseline_entries b
    where b.user_id = u.user_id and b.lthr is not null
    order by b.effective_date desc, b.created_at desc limit 1) as lthr_effective_date
from (select distinct user_id from public.baseline_entries) u;

comment on view public.current_baseline is
  'Newest value per metric (FTP, max HR, resting HR, LTHR) with its effective date, one row per user; runs with the caller''s rights (security_invoker).';

revoke all on table public.current_baseline from anon, authenticated;
grant select on table public.current_baseline to authenticated;
