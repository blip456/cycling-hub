-- pgTAP tests for public.planned_sessions: RLS on, own rows only, defaults, constraints, two sessions on one day,
-- a session cannot join another user's plan or ride, a ride matches one session, the ride link is cleared when
-- the ride goes, anon blocked.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

select has_table('public', 'planned_sessions', 'planned_sessions table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.planned_sessions'::regclass),
  true,
  'RLS is enabled on planned_sessions'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.training_plans (id, user_id, start_date, intake, ftp_w, engine_version, input_fingerprint)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '2026-11-02', '{}', 250, '1', 'fp-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '2026-11-02', '{}', 280, '1', 'fp-b');

insert into public.activities (id, user_id, strava_id, name, sport_type, start_local, start_at, distance_m, moving_time_s, elevation_m, raw)
values
  ('a0000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111', 1, 'ride a1', 'Ride', now(), now(), 1, 1, 1, '{}'),
  ('a0000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 2, 'ride a2', 'Ride', now(), now(), 1, 1, 1, '{}'),
  ('b0000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-222222222222', 3, 'ride b', 'Ride', now(), now(), 1, 1, 1, '{}');

insert into public.planned_sessions (user_id, plan_id, week_number, phase, session_date, kind, title, duration_min)
values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'base', '2026-11-04', 'endurance', 'Endurance', 60);

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.planned_sessions (id, plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-04', 'tempo', 'Tempo 2x15', 75) $$,
  'user A can add a session to their plan'
);
select is(
  (select status || '/' || planned_load::text || '/' || quality_min::text || '/' || steps::text || '/' || reason || '/' || day_order::text
   from public.planned_sessions where id = 'c0000000-0000-0000-0000-000000000001'),
  'planned/0.0/0/[]//0',
  'defaults: planned, no load, no steps, empty reason, day order 0'
);
select is(
  (select indoor from public.planned_sessions where id = 'c0000000-0000-0000-0000-000000000001'),
  null,
  'indoor is null by default (follows the profile)'
);
select lives_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min, day_order, indoor)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-04', 'recovery', 'Recovery spin', 30, 1, true) $$,
  'two sessions on one day are allowed'
);
select lives_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-05', k, k, 60
     from unnest(array['endurance', 'long_ride', 'sweet_spot', 'threshold', 'vo2max', 'sprint', 'torque', 'openers', 'test', 'event']) k $$,
  'every session library name and the event are accepted'
);
select is((select count(*)::int from public.planned_sessions), 12, 'user A sees only their own sessions');

select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-06', 'yoga', 'Yoga', 30) $$,
  '23514', null, 'an unknown kind is rejected'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min, status)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-06', 'endurance', 'x', 30, 'moved') $$,
  '23514', null, 'an unknown status is rejected'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 13, 'base', '2026-11-06', 'endurance', 'x', 30) $$,
  '23514', null, 'week 13 is rejected'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'winter', '2026-11-06', 'endurance', 'x', 30) $$,
  '23514', null, 'an unknown phase is rejected'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-06', 'endurance', 'x', 0) $$,
  '23514', null, 'a zero-minute session is rejected'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-06', 'endurance', '', 30) $$,
  '23514', null, 'an empty title is rejected'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min, steps)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-06', 'endurance', 'x', 30, '{}') $$,
  '23514', null, 'steps must be an array'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min, match_source)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'base', '2026-11-06', 'endurance', 'x', 30, 'guess') $$,
  '23514', null, 'an unknown match source is rejected'
);

select throws_ok(
  $$ insert into public.planned_sessions (plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'base', '2026-11-06', 'endurance', 'x', 30) $$,
  '23503', null, 'a session cannot be added to another user''s plan'
);
select throws_ok(
  $$ insert into public.planned_sessions (user_id, plan_id, week_number, phase, session_date, kind, title, duration_min)
     values ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'base', '2026-11-06', 'endurance', 'x', 30) $$,
  '42501', null, 'user A cannot create a session for user B'
);
select throws_ok(
  $$ update public.planned_sessions set activity_id = 'b0000000-0000-0000-0000-00000000000b', match_source = 'manual'
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23503', null, 'a session cannot link to another user''s ride'
);
select throws_ok(
  $$ update public.planned_sessions set activity_id = 'a0000000-0000-0000-0000-00000000000a'
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a linked ride needs a match source'
);

select lives_ok(
  $$ update public.planned_sessions
     set status = 'done', activity_id = 'a0000000-0000-0000-0000-00000000000a', match_source = 'auto', moved_from = '2026-11-03'
     where id = 'c0000000-0000-0000-0000-000000000001' $$,
  'user A can match a ride to a session'
);
select throws_ok(
  $$ update public.planned_sessions set activity_id = 'a0000000-0000-0000-0000-00000000000a', match_source = 'manual'
     where title = 'Recovery spin' $$,
  '23505', null, 'a ride matches one session only'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.planned_sessions $$,
  '42501', null, 'anon has no access to planned_sessions'
);

-- Back as superuser: a removed ride only clears the link
reset role;
delete from public.activities where id = 'a0000000-0000-0000-0000-00000000000a';
select is(
  (select activity_id from public.planned_sessions where id = 'c0000000-0000-0000-0000-000000000001'),
  null,
  'removing the ride clears the link'
);
select is(
  (select match_source from public.planned_sessions where id = 'c0000000-0000-0000-0000-000000000001'),
  'auto',
  'removing the ride leaves the match source'
);
select is(
  (select user_id from public.planned_sessions where id = 'c0000000-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'the session keeps its owner when the ride is removed'
);
select is(
  (select count(*)::int from public.planned_sessions where user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'user B''s session is untouched'
);

select * from finish();
rollback;
