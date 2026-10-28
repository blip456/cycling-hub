-- Re-imports no longer count activities that are not rides as "unchanged" (PO answer, 28 Oct 2026,
-- decision T10). Every activity that is not a ride is reported as "not a ride", whether it was inserted,
-- changed or already stored, so a second import of the same file reports the rides as unchanged and the
-- rest as not a ride. Outcome per activity, the counts still add up to activity_count:
--   deleted_earlier  the row exists with deleted_at set; it is not touched
--   unchanged        a ride that exists with the same data
--   new / updated    a ride that was inserted / changed
--   not_a_ride       an activity that is not a ride (stored, hidden)
--   skipped          listed by the client in `skipped`
create or replace function public.import_activities(file_name text, activities jsonb, skipped jsonb default '[]'::jsonb)
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
      -- Only rides count as unchanged; an activity that is not a ride stays "not a ride" (PO, 28 Oct).
      if existing.is_ride then c_unchanged := c_unchanged + 1; else c_not_a_ride := c_not_a_ride + 1; end if;

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

