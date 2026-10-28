-- Sprint 1 (v0.2.0) import: activities from the export file and the import history.
-- Backlog v0.2.0 items 4, 5, 7. Decisions P13 (store every activity, show only rides), P14 (skip broken
-- activities), P15 (deleted rides stay deleted), P16/P33 (history incl. "Not imported"), P17 (outcomes),
-- T5 (startDateLocal is Brussels wall-clock time), T6 (raw JSON kept), A2 (RLS on auth.uid()).

-- ---------------------------------------------------------------------------------------------------
-- imports: one row per file the user tried to import (P16, P33)
-- ---------------------------------------------------------------------------------------------------
create table public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  imported_at timestamptz not null default now(),
  status text not null check (status in ('imported', 'not_imported')),
  -- Activities in the file; the six outcome counts add up to it.
  activity_count integer not null default 0 check (activity_count >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  updated_count integer not null default 0 check (updated_count >= 0),
  unchanged_count integer not null default 0 check (unchanged_count >= 0),
  not_a_ride_count integer not null default 0 check (not_a_ride_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  deleted_earlier_count integer not null default 0 check (deleted_earlier_count >= 0),
  -- Skipped activities from the client-side validation: [{index, name?, startLocal?, issues: [{path, reason}]}].
  errors jsonb not null default '[]'::jsonb check (jsonb_typeof(errors) = 'array'),
  -- Why a file was not imported (status 'not_imported' only).
  error_message text check (char_length(error_message) <= 2000),
  constraint imports_error_message_matches_status check (
    (status = 'not_imported') = (error_message is not null)
  )
);

comment on table public.imports is 'Import history: one row per file, including files that were not a valid export (P16, P33).';
comment on column public.imports.errors is 'Skipped activities with their position in the file and the reasons (P14).';

create index imports_user_imported_at_idx on public.imports (user_id, imported_at desc);

alter table public.imports enable row level security;

create policy "imports_select_own" on public.imports
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "imports_insert_own" on public.imports
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- History rows are never edited or deleted by the app (they go with the auth user).
revoke all on table public.imports from anon, authenticated;
grant select, insert on table public.imports to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- activities: every activity from the export (P13), keyed by the Strava activity ID per user
-- ---------------------------------------------------------------------------------------------------
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  strava_id bigint not null check (strava_id > 0),
  name text not null,
  sport_type text not null check (char_length(sport_type) between 1 and 64),
  -- Cycling types are rides (P4, P13). Keep this list in sync with src/features/import/sport-types.ts.
  is_ride boolean generated always as (
    sport_type = any (array[
      'Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'EMountainBikeRide',
      'VirtualRide', 'Velomobile', 'Handcycle'
    ])
  ) stored,
  -- startDateLocal as Brussels wall-clock time (T5) and the instant derived from it.
  start_local timestamp not null,
  start_at timestamptz not null,
  distance_m double precision not null check (distance_m >= 0),
  moving_time_s integer not null check (moving_time_s >= 0),
  elevation_m double precision not null,
  commute boolean not null default false,
  trainer boolean not null default false,
  polyline text,
  -- Optional, for export v2 (Q1); empty for most of the history (P5).
  average_watts double precision check (average_watts >= 0),
  max_watts double precision check (max_watts >= 0),
  average_heartrate double precision check (average_heartrate >= 0),
  max_heartrate double precision check (max_heartrate >= 0),
  average_cadence double precision check (average_cadence >= 0),
  -- The activity exactly as it was in the file (T6).
  raw jsonb not null check (jsonb_typeof(raw) = 'object'),
  -- Set when the ride is deleted in the app; later imports skip it (P15).
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_user_strava_id_key unique (user_id, strava_id)
);

comment on table public.activities is 'Every imported activity (P13); only rows with is_ride are shown as rides.';
comment on column public.activities.start_local is 'startDateLocal from the export, read as Europe/Brussels wall-clock time (T5).';
comment on column public.activities.start_at is 'start_local interpreted in Europe/Brussels.';
comment on column public.activities.raw is 'The activity object as it was in the export file (T6).';
comment on column public.activities.deleted_at is 'Deleted in the app; skipped by every later import (P15).';

create index activities_user_start_idx on public.activities (user_id, start_local desc);

alter table public.activities enable row level security;

create policy "activities_select_own" on public.activities
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "activities_insert_own" on public.activities
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "activities_update_own" on public.activities
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No delete: rides are soft-deleted with deleted_at (P15); rows go with the auth user.
revoke all on table public.activities from anon, authenticated;
grant select, insert, update on table public.activities to authenticated;

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------------
-- import_activities: save one file in one transaction (all-or-nothing per file, backlog item 5)
-- ---------------------------------------------------------------------------------------------------
-- activities: array of normalised activities, keys named like the columns
--   {strava_id, name, sport_type, start_local, distance_m, moving_time_s, elevation_m, commute,
--    trainer, polyline?, average_watts?, max_watts?, average_heartrate?, max_heartrate?,
--    average_cadence?, raw}
-- skipped: the activities the client could not read (stored in imports.errors).
--
-- Outcome per activity (P15, P17); the counts add up to activity_count:
--   deleted_earlier  the row exists with deleted_at set; it is not touched
--   unchanged        the row exists with the same data (also for activities that are not rides)
--   new / updated    a ride that was inserted / changed
--   not_a_ride       an activity that is not a ride and was inserted or changed (stored, hidden)
--   skipped          listed by the client in `skipped`
create function public.import_activities(file_name text, activities jsonb, skipped jsonb default '[]'::jsonb)
returns public.imports
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  incoming public.activities;
  existing public.activities;
  saved_is_ride boolean;
  c_new integer := 0;
  c_updated integer := 0;
  c_unchanged integer := 0;
  c_not_a_ride integer := 0;
  c_deleted_earlier integer := 0;
  c_skipped integer;
  result public.imports;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if import_activities.activities is null or jsonb_typeof(import_activities.activities) <> 'array' then
    raise exception 'activities must be a JSON array' using errcode = '22023';
  end if;
  if import_activities.skipped is null or jsonb_typeof(import_activities.skipped) <> 'array' then
    raise exception 'skipped must be a JSON array' using errcode = '22023';
  end if;
  c_skipped := jsonb_array_length(import_activities.skipped);

  for item in select value from jsonb_array_elements(import_activities.activities) loop
    if jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'raw') <> 'object' then
      raise exception 'every activity must be an object with a raw object' using errcode = '22023';
    end if;
    incoming := jsonb_populate_record(null::public.activities, item);
    if incoming.strava_id is null then
      raise exception 'every activity needs a strava_id' using errcode = '22023';
    end if;

    select a.* into existing
    from public.activities a
    where a.user_id = uid and a.strava_id = incoming.strava_id
    for update;

    if not found then
      insert into public.activities (
        user_id, strava_id, name, sport_type, start_local, start_at, distance_m, moving_time_s,
        elevation_m, commute, trainer, polyline, average_watts, max_watts, average_heartrate,
        max_heartrate, average_cadence, raw
      ) values (
        uid, incoming.strava_id, incoming.name, incoming.sport_type, incoming.start_local,
        incoming.start_local at time zone 'Europe/Brussels', incoming.distance_m,
        incoming.moving_time_s, incoming.elevation_m, coalesce(incoming.commute, false),
        coalesce(incoming.trainer, false), incoming.polyline, incoming.average_watts,
        incoming.max_watts, incoming.average_heartrate, incoming.max_heartrate,
        incoming.average_cadence, incoming.raw
      )
      returning is_ride into saved_is_ride;
      if saved_is_ride then c_new := c_new + 1; else c_not_a_ride := c_not_a_ride + 1; end if;

    elsif existing.deleted_at is not null then
      c_deleted_earlier := c_deleted_earlier + 1;

    elsif (
      existing.name, existing.sport_type, existing.start_local, existing.distance_m,
      existing.moving_time_s, existing.elevation_m, existing.commute, existing.trainer,
      existing.polyline, existing.average_watts, existing.max_watts, existing.average_heartrate,
      existing.max_heartrate, existing.average_cadence, existing.raw
    ) is not distinct from (
      incoming.name, incoming.sport_type, incoming.start_local, incoming.distance_m,
      incoming.moving_time_s, incoming.elevation_m, coalesce(incoming.commute, false),
      coalesce(incoming.trainer, false), incoming.polyline, incoming.average_watts,
      incoming.max_watts, incoming.average_heartrate, incoming.max_heartrate,
      incoming.average_cadence, incoming.raw
    ) then
      c_unchanged := c_unchanged + 1;

    else
      update public.activities a set
        name = incoming.name,
        sport_type = incoming.sport_type,
        start_local = incoming.start_local,
        start_at = incoming.start_local at time zone 'Europe/Brussels',
        distance_m = incoming.distance_m,
        moving_time_s = incoming.moving_time_s,
        elevation_m = incoming.elevation_m,
        commute = coalesce(incoming.commute, false),
        trainer = coalesce(incoming.trainer, false),
        polyline = incoming.polyline,
        average_watts = incoming.average_watts,
        max_watts = incoming.max_watts,
        average_heartrate = incoming.average_heartrate,
        max_heartrate = incoming.max_heartrate,
        average_cadence = incoming.average_cadence,
        raw = incoming.raw
      where a.id = existing.id
      returning a.is_ride into saved_is_ride;
      if saved_is_ride then c_updated := c_updated + 1; else c_not_a_ride := c_not_a_ride + 1; end if;
    end if;
  end loop;

  insert into public.imports (
    user_id, file_name, status, activity_count, new_count, updated_count, unchanged_count,
    not_a_ride_count, skipped_count, deleted_earlier_count, errors
  ) values (
    uid, import_activities.file_name, 'imported',
    jsonb_array_length(import_activities.activities) + c_skipped,
    c_new, c_updated, c_unchanged, c_not_a_ride, c_skipped, c_deleted_earlier,
    import_activities.skipped
  )
  returning * into result;

  return result;
end;
$$;

comment on function public.import_activities(text, jsonb, jsonb) is
  'Saves the valid activities of one export file in one transaction and writes the history row (backlog v0.2.0 item 5).';

revoke execute on function public.import_activities(text, jsonb, jsonb) from public, anon;
grant execute on function public.import_activities(text, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------
-- log_not_imported: history row for a file that is not a valid export; nothing else changes (P33)
-- ---------------------------------------------------------------------------------------------------
create function public.log_not_imported(file_name text, reason text)
returns public.imports
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result public.imports;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  insert into public.imports (user_id, file_name, status, error_message)
  values (auth.uid(), log_not_imported.file_name, 'not_imported', log_not_imported.reason)
  returning * into result;
  return result;
end;
$$;

comment on function public.log_not_imported(text, text) is
  'Writes a "Not imported" history row for a file that is not a valid export (P33).';

revoke execute on function public.log_not_imported(text, text) from public, anon;
grant execute on function public.log_not_imported(text, text) to authenticated;
