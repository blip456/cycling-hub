-- pgTAP tests for public.baseline_entries and the current_baseline view: own rows only, append-only
-- (no update), constraints, newest row wins per metric, anon sees nothing.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

select has_table('public', 'baseline_entries', 'baseline_entries table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.baseline_entries'::regclass),
  true,
  'RLS is enabled on baseline_entries'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-a@test.invalid', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'user-b@test.invalid', '', now(), now(), now());

insert into public.activities (id, user_id, strava_id, name, sport_type, start_local, start_at, distance_m, moving_time_s, elevation_m, raw)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 1, 'x', 'Ride', now(), now(), 1, 1, 1, '{}');

insert into public.baseline_entries (user_id, effective_date, ftp_w, source)
values ('22222222-2222-2222-2222-222222222222', '2026-10-25', 300, 'manual');

-- As user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.baseline_entries (effective_date, ftp_w, source, source_activity_id)
     values ('2026-10-01', 250, 'stream_estimate', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  'user A can add an FTP entry that points at a ride'
);
select lives_ok(
  $$ insert into public.baseline_entries (effective_date, max_hr, resting_hr, lthr, source, note)
     values ('2026-10-10', 190, 48, 172, 'hr_data', 'from the rides') $$,
  'user A can add a heart rate entry'
);
-- A correction for an earlier date, entered later: it must not become the current FTP.
select lives_ok(
  $$ insert into public.baseline_entries (effective_date, ftp_w, source) values ('2026-09-01', 240, 'manual') $$,
  'user A can add an entry for an earlier date'
);
select lives_ok(
  $$ insert into public.baseline_entries (effective_date, ftp_w, source) values ('2026-10-20', 265, 'test_20min') $$,
  'user A can add a newer FTP entry'
);

select is((select count(*)::int from public.baseline_entries), 4, 'user A sees only their own four entries');

select throws_ok(
  $$ insert into public.baseline_entries (effective_date, source) values ('2026-10-21', 'manual') $$,
  '23514', null, 'an entry needs at least one value'
);
select throws_ok(
  $$ insert into public.baseline_entries (effective_date, ftp_w, source) values ('2026-10-21', 250, 'guess') $$,
  '23514', null, 'an unknown source is rejected'
);
select throws_ok(
  $$ insert into public.baseline_entries (effective_date, ftp_w, source) values ('2026-10-21', 10, 'manual') $$,
  '23514', null, 'an implausible FTP is rejected'
);
select throws_ok(
  $$ insert into public.baseline_entries (effective_date, max_hr, source) values ('2026-10-21', 300, 'manual') $$,
  '23514', null, 'an implausible max heart rate is rejected'
);
select throws_ok(
  $$ update public.baseline_entries set ftp_w = 999 where effective_date = '2026-10-20' $$,
  '42501', null, 'history is append-only: update is not allowed'
);
select throws_ok(
  $$ insert into public.baseline_entries (user_id, effective_date, ftp_w, source)
     values ('22222222-2222-2222-2222-222222222222', '2026-10-21', 250, 'manual') $$,
  '42501', null, 'user A cannot insert an entry for user B'
);

-- Current baseline: newest effective_date per metric, per user.
select is((select ftp_w from public.current_baseline), 265::smallint, 'current FTP is the newest by effective date');
select is((select ftp_effective_date from public.current_baseline), '2026-10-20'::date, 'current FTP has its effective date');
select is((select max_hr from public.current_baseline), 190::smallint, 'current max HR comes from its own newest row');
select is((select count(*)::int from public.current_baseline), 1, 'the view shows only user A (RLS applies through the view)');

select lives_ok(
  $$ delete from public.baseline_entries where effective_date = '2026-09-01' $$,
  'user A can delete their own entry'
);

-- As anon
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select count(*) from public.baseline_entries $$,
  '42501', null, 'anon has no access to baseline_entries'
);
select throws_ok(
  $$ select count(*) from public.current_baseline $$,
  '42501', null, 'anon has no access to current_baseline'
);

-- Back as superuser: effects
reset role;
select is(
  (select count(*)::int from public.baseline_entries where user_id = '11111111-1111-1111-1111-111111111111'),
  3,
  'the delete removed exactly one of user A''s entries'
);

delete from public.activities where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
select is(
  (select source_activity_id from public.baseline_entries where effective_date = '2026-10-01' and user_id = '11111111-1111-1111-1111-111111111111'),
  null,
  'deleting the ride keeps the entry and clears the link'
);

select * from finish();
rollback;
