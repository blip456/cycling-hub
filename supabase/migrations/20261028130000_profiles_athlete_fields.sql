-- Minimal athlete profile and weight reminder settings on the existing profiles row (P44, P46, backlog v0.4.0 items 4 and 4a).
-- Additive: every new column is nullable or has a default, so existing rows and the app keep working.
-- The existing RLS policies, the table-level grants (select, insert, update) and the updated_at trigger already
-- cover new columns; nothing is granted per column.

alter table public.profiles
  add column display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  add column birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  add column available_days smallint[] check (
    available_days is null
    or (available_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(available_days) <= 7)
  ),
  add column goal text check (goal is null or char_length(goal) <= 500),
  add column weight_reminder_day smallint not null default 0 check (weight_reminder_day between 0 and 6),
  add column weight_reminder_enabled boolean not null default true;

comment on column public.profiles.display_name is 'Optional name shown in the app (P44), 1 to 80 characters.';
comment on column public.profiles.birth_year is 'Optional birth year, used for age-based heart rate estimates (P44).';
comment on column public.profiles.available_days is
  'Days the athlete can train, as weekday numbers 0 to 6 where 0 = Sunday, 1 = Monday ... 6 = Saturday (same as JavaScript Date.getDay()). A smallint[] rather than a bitmask or seven booleans: readable in SQL and the API, and the check keeps values in range. Order is not meaningful and the app should write each day once. Null or empty means not set.';
comment on column public.profiles.goal is 'Optional free-text goal (P44), up to 500 characters.';
comment on column public.profiles.weight_reminder_day is
  'Day of the weekly weight reminder, 0 = Sunday ... 6 = Saturday (same numbering as available_days). Default 0 (Sunday) (P46).';
comment on column public.profiles.weight_reminder_enabled is 'False switches the in-app weight reminder card off (P46).';
