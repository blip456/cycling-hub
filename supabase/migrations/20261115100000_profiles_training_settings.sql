-- Training settings on the existing profiles row (decisions P96 to P98; rules in docs/plan/engine-rules.md,
-- section 3b and section 5). Additive: every new column is nullable and null means "use the default", so
-- existing rows and the app keep working. The existing RLS policies, the table-level grants (select, insert,
-- update) and the updated_at trigger already cover new columns.
--
-- The defaults live in the app (engine constants), not in the database, so a default can change without a
-- migration and a null always means "the level's own value".

alter table public.profiles
  -- Where inside Zone 2 the easy and long rides aim, in percent of FTP. The Coggan band itself (56 to 75 %)
  -- is a fact and does not change, so the target must stay inside it. Default in the app: 65.
  add column zone2_target_percent smallint check (
    zone2_target_percent is null or zone2_target_percent between 56 and 75
  ),
  -- Longest long ride in minutes, in steps of 5. Replaces the level maximum (180 / 270 / 330).
  add column max_long_ride_min smallint check (
    max_long_ride_min is null or (max_long_ride_min between 90 and 480 and max_long_ride_min % 5 = 0)
  ),
  -- Most hours in a normal week, in half hours. Replaces the level maximum (6 / 10 / 16).
  add column max_weekly_hours numeric(3, 1) check (
    max_weekly_hours is null
    or (max_weekly_hours between 3 and 25 and max_weekly_hours * 2 = trunc(max_weekly_hours * 2))
  ),
  -- How the weekly hours of the last 24 weeks are summarised for week 1 of a plan. Default in the app: median.
  add column ride_history_stat text check (
    ride_history_stat is null or ride_history_stat in ('median', 'average')
  );

comment on column public.profiles.zone2_target_percent is 'Target inside Zone 2 for easy and long rides, percent of FTP, 56 to 75 (the Coggan band). Null means the default (65).';
comment on column public.profiles.max_long_ride_min is 'Longest long ride in minutes (90 to 480, steps of 5); replaces the level maximum. Null means the level maximum.';
comment on column public.profiles.max_weekly_hours is 'Most hours in a normal week (3 to 25, half hours); replaces the level maximum. Null means the level maximum.';
comment on column public.profiles.ride_history_stat is 'median or average of the weekly riding hours of the last 24 weeks, used for week 1 of a plan. Null means median.';
