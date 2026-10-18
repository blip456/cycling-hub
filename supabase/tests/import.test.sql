-- pgTAP tests for public.activities, public.imports, import_activities() and log_not_imported().
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(48);

-- Structure ----------------------------------------------------------------------------------------
select has_table('public', 'activities', 'activities table exists');
select has_table('public', 'imports', 'imports table exists');
select col_is_unique('public', 'activities', array['user_id', 'strava_id'], 'strava_id is unique per user');
select is(
  (select relrowsecurity from pg_class where oid = 'public.activities'::regclass),
  true,
  'RLS is enabled on activities'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.imports'::regclass),
  true,
  'RLS is enabled on imports'
);
select function_returns('public', 'import_activities', array['text', 'jsonb', 'jsonb'], 'imports',
  'import_activities returns the history row');
select is(
  has_function_privilege('anon', 'public.import_activities(text, jsonb, jsonb)', 'execute'),
  false,
  'anon cannot execute import_activities'
);
select is(
  has_function_privilege('anon', 'public.log_not_imported(text, text)', 'execute'),
  false,
  'anon cannot execute log_not_imported'
);

-- Users --------------------------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

-- Test batch: a summer ride, a winter gravel ride, a hike, plus one activity the client skipped.
create temporary table batch (name text primary key, body jsonb) on commit drop;
insert into batch values
  ('ride', '{"strava_id": 1001, "name": "Test ride", "sport_type": "Ride", "start_local": "2026-07-01T10:00:00",
    "distance_m": 42000, "moving_time_s": 5400, "elevation_m": 300, "commute": false, "trainer": false,
    "polyline": "abc", "raw": {"id": 1001, "name": "Test ride", "sportType": "Ride"}}'),
  ('gravel', '{"strava_id": 1002, "name": "Test gravel", "sport_type": "GravelRide", "start_local": "2026-01-15T10:00:00",
    "distance_m": 60000, "moving_time_s": 9000, "elevation_m": 500, "commute": true, "trainer": false,
    "raw": {"id": 1002, "name": "Test gravel", "sportType": "GravelRide"}}'),
  ('hike', '{"strava_id": 1003, "name": "Test hike", "sport_type": "Hike", "start_local": "2026-03-01T09:00:00",
    "distance_m": 8000, "moving_time_s": 7200, "elevation_m": 400,
    "raw": {"id": 1003, "name": "Test hike", "sportType": "Hike"}}');
grant select on batch to authenticated, anon;

create temporary table results (step text primary key, r public.imports) on commit drop;
grant select, insert on results to authenticated;

-- As user A ----------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

insert into results
select 'first', public.import_activities(
  'test-export.json',
  (select jsonb_agg(body order by name) from batch),
  '[{"index": 3, "issues": [{"path": "activities[3].distance", "reason": "must be a number (metres)"}]}]'
);

select is((select (r).status from results where step = 'first'), 'imported', 'first import is imported');
select is((select (r).new_count from results where step = 'first'), 2, 'first import: 2 new rides');
select is((select (r).not_a_ride_count from results where step = 'first'), 1, 'first import: 1 not a ride');
select is((select (r).skipped_count from results where step = 'first'), 1, 'first import: 1 skipped');
select is((select (r).activity_count from results where step = 'first'), 4, 'first import: 4 activities in the file');
select is((select count(*)::int from public.activities), 3, 'every valid activity is stored, including the hike');
select is(
  (select is_ride from public.activities where strava_id = 1003),
  false,
  'the hike is stored but not a ride'
);
select is(
  (select array_agg(strava_id order by strava_id) from public.activities where is_ride),
  array[1001, 1002]::bigint[],
  'ride and gravel ride are rides'
);
select is(
  (select start_at from public.activities where strava_id = 1001),
  '2026-07-01T08:00:00Z'::timestamptz,
  'summer start_local is read as Brussels time (UTC+2)'
);
select is(
  (select start_at from public.activities where strava_id = 1002),
  '2026-01-15T09:00:00Z'::timestamptz,
  'winter start_local is read as Brussels time (UTC+1)'
);
select is(
  (select raw ->> 'sportType' from public.activities where strava_id = 1001),
  'Ride',
  'the raw activity is kept'
);
select is(
  (select errors -> 0 -> 'issues' -> 0 ->> 'path' from public.imports where id = (select (r).id from results where step = 'first')),
  'activities[3].distance',
  'skipped activities are stored with the import'
);

-- Same batch again: nothing changes.
insert into results
select 'again', public.import_activities('test-export.json', (select jsonb_agg(body order by name) from batch), '[]');

select is(
  (select array[(r).new_count, (r).updated_count, (r).unchanged_count, (r).not_a_ride_count,
                (r).skipped_count, (r).deleted_earlier_count] from results where step = 'again'),
  array[0, 0, 3, 0, 0, 0],
  'importing the same batch twice reports everything as unchanged'
);
select is((select count(*)::int from public.activities), 3, 'no duplicates after the second import');

-- Changed ride and changed hike.
insert into results
select 'changed', public.import_activities(
  'test-export-2.json',
  (select jsonb_agg(
     case name
       when 'ride' then jsonb_set(body, '{distance_m}', '42500')
       when 'hike' then jsonb_set(jsonb_set(body, '{name}', '"Renamed hike"'), '{raw,name}', '"Renamed hike"')
       else body
     end order by name)
   from batch),
  '[]'
);

select is(
  (select array[(r).new_count, (r).updated_count, (r).unchanged_count, (r).not_a_ride_count] from results where step = 'changed'),
  array[0, 1, 1, 1],
  'a changed ride counts as updated, a changed hike as not a ride, the rest as unchanged'
);
select is(
  (select distance_m from public.activities where strava_id = 1001),
  42500::double precision,
  'the changed ride is updated'
);
select is(
  (select name from public.activities where strava_id = 1003),
  'Renamed hike',
  'the changed hike is updated'
);

-- A ride deleted in the app is skipped by later imports (P15).
update public.activities set deleted_at = now() where strava_id = 1002;

insert into results
select 'deleted', public.import_activities(
  'test-export-3.json',
  (select jsonb_agg(jsonb_set(body, '{distance_m}', '1')) from batch where name = 'gravel'),
  '[]'
);

select is(
  (select array[(r).new_count, (r).updated_count, (r).unchanged_count, (r).deleted_earlier_count] from results where step = 'deleted'),
  array[0, 0, 0, 1],
  'a ride deleted earlier is reported as deleted earlier'
);
select is(
  (select distance_m from public.activities where strava_id = 1002),
  60000::double precision,
  'a ride deleted earlier is not touched'
);
select isnt(
  (select deleted_at from public.activities where strava_id = 1002),
  null,
  'a ride deleted earlier stays deleted'
);

-- A file that is not a valid export (P33).
insert into results
select 'failed', public.log_not_imported('notes.txt', 'This is not a Cycling Hub export: the file is not JSON.');

select is((select (r).status from results where step = 'failed'), 'not_imported', 'log_not_imported writes a not_imported row');
select is(
  (select (r).error_message from results where step = 'failed'),
  'This is not a Cycling Hub export: the file is not JSON.',
  'the reason is stored'
);
select is((select count(*)::int from public.imports), 5, 'every import is in the history');
select is(
  (select count(*)::int from public.imports where status = 'imported'),
  4,
  'four files were imported'
);

select throws_ok(
  $$ select public.import_activities('x.json', '{"not": "an array"}'::jsonb, '[]') $$,
  '22023',
  null,
  'activities must be an array'
);
select throws_ok(
  $$ insert into public.imports (user_id, file_name, status, error_message)
     values ('22222222-2222-2222-2222-222222222222', 'x.json', 'not_imported', 'x') $$,
  '42501',
  null,
  'user A cannot write history rows for user B'
);
select throws_ok(
  $$ delete from public.activities $$,
  '42501',
  null,
  'activities cannot be hard-deleted by the app'
);

-- As user B: isolation -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.activities), 0, 'user B sees none of user A''s activities');
select is((select count(*)::int from public.imports), 0, 'user B sees none of user A''s imports');

update public.activities set name = 'hacked' where strava_id = 1001;

insert into results
select 'user-b', public.import_activities(
  'b.json',
  (select jsonb_agg(body) from batch where name = 'ride'),
  '[]'
);
select is((select (r).new_count from results where step = 'user-b'), 1, 'the same Strava ID is new for another user');
select is((select count(*)::int from public.activities), 1, 'user B sees only their own activity');
select throws_ok(
  $$ insert into public.activities (user_id, strava_id, name, sport_type, start_local, start_at, distance_m, moving_time_s, elevation_m, raw)
     values ('11111111-1111-1111-1111-111111111111', 9, 'x', 'Ride', now(), now(), 1, 1, 1, '{}') $$,
  '42501',
  null,
  'user B cannot insert activities for user A'
);

-- As anon ------------------------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select count(*) from public.activities $$, '42501', null, 'anon has no access to activities');
select throws_ok($$ select count(*) from public.imports $$, '42501', null, 'anon has no access to imports');
select throws_ok(
  $$ select public.import_activities('x.json', '[]', '[]') $$,
  '42501',
  null,
  'anon cannot import'
);

-- Effects, as superuser ----------------------------------------------------------------------------
reset role;
select is(
  (select name from public.activities where strava_id = 1001 and user_id = '11111111-1111-1111-1111-111111111111'),
  'Test ride',
  'user B''s update on user A''s ride changed nothing'
);
select is(
  (select count(*)::int from public.activities where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'user A has three activities'
);
select is(
  (select count(*)::int from public.activities where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user B has one activity'
);
select is(
  (select count(*)::int from public.imports where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user B has one import'
);

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.activities where user_id = '22222222-2222-2222-2222-222222222222'),
  0,
  'activities are deleted with their auth user'
);

select * from finish();
rollback;
